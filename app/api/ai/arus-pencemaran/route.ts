import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import type {
  ArusAnalysisMode,
  ArusPencemaranRequest,
  ArusPencemaranResult,
  CurrentVector,
  FactorySource,
  VesselTrack,
  VesselWasteCandidate,
} from '@/app/types/maritime';
import {
  formatDurationHours,
  cardinalLabel,
  isIndustrialVessel,
  movePoint,
  predictVesselDrift,
  scoreVesselCandidate,
  simulateDrift,
  wasteFormsForVessel,
} from '../../maritime/lib/arus';
import {
  getBaserunCandidates,
  fetchInawavesWind,
  sampleInawavesGrid,
} from '../../maritime/lib/inawaves';
import {
  nearestPort,
  haversineKm,
  nearestCoast,
  bearingDeg,
} from '@/components/peta-risiko/distances';
import { fetchGfwEvents } from '../../maritime/gfw/route';
import { POLLUTION_SOURCES } from '@/components/peta-risiko/pollutionSources';

const SYSTEM_PROMPT = `Kamu adalah AI Oseanografer Indonesia bernama "Nusantara".
Tugasmu menjelaskan hasil simulasi penyebaran limbah di laut berdasarkan data arus BMKG dan aktivitas kapal industri (Global Fishing Watch).
Data yang diberikan: titik buangan, bentuk limbah, vektor arus di titik buangan, lintasan simulasi, arah rata-rata, tujuan akhir, estimasi durasi, jarak, serta daftar kandidat kapal industri di sekitar yang berpotensi membuang limbah (nama, jenis, bendera, kecepatan, jarak, alasan penilaian).
Gunakan bahasa Indonesia yang ilmiah namun mudah dipahami peneliti.

Output HARUS berupa JSON valid:
{
  "summary": "ringkasan 3-5 kalimat: arah gerak limbah, kontribusi kapal industri di sekitar, tujuan akhir dan perkiraan waktu tiba",
  "recommendations": ["rekomendasi 1", "rekomendasi 2", "rekomendasi 3"]
}`;

async function getGroqClient(): Promise<{ client: Groq; key: string } | null> {
  const key1 = process.env.GROQ_API_KEY1;
  const key2 = process.env.GROQ_API_KEY2;
  const key = key1 ?? key2;
  if (!key) return null;
  return { client: new Groq({ apiKey: key }), key };
}

/** Parse payload stringified JSON dari BMKG (double-encoded atau JSON biasa). */
function parseBmkgStringJson(rawData: unknown): unknown {
  if (typeof rawData !== 'string') return rawData;
  const trimmed = rawData.trim();
  if (!trimmed || trimmed.startsWith('<')) return null;
  try {
    const first = JSON.parse(trimmed);
    if (typeof first === 'string') {
      const inner = first.trim();
      if (!inner) return null;
      return JSON.parse(inner);
    }
    return first;
  } catch {
    return null;
  }
}

/**
 * Sumber arus, berurutan (yang tersedia lebih dulu dipakai):
 * 1. Copernicus Marine (opsional — hanya aktif jika kredensial diisi).
 * 2. BMKG Public API Perairan (telemetri real-time).
 * 3. BMKG INAWAVES angin → arus permukaan (3% kecepatan angin, defleksi Ekman ±20°).
 * 4. null → simulasi berhenti (data tidak tersedia).
 *
 * NB: Copernicus Marine Data Store sejak April 2024 tidak menyediakan endpoint
 * HTTP publik tanpa autentikasi. Agar fitur ini aktif, daftar gratis di
 * https://data.marine.copernicus.eu/register lalu isi env:
 *   COPERNICUS_USERNAME / COPERNICUS_PASSWORD  (direkomendasikan)
 *   atau COPERNICUS_TOKEN (access token yang sudah diambil sendiri)
 */

// Token access Copernicus dicache selama ~50 menit (masa berlaku 1 jam).
let copernicusAccessToken: string | null = null;
let copernicusTokenFetchedAt = 0;

/** Ambil access token Copernicus (OIDC, client "toolbox"). */
async function getCopernicusToken(): Promise<string | null> {
  const direct = process.env.COPENICUS_TOKEN ?? process.env.COPERNICUS_TOKEN;
  if (direct) return direct;
  const user = process.env.COPENICUS_USERNAME ?? process.env.COPERNICUS_USERNAME;
  const pass = process.env.COPENICUS_PASSWORD ?? process.env.COPERNICUS_PASSWORD;
  if (!user || !pass) return null;

  if (copernicusAccessToken && Date.now() - copernicusTokenFetchedAt < 50 * 60 * 1000) {
    return copernicusAccessToken;
  }

  try {
    const res = await fetch('https://auth.marine.copernicus.eu/realms/MIS/protocol/openid-connect/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: 'toolbox',
        grant_type: 'password',
        scope: 'openid profile email',
        username: user,
        password: pass,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) return null;
    copernicusAccessToken = data.access_token;
    copernicusTokenFetchedAt = Date.now();
    return data.access_token;
  } catch {
    return null;
  }
}

/**
 * Arus permukaan dari Copernicus Marine (GLOBAL_ANALYSISFORECAST_PHY_001_024,
 * arus uo/vo harian). Hanya aktif bila kredensial tersedia; kegagalan apa pun
 * → null (dilanjutkan ke sumber BMKG).
 */
async function fetchCopernicusCurrent(lat: number, lon: number): Promise<CurrentVector | null> {
  const token = await getCopernicusToken();
  if (!token) return null;

  try {
    const dataset = 'cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m';
    const today = new Date().toISOString().slice(0, 10);
    const url =
      `https://data.marine.copernicus.eu/api/` +
      `?dataset_id=${encodeURIComponent(dataset)}` +
      `&variables=${encodeURIComponent('uo,vo')}` +
      `&minimum_longitude=${lon.toFixed(3)}&maximum_longitude=${lon.toFixed(3)}` +
      `&minimum_latitude=${lat.toFixed(3)}&maximum_latitude=${lat.toFixed(3)}` +
      `&minimum_depth=0&maximum_depth=1` +
      `&start_datetime=${today}&end_datetime=${today}` +
      `&output_format=json`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20000),
      cache: 'no-store',
    });
    if (!res.ok) return null;

    const text = await res.text();
    // Berbagai kemungkinan bentuk respons: JSON array uo/vo, CSV, atau file NetCDF.
    if (text.trimStart().startsWith('{') || text.trimStart().startsWith('[')) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = JSON.parse(text) as any;
      const rows = Array.isArray(data) ? data : data?.data ?? data?.values ?? null;
      if (Array.isArray(rows) && rows.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const first = rows[0] as Record<string, unknown>;
        const u = Number(first.uo ?? first.u ?? rows[0]?.[0]);
        const v = Number(first.vo ?? first.v ?? rows[0]?.[1]);
        if (Number.isFinite(u) && Number.isFinite(v) && (u !== 0 || v !== 0)) {
          return {
            speedMps: Math.hypot(u, v),
            directionDeg: ((Math.atan2(-u, -v) * 180) / Math.PI + 360) % 360,
          };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Ambil vektor arus di satu titik dari BMKG Public API Perairan (m/s, derajat). */
async function fetchPerairanCurrent(lat: number, lon: number): Promise<CurrentVector | null> {
  try {
    const url = `https://peta-maritim.bmkg.go.id/public_api/perairan?lat=${lat}&lon=${lon}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;

    const parsed = parseBmkgStringJson(await res.text());
    if (!parsed || typeof parsed !== 'object') return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawObj = parsed as any;
    const forecastList = Array.isArray(rawObj)
      ? rawObj
      : Array.isArray(rawObj?.data)
        ? rawObj.data
        : Array.isArray(rawObj?.forecasts)
          ? rawObj.forecasts
          : null;
    if (!forecastList || forecastList.length === 0) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f = forecastList[0] as Record<string, unknown>;
    const speed = Number(f.current_speed ?? f.currentSpeed ?? f.cs);
    const dir = Number(f.current_direction ?? f.currentDir ?? f.cd);
    if (!Number.isFinite(speed) || !Number.isFinite(dir)) return null;
    return { speedMps: Math.max(0, speed), directionDeg: ((dir % 360) + 360) % 360 };
  } catch {
    return null;
  }
}

/** Arus permukaan hasil estimasi dari angin INAWAVES (model terbaru yang berhasil). */
async function fetchWindDriftCurrent(lat: number, lon: number): Promise<CurrentVector | null> {
  const candidates = await getBaserunCandidates();
  for (const baserun of candidates) {
    const wind = await fetchInawavesWind(baserun);
    if (!wind) continue;
    const u = sampleInawavesGrid(wind.uData, lat, lon, wind);
    const v = sampleInawavesGrid(wind.vData, lat, lon, wind);
    if (!Number.isFinite(u) || !Number.isFinite(v)) continue;

    const windSpeed = Math.hypot(u, v);
    if (windSpeed < 0.3) continue;
    // Arah angin MENUJU (meteorologis "from" → "to"):
    const fromDeg = ((Math.atan2(-u, -v) * 180) / Math.PI + 360) % 360;
    const toDeg = (fromDeg + 180) % 360;
    // Arus permukaan: ~3% kecepatan angin, menyimpang ke kanan (NH) / kiri (SH) 20°.
    const ekmanOffset = lat >= 0 ? 20 : -20;
    return {
      speedMps: Math.max(0.05, windSpeed * 0.03),
      directionDeg: ((toDeg + ekmanOffset) % 360 + 360) % 360,
    };
  }
  return null;
}

/** Bentuk limbah yang umum dikaitkan dengan jenis pabrik tertentu. */
function factoryWasteForms(kind: FactorySource['kind']): string[] {
  switch (kind) {
    case 'kilang':
      return ['limbah minyak & hidrokarbon', 'limbah cair kimia', 'air proses industri'];
    case 'pltu':
      return ['air pendingin termal', 'abu terbang batubara', 'limbah cair kimia'];
    case 'kawasan-industri':
      return ['limbah cair industri', 'sampah padat', 'sedimen & partikel'];
    case 'smelter':
      return ['limbah cair logam berat', 'terak & partikel padat'];
  }
}

/** Format tanggal jam ISO → "12 Agu 2026, 18:00" (server, pakai locale id-ID). */
function formatIdDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function POST(req: NextRequest) {
  const body: ArusPencemaranRequest = await req.json();
  const { regionName, originLat, originLon, spillRadiusKm, wasteForm } = body;
  const mode: ArusAnalysisMode = body.mode ?? 'buangan';
  const radiusKm =
    Number.isFinite(body.radiusKm) && (body.radiusKm as number) > 0
      ? (body.radiusKm as number)
      : mode === 'buangan'
        ? (spillRadiusKm ?? 40)
        : 40;
  const forecastDays = Math.max(1, Math.min(14, Math.round(body.forecastDays ?? 5)));
  const historyDays = Math.max(7, Math.min(90, Math.round(body.historyDays ?? 30)));

  if (!regionName || !Number.isFinite(originLat) || !Number.isFinite(originLon)) {
    return NextResponse.json({ error: 'regionName, originLat, originLon wajib diisi' }, { status: 422 });
  }

  const analysisTimestamp = new Date().toISOString();

  // Vektor arus per titik, dengan cache per-request (BMKG fetch lambat).
  const usedCurrentSources = new Set<string>();
  const vectorCache = new Map<string, CurrentVector | null>();
  const currentAt = async (lat: number, lon: number): Promise<CurrentVector | null> => {
    const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
    if (vectorCache.has(key)) return vectorCache.get(key) ?? null;
    let vector = await fetchCopernicusCurrent(lat, lon);
    if (vector) {
      usedCurrentSources.add('Copernicus Marine (Arus)');
    } else {
      vector = await fetchPerairanCurrent(lat, lon);
      if (vector) {
        usedCurrentSources.add('BMKG Perairan (Arus)');
      } else {
        vector = await fetchWindDriftCurrent(lat, lon);
        if (vector) usedCurrentSources.add('BMKG INAWAVES (Angin → Arus)');
      }
    }
    vectorCache.set(key, vector);
    return vector;
  };

  const origin = { lat: originLat, lon: originLon };
  const currentAtOrigin = await currentAt(originLat, originLon);

  // Pre-fetch paralel titik resample nominal (garis lurus searah arus asal).
  // Saat BMKG/INAWAVES lambat atau down, semua timeout berjalan bersamaan
  // dan hasilnya di-cache — simulasi berikutnya tinggal pakai cache.
  const stepHours = 6;
  const resampleEverySteps = 4;
  // Horizon simulasi hanyut: mengikuti input pengguna (1–14 hari), tidak
  // dipatok jam tetap — makin panjang horizon, makin jauh potensi hanyut.
  const maxSteps = Math.max(1, Math.ceil((forecastDays * 24) / stepHours));
  const maxTotalDistanceKm = Math.max(300, Math.round(forecastDays * 70));
  if (currentAtOrigin) {
    const prefetchCount = Math.min(10, Math.ceil(maxSteps / resampleEverySteps));
    await Promise.all(
      Array.from({ length: prefetchCount }, (_, i) => {
        const s = (i + 1) * resampleEverySteps;
        const p = movePoint(
          originLat,
          originLon,
          currentAtOrigin.speedMps,
          currentAtOrigin.directionDeg,
          s * stepHours
        );
        return currentAt(p.lat, p.lon);
      })
    );
  }

  const sim = await simulateDrift(origin, currentAt, {
    stepHours,
    maxSteps,
    coastHitKm: 5,
    maxTotalDistanceKm,
    resampleEverySteps,
  });

  const last = sim.trajectory[sim.trajectory.length - 1];
  const destination = sim.destination ?? {
    lat: last?.lat ?? originLat,
    lon: last?.lon ?? originLon,
    type: 'no-data' as const,
    label: 'Tidak dapat menentukan tujuan akhir',
  };
  const directionLabel = cardinalLabel(sim.bearingDeg);
  const durationLabel = formatDurationHours(sim.durationHours);

  // Konteks untuk agent AI (ringkas — trajektori di-subsample).
  const stepSize = Math.max(1, Math.ceil(sim.trajectory.length / 8));
  const sampledTrajectory = sim.trajectory
    .filter((_, i) => i % stepSize === 0 || i === sim.trajectory.length - 1)
    .map(
      (p) =>
        `t=${p.timeOffsetHours}j (${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}) ${p.speedMps.toFixed(2)} m/s arah ${p.directionDeg}°`
    )
    .join('; ');
  const nearestPortInfo = (() => {
    const port = nearestPort(destination.lat, destination.lon);
    return port ? `${port.port.name} (~${Math.round(port.distanceKm)} km dari titik akhir)` : '—';
  })();

  // Analisis kandidat kapal industri di sekitar titik buangan (Global Fishing Watch).
  let vesselCandidates: VesselWasteCandidate[] = [];
  if (body.includeVesselAnalysis !== false) {
    const gfwRadiusKm = 80;
    const spanDeg = Math.max(0.5, gfwRadiusKm / 111);
    const gfw = await fetchGfwEvents({
      north: originLat + spanDeg,
      south: originLat - spanDeg,
      east: originLon + spanDeg,
      west: originLon - spanDeg,
    });
    const events = gfw?.vesselEvents ?? [];
    if (events.length > 0) {
      usedCurrentSources.add('Global Fishing Watch (GFW)');
      // Prediksi drift tiap kandidat dijalankan paralel (masing-masing memakai
      // vektor arus dari cache yang sama) — hemat hingga ~5x waktu tunggu.
      const pending = events
        .filter((ev) => {
          if (!isIndustrialVessel(ev.vesselType)) return false;
          const distKm = haversineKm({ lat: originLat, lon: originLon }, { lat: ev.lat, lon: ev.lon });
          return distKm <= gfwRadiusKm;
        })
        .map(async (ev): Promise<VesselWasteCandidate> => {
          const distKm = haversineKm({ lat: originLat, lon: originLon }, { lat: ev.lat, lon: ev.lon });
          const scored = scoreVesselCandidate({
            vesselType: ev.vesselType,
            eventType: ev.type,
            speedKnots: ev.speedKnots,
            heading: ev.heading,
            distanceFromOriginKm: distKm,
          });
          const predicted = await predictVesselDrift(ev.lat, ev.lon, currentAt, {
            maxSteps,
            maxTotalDistanceKm,
          });
          return {
            vesselId: ev.vesselId,
            vesselName: ev.vesselName || 'Tidak teridentifikasi',
            vesselType: ev.vesselType ?? 'unknown',
            flag: ev.flag || '—',
            lat: ev.lat,
            lon: ev.lon,
            speedKnots: ev.speedKnots,
            heading: ev.heading,
            eventType: ev.type,
            startTime: ev.startTime,
            endTime: ev.endTime,
            distanceFromOriginKm: Math.round(distKm * 10) / 10,
            likelihood: scored.likelihood,
            reason: scored.reason,
            wasteForms: wasteFormsForVessel(ev.vesselType),
            predicted,
          };
        });
      const candidates = await Promise.all(pending);
      candidates.sort((a, b) => {
        const rank = { tinggi: 0, sedang: 1, rendah: 2 };
        return rank[a.likelihood] - rank[b.likelihood] || a.distanceFromOriginKm - b.distanceFromOriginKm;
      });
      vesselCandidates = candidates.slice(0, 5);
    }
  }

  // ── Mode KAPAL: riwayat kapal melintas + posisi kini + prediksi rute ──────
  let vesselTracks: VesselTrack[] = [];
  if (mode === 'kapal') {
    const spanDeg = Math.max(0.5, radiusKm / 111);
    const end = new Date();
    const start = new Date(end.getTime() - historyDays * 86400000);
    const gfw = await fetchGfwEvents({
      north: originLat + spanDeg,
      south: originLat - spanDeg,
      east: originLon + spanDeg,
      west: originLon - spanDeg,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      maxEvents: 100,
    });
    const events = (gfw?.vesselEvents ?? []).filter((ev) => {
      // Hanya kapal yang benar-benar lewat di dalam radius lingkaran, bukan di
      // pojok bounding box (yang bisa 1.4× lebih jauh dari radius tertera).
      return haversineKm({ lat: originLat, lon: originLon }, { lat: ev.lat, lon: ev.lon }) <= radiusKm;
    });
    if (events.length > 0) usedCurrentSources.add('Global Fishing Watch (GFW)');

    const byVessel = new Map<string, typeof events>();
    for (const ev of events) {
      if (!ev.vesselId) continue;
      const arr = byVessel.get(ev.vesselId) ?? [];
      arr.push(ev);
      byVessel.set(ev.vesselId, arr);
    }

    const trackPromises = [...byVessel.values()].map(async (evs): Promise<VesselTrack> => {
      const sorted = [...evs].sort((a, b) => a.startTime.localeCompare(b.startTime));
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const passes = sorted.map((ev) => ({
        eventType: ev.type,
        lat: ev.lat,
        lon: ev.lon,
        heading: ev.heading,
        speedKnots: ev.speedKnots,
        startTime: ev.startTime,
        endTime: ev.endTime,
        distanceFromPointKm:
          Math.round(haversineKm({ lat: originLat, lon: originLon }, { lat: ev.lat, lon: ev.lon }) * 10) / 10,
      }));

      // Arah: heading event terakhir, fallback bearing lintasan pertama→terakhir.
      const rawHeading =
        last.heading ??
        (sorted.length > 1
          ? bearingDeg({ lat: first.lat, lon: first.lon }, { lat: last.lat, lon: last.lon })
          : undefined);
      const heading = rawHeading !== undefined ? ((rawHeading % 360) + 360) % 360 : undefined;
      const speedKnots = last.speedKnots ?? 6;
      const waste = await predictVesselDrift(last.lat, last.lon, currentAt, {
        maxSteps,
        maxTotalDistanceKm,
      });
      return {
        vesselId: last.vesselId,
        vesselName: last.vesselName || 'Tidak teridentifikasi',
        vesselType: last.vesselType ?? 'unknown',
        flag: last.flag || '—',
        passes,
        current: { lat: last.lat, lon: last.lon, time: last.endTime, heading, speedKnots },
        wasteDrift: {
          bearingDeg: waste.bearingDeg,
          directionLabel: waste.directionLabel,
          durationLabel: waste.durationLabel,
          distanceKm: waste.distanceKm,
          trajectory: waste.trajectory,
          destination: waste.destination,
        },
      };
    });
    const tracks = await Promise.all(trackPromises);
    vesselTracks = tracks
      .sort(
        (a, b) =>
          b.passes.length - a.passes.length ||
          b.passes[b.passes.length - 1].startTime.localeCompare(a.passes[a.passes.length - 1].startTime)
      )
      .slice(0, 20);
  }

  // ── Mode PABRIK: pabrik sumber pencemar dalam radius + hanyut dari pabrik ─
  let factorySources: FactorySource[] = [];
  if (mode === 'pabrik') {
    const within = POLLUTION_SOURCES.map((s) => ({
      ...s,
      distanceKm: haversineKm({ lat: originLat, lon: originLon }, { lat: s.lat, lon: s.lon }),
    }))
      .filter((s) => s.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 8);

    const pending = within.map(async (f): Promise<FactorySource> => {
      // Hanyut dimulai dari pantai terdekat pabrik (outfall); pabrik yang terlalu
      // jauh dari pantai (>30 km) tidak menghasilkan prediksi hanyut.
      const coast = nearestCoast(f.lat, f.lon);
      const drift =
        coast && coast.distanceKm <= 30
          ? await simulateDrift(coast.point, currentAt, {
              stepHours,
              maxSteps,
              coastHitKm: 5,
              maxTotalDistanceKm,
              resampleEverySteps,
            })
          : null;
      return {
        name: f.name,
        kind: f.kind,
        lat: f.lat,
        lon: f.lon,
        distanceKm: Math.round(f.distanceKm * 10) / 10,
        direction: cardinalLabel(bearingDeg({ lat: originLat, lon: originLon }, { lat: f.lat, lon: f.lon })),
        wasteForms: factoryWasteForms(f.kind),
        drift: drift
          ? {
              bearingDeg: Math.round(drift.bearingDeg),
              directionLabel: cardinalLabel(drift.bearingDeg),
              durationLabel: formatDurationHours(drift.durationHours),
              distanceKm: Math.round(drift.totalDistanceKm * 10) / 10,
              trajectory: drift.trajectory,
              destination: drift.destination,
            }
          : null,
      };
    });
    factorySources = await Promise.all(pending);
    if (factorySources.length > 0) usedCurrentSources.add('Dataset Pabrik Sumber Pencemar');
  }

  const vesselContext = vesselCandidates.length
    ? `
KANDIDAT KAPAL INDUSTRI DI SEKITAR (Global Fishing Watch):
${vesselCandidates
  .map(
    (c, i) =>
      `${i + 1}. ${c.vesselName} (${c.vesselType}, bendera ${c.flag}) — ${c.eventType} pada ${c.startTime ?? '?'}` +
      `, ${c.distanceFromOriginKm} km dari titik buangan, kecepatan ${c.speedKnots?.toFixed(1) ?? '?'} kn.` +
      ` Potensi: ${c.likelihood} — ${c.reason} Perkiraan limbah: ${c.wasteForms.join(', ')}.` +
      ` Jika dibuang, limbah berpotensi hanyut ${c.predicted.directionLabel} (${c.predicted.bearingDeg}°), ~${Math.round(c.predicted.distanceKm)} km dalam ${c.predicted.durationLabel}.`
  )
  .join('\n')}
`
    : `
KANDIDAT KAPAL INDUSTRI DI SEKITAR (Global Fishing Watch):
Tidak ada kapal industri dalam radius 80 km dari titik buangan.
`;

  const kapalContext = vesselTracks.length
    ? `
RIWAYAT KAPAL MELINTAS (${historyDays} HARI TERAKHIR, RADIUS ${Math.round(radiusKm)} KM):
${vesselTracks
  .slice(0, 8)
  .map(
    (t, i) =>
      `${i + 1}. ${t.vesselName} (${t.vesselType}, bendera ${t.flag}) — ${t.passes.length}× lewat: ` +
      t.passes
        .map((p) => `${formatIdDateTime(p.startTime)} (${p.distanceFromPointKm} km dari titik)`)
        .join('; ') +
      `. Posisi terakhir ${formatIdDateTime(t.current?.time ?? '')}` +
      (t.wasteDrift
        ? `. Jika membuang limbah dari posisi terakhirnya, limbah berpotensi hanyut ${t.wasteDrift.directionLabel} (${t.wasteDrift.bearingDeg}°), ~${Math.round(t.wasteDrift.distanceKm)} km dalam ${t.wasteDrift.durationLabel}.`
        : '. Prediksi hanyut limbah tidak dapat dijalankan dari data yang tersedia.')
  )
  .join('\n')}
`
    : `
RIWAYAT KAPAL MELINTAS:
Tidak ada kapal terdeteksi dalam radius ${Math.round(radiusKm)} km pada ${historyDays} hari terakhir.
`;

  const factoryContext = factorySources.length
    ? `
PABRIK SUMBER PENCEMAR DALAM RADIUS ${Math.round(radiusKm)} KM:
${factorySources
  .map(
    (f, i) =>
      `${i + 1}. ${f.name} (${f.kind}) — ${f.distanceKm} km arah ${f.direction} dari titik. ` +
      `Perkiraan limbah: ${f.wasteForms.join(', ')}.` +
      (f.drift
        ? ` Hanyut dari pantai terdekat: ${f.drift.directionLabel} (${f.drift.bearingDeg}°), ~${Math.round(f.drift.distanceKm)} km dalam ${f.drift.durationLabel}.`
        : ' Terlalu jauh dari pantai — prediksi hanyut tidak dijalankan.')
  )
  .join('\n')}
`
    : `
PABRIK SUMBER PENCEMAR:
Tidak ada pabrik terdeteksi dalam radius ${Math.round(radiusKm)} km.
`;

  const dataContext = `
LOKASI ANALISIS:
- Wilayah: ${regionName}
- Koordinat: ${originLat.toFixed(4)}, ${originLon.toFixed(4)}
${mode === 'buangan' ? `- Bentuk limbah: ${wasteForm ?? 'tidak ditentukan'}\n- Radius sebaran awal: ${spillRadiusKm ? `${spillRadiusKm} km` : 'tidak ditentukan'}` : `- Radius pemindaian: ${Math.round(radiusKm)} km`}

ARUS DI TITIK ANALISIS:
- ${currentAtOrigin ? `Kecepatan ${currentAtOrigin.speedMps} m/s, arah ${currentAtOrigin.directionDeg}° (${cardinalLabel(currentAtOrigin.directionDeg)})` : 'Tidak tersedia'}

LINTASAN SIMULASI (per langkah 6 jam):
${sampledTrajectory}

HASIL SIMULASI:
- Arah rata-rata gerak: ${directionLabel} (${Math.round(sim.bearingDeg)}°)
- Tujuan akhir: ${destination.type} — ${destination.label}
- Koordinat tujuan: ${destination.lat.toFixed(4)}, ${destination.lon.toFixed(4)}
- Pelabuhan terdekat dari titik akhir: ${nearestPortInfo}
- Estimasi waktu tiba: ${durationLabel}
- Jarak lurus: ${Math.round(sim.straightDistanceKm)} km; jarak tempuh kumulatif: ${Math.round(sim.totalDistanceKm)} km
- Kecepatan rata-rata: ${sim.avgSpeedKnots.toFixed(2)} knots
${mode === 'buangan' ? vesselContext : mode === 'kapal' ? kapalContext : factoryContext}`;

  // Narrative AI (fallback deterministik jika Groq gagal / rate-limited).
  let summary: string;
  let recommendations: string[];
  if (mode === 'kapal') {
    const top = vesselTracks[0];
    summary = vesselTracks.length
      ? `Dalam ${historyDays} hari terakhir terdeteksi ${vesselTracks.length} kapal melintas dalam radius ${Math.round(radiusKm)} km dari titik analisis. ${top ? `Kapal paling sering melintas adalah ${top.vesselName} (${top.vesselType}, bendera ${top.flag}) dengan ${top.passes.length} lintasan; posisi terakhirnya tercatat ${formatIdDateTime(top.current?.time ?? '')}. ${top.wasteDrift ? `Limbah yang dibuang dari posisi terakhirnya berpotensi hanyut ${top.wasteDrift.directionLabel} (${top.wasteDrift.bearingDeg}°), ~${Math.round(top.wasteDrift.distanceKm)} km dalam ${top.wasteDrift.durationLabel}.` : 'Prediksi hanyut limbah tidak dapat dijalankan dari data yang tersedia.'}` : ''}`
      : `Tidak ada kapal terdeteksi dalam radius ${Math.round(radiusKm)} km selama ${historyDays} hari terakhir — wilayah relatif tenang dari lalu lintas kapal.`;
    recommendations = [
      'Aktifkan pengamatan berkala pada kapal dengan lintasan terbanyak untuk penelusuran sumber pencemaran.',
      'Catat tanggal lewat kapal kandidat sebagai bukti awal investigasi pencemaran.',
      'Pasang titik pantau di sepanjang lintasan hanyut limbah untuk verifikasi di lapangan.',
    ];
  } else if (mode === 'pabrik') {
    const nearest = factorySources[0];
    summary = factorySources.length
      ? `Dalam radius ${Math.round(radiusKm)} km terdeteksi ${factorySources.length} pabrik berpotensi sebagai sumber pencemar. ${nearest ? `Paling dekat adalah ${nearest.name} (${nearest.kind}) berjarak ${nearest.distanceKm} km arah ${nearest.direction} dari titik analisis. ${nearest.drift ? `Limbah dari muara pantai terdekatnya diperkirakan hanyut ke arah ${nearest.drift.directionLabel} (~${Math.round(nearest.drift.distanceKm)} km dalam ${nearest.drift.durationLabel}).` : 'Pabrik ini terlalu jauh dari pantai untuk memprediksi hanyutan limbahnya.'}` : ''}`
      : `Tidak ada pabrik sumber pencemar terdeteksi dalam radius ${Math.round(radiusKm)} km dari titik analisis.`;
    recommendations = [
      'Koordinasi dengan otoritas lingkungan setempat untuk audit pembuangan limbah pabrik dalam radius.',
      'Pantau parameter kualitas air di hilir muara pabrik terdekat secara berkala.',
      'Lakukan pemantauan citra satelit di area tujuan hanyutan limbah dari muara pabrik.',
    ];
  } else {
    summary =
      `Simulasi menunjukkan limbah bergerak ke arah ${directionLabel} dengan kecepatan rata-rata ${sim.avgSpeedKnots.toFixed(2)} knots. ` +
      (destination.type === 'coast'
        ? `Diperkirakan terdampar di pesisir dalam ${durationLabel}, menempuh ${Math.round(sim.totalDistanceKm)} km.`
        : `Dalam ${durationLabel} diperkirakan mencapai titik ${destination.label.toLowerCase()}, menempuh ${Math.round(sim.totalDistanceKm)} km.`) +
      (vesselCandidates.length > 0
        ? ` Teridentifikasi ${vesselCandidates.length} kapal industri di sekitar titik buangan; yang paling berpotensi adalah ${vesselCandidates[0].vesselName} (${vesselCandidates[0].vesselType}, ${vesselCandidates[0].likelihood}).`
        : ' Tidak ada kapal industri signifikan di sekitar titik buangan.');
    recommendations = [
      'Pasang titik pantau di sepanjang lintasan prediksi untuk verifikasi lapangan.',
      'Lakukan pemantauan citra satelit secara berkala di area tujuan akhir.',
      'Koordinasi dengan otoritas pelabuhan & pesisir terdekat untuk kesiapan penanggulangan.',
    ];
    if (vesselCandidates.length > 0) {
      recommendations.push(
        'Periksa riwayat AIS & jadwal kapal kandidat berpotensi tinggi untuk penelusuran sumber pencemaran.',
        'Catat identitas kapal kandidat (MMSI/nama) sebagai bukti awal investigasi pencemaran.'
      );
    }
  }

  const groq = await getGroqClient();
  if (groq) {
    try {
      const completion = await groq.client.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: dataContext },
        ],
        temperature: 0.3,
        max_tokens: 512,
        response_format: { type: 'json_object' },
      });
      const content = completion.choices?.[0]?.message?.content ?? '';
      const parsed = JSON.parse(content) as { summary?: string; recommendations?: string[] };
      if (parsed.summary) summary = parsed.summary;
      if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
        recommendations = parsed.recommendations.slice(0, 5);
      }
    } catch (err) {
      console.warn(
        '[ArusPencemaran] Groq fallback ke narasi deterministik:',
        err instanceof Error ? err.message.slice(0, 200) : err
      );
    }
  }

  const result: ArusPencemaranResult = {
    locationName: regionName,
    analysisTimestamp,
    origin,
    spillRadiusKm,
    wasteForm,
    mode,
    radiusKm,
    historyDays,
    forecastDays,
    currentAtOrigin,
    trajectory: sim.trajectory,
    destination,
    directionLabel,
    bearingDeg: Math.round(sim.bearingDeg),
    avgSpeedKnots: Math.round(sim.avgSpeedKnots * 100) / 100,
    straightDistanceKm: Math.round(sim.straightDistanceKm * 10) / 10,
    totalDistanceKm: Math.round(sim.totalDistanceKm * 10) / 10,
    durationHours: sim.durationHours,
    durationLabel,
    summary,
    recommendations,
    vesselCandidates,
    vesselTracks,
    factorySources,
    dataSources: [...usedCurrentSources, 'Simulasi Drift Lagrangian'],
  };

  return NextResponse.json({ result });
}
