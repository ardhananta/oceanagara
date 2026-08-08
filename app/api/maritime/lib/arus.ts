import type {
  CurrentVector,
  DriftDestination,
  DriftPoint,
} from '@/app/types/maritime';
import {
  bearingDeg,
  haversineKm,
  nearestCoast,
} from '@/components/peta-risiko/distances';

// Prediksi penyebaran limbah berbasis arus laut BMKG.
// - `currentDirection` BMKG = arah arus MENUJU (ke mana arus mengalir), 0-360 (0=N).
// - `currentSpeed` dalam m/s.
//
// Hanya pure logic di sini: fetch & orchestration ada di route API.
// NB: arus dianggap konstan antar resample; model Lagrangian sederhana (adveksi).

const KM_PER_DEG_LAT = 111.32;

/** Geser satu titik sejauh vektor arus selama `hours` jam. */
export function movePoint(
  lat: number,
  lon: number,
  speedMps: number,
  directionDeg: number,
  hours: number
): { lat: number; lon: number } {
  const distanceKm = (speedMps * 3600 * hours) / 1000;
  const rad = (directionDeg * Math.PI) / 180;
  const dLat = (distanceKm * Math.cos(rad)) / KM_PER_DEG_LAT;
  const dLon =
    (distanceKm * Math.sin(rad)) /
    (KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
  return { lat: lat + dLat, lon: lon + dLon };
}

export interface DriftSimOptions {
  /** Panjang langkah simulasi (jam). Default 6. */
  stepHours?: number;
  /** Jumlah langkah maksimum. Default 20 (120 jam). */
  maxSteps?: number;
  /** Ambang deteksi terdampar di pesisir (km). Default 5. */
  coastHitKm?: number;
  /** Batas jarak tempuh kumulatif (km). Default 300. */
  maxTotalDistanceKm?: number;
  /** Resample vektor arus setiap N langkah (hemat fetch BMKG). Default 4. */
  resampleEverySteps?: number;
}

export interface DriftSimResult {
  trajectory: DriftPoint[];
  destination: DriftDestination | null;
  durationHours: number;
  straightDistanceKm: number;
  totalDistanceKm: number;
  avgSpeedKnots: number;
  bearingDeg: number;
}

/**
 * Simulasi drift Lagrangian sederhana: limbah terbawa arus langkah demi langkah.
 * Berhenti saat: mencapai pesisir (terdampar), kehabisan data arus,
 * melewati batas jarak, atau mencapai batas waktu simulasi.
 */
export async function simulateDrift(
  origin: { lat: number; lon: number },
  currentAt: (lat: number, lon: number) => Promise<CurrentVector | null>,
  opts: DriftSimOptions = {}
): Promise<DriftSimResult> {
  const stepHours = opts.stepHours ?? 6;
  const maxSteps = opts.maxSteps ?? 20;
  const coastHitKm = opts.coastHitKm ?? 5;
  const maxTotalDistanceKm = opts.maxTotalDistanceKm ?? 300;
  const resampleEverySteps = opts.resampleEverySteps ?? 4;

  const buildResult = (
    trajectory: DriftPoint[],
    destination: DriftDestination | null,
    durationHours: number
  ): DriftSimResult => {
    const last = trajectory[trajectory.length - 1];
    const straightDistanceKm = last?.distanceFromOriginKm ?? 0;
    const totalDistanceKm = last?.cumulativeDistanceKm ?? 0;
    return {
      trajectory,
      destination,
      durationHours,
      straightDistanceKm,
      totalDistanceKm,
      avgSpeedKnots: durationHours > 0 ? (totalDistanceKm / durationHours) * 0.539957 : 0,
      bearingDeg:
        trajectory.length > 1
          ? ((bearingDeg(origin, { lat: last.lat, lon: last.lon }) % 360) + 360) % 360
          : 0,
    };
  };

  let lat = origin.lat;
  let lon = origin.lon;
  let time = 0;
  let cum = 0;
  let lastVector: CurrentVector | null = null;

  const trajectory: DriftPoint[] = [
    {
      lat,
      lon,
      timeOffsetHours: 0,
      distanceFromOriginKm: 0,
      cumulativeDistanceKm: 0,
      speedMps: 0,
      directionDeg: 0,
    },
  ];

  for (let s = 0; s < maxSteps; s++) {
    if (s % resampleEverySteps === 0) {
      lastVector = await currentAt(lat, lon);
      if (!lastVector) {
        return buildResult(trajectory, {
          lat,
          lon,
          type: 'no-data',
          label: 'Data arus tidak tersedia untuk titik ini — simulasi dihentikan',
        }, time);
      }
    }
    if (!lastVector) return buildResult(trajectory, null, time);

    const next = movePoint(lat, lon, lastVector.speedMps, lastVector.directionDeg, stepHours);
    const segmentKm = haversineKm({ lat, lon }, next);
    cum += segmentKm;
    time += stepHours;
    lat = next.lat;
    lon = next.lon;

    trajectory.push({
      lat,
      lon,
      timeOffsetHours: time,
      distanceFromOriginKm: haversineKm(origin, { lat, lon }),
      cumulativeDistanceKm: cum,
      speedMps: lastVector.speedMps,
      directionDeg: lastVector.directionDeg,
    });

    if (cum >= maxTotalDistanceKm) {
      return buildResult(trajectory, {
        lat,
        lon,
        type: 'time-limit',
        label: `Batas jarak simulasi ${maxTotalDistanceKm} km — limbah masih di laut lepas`,
      }, time);
    }

    const coast = nearestCoast(lat, lon);
    if (coast && coast.distanceKm <= coastHitKm) {
      const beachDistKm = haversineKm(origin, coast.point);
      return buildResult(trajectory, {
        lat: coast.point.lat,
        lon: coast.point.lon,
        type: 'coast',
        label: `Terdampar di pesisir terdekat (~${Math.round(beachDistKm)} km dari titik buangan)`,
      }, time);
    }
  }

  return buildResult(trajectory, {
    lat,
    lon,
    type: 'time-limit',
    label: `Batas waktu simulasi ${time} jam — limbah masih di laut lepas`,
  }, time);
}

/** Format durasi jam → "N hari M jam" / "N jam". */
export function formatDurationHours(hours: number): string {
  const rounded = Math.max(0, Math.round(hours));
  const days = Math.floor(rounded / 24);
  const hoursLeft = rounded % 24;
  if (days > 0 && hoursLeft > 0) return `${days} hari ${hoursLeft} jam`;
  if (days > 0) return `${days} hari`;
  return `${rounded} jam`;
}

/** Arah kardinal dalam kata penuh bahasa Indonesia (0=N, searah jarum jam). */
export function cardinalLabel(deg: number): string {
  const dirs = ['Utara', 'Timur Laut', 'Timur', 'Tenggara', 'Selatan', 'Barat Daya', 'Barat', 'Barat Laut'];
  return dirs[Math.round(((deg % 360) + 360) / 45) % 8];
}

// ─── Kandidat kapal industri (GFW) ───────────────────────────────────────────

const INDUSTRIAL_VESSEL_TYPES = new Set(['tanker', 'cargo', 'passenger', 'fishing']);

/** Jenis kapal yang relevan sebagai kandidat pembuang limbah industri. */
export function isIndustrialVessel(type: string | undefined | null): boolean {
  return !!type && INDUSTRIAL_VESSEL_TYPES.has(type.toLowerCase());
}

/**
 * Skor + alasan penilaian kandidat kapal (pure, tanpa fetch):
 * - loitering lambat → kemungkinan tinggi (pembuangan diam-diam).
 * - tanker → tinggi (limbah minyak), cargo/fishing → sedang.
 * - jarak dekat → lebih relevan.
 */
export function scoreVesselCandidate(vessel: {
  vesselType?: string;
  eventType?: string;
  speedKnots?: number;
  distanceFromOriginKm: number;
  heading?: number;
}): { likelihood: 'tinggi' | 'sedang' | 'rendah'; reason: string } {
  const type = (vessel.vesselType ?? '').toLowerCase();
  const eventType = (vessel.eventType ?? '').toLowerCase();
  const speed = vessel.speedKnots;

  const isLoitering = eventType === 'loitering' || (typeof speed === 'number' && speed < 1.2);
  let likelihood: 'tinggi' | 'sedang' | 'rendah';
  let reason: string;

  if (type === 'tanker') {
    likelihood = isLoitering ? 'tinggi' : 'sedang';
    reason = isLoitering
      ? 'Kapal tanker melaju lambat (loitering) — pola umum pembuangan bilga & limbah minyak.'
      : 'Kapal tanker di jalur pelayaran — risiko pembuangan limbah minyak & bilga saat operasi.';
  } else if (type === 'cargo' || type === 'passenger') {
    likelihood = isLoitering ? 'tinggi' : 'sedang';
    reason = isLoitering
      ? 'Kapal kargo/penumpang melaju lambat — pola pembuangan limbah padat & plastik.'
      : 'Kapal kargo/penumpang melintas — risiko pembuangan sampah & air ballast.';
  } else if (type === 'fishing') {
    likelihood = isLoitering ? 'sedang' : 'rendah';
    reason = isLoitering
      ? 'Kapal penangkapan berhenti/lambat — potensi pembuangan sisa hasil tangkapan & oli.'
      : 'Aktivitas penangkapan ikan normal — risiko rendah limbah industri.';
  } else {
    likelihood = 'rendah';
    reason = 'Tipe kapal tidak tergolong industri berat.';
  }

  if (vessel.distanceFromOriginKm <= 20 && likelihood !== 'rendah') {
    reason += ` Berada dalam ${Math.round(vessel.distanceFromOriginKm)} km dari titik buangan — sangat relevan.`;
  }

  return { likelihood, reason };
}

/** Bentuk limbah yang umum dikaitkan dengan jenis kapal tertentu. */
export function wasteFormsForVessel(vesselType?: string): string[] {
  const t = (vesselType ?? '').toLowerCase();
  if (t === 'tanker') return ['cairan minyak (hydrocarbon film)', 'limbah cair industri (termal & kimia)', 'sisa oli ringan'];
  if (t === 'cargo') return ['sampah plastik padat terapung', 'sedimen terlarut'];
  if (t === 'passenger') return ['sampah plastik padat terapung', 'partikel tersuspensi'];
  if (t === 'fishing') return ['sisa oli ringan', 'partikel tersuspensi'];
  return ['partikel tersuspensi'];
}

/**
 * Simulasi drift singkat untuk satu kandidat kapal: limbah yang mungkin dibuang
 * dari posisi kapal akan terbawa arus ke mana dalam horizon tertentu.
 */
export async function predictVesselDrift(
  vesselLat: number,
  vesselLon: number,
  currentAt: (lat: number, lon: number) => Promise<CurrentVector | null>,
  opts: { stepHours?: number; maxSteps?: number; coastHitKm?: number; maxTotalDistanceKm?: number; resampleEverySteps?: number } = {}
): Promise<{
  bearingDeg: number;
  directionLabel: string;
  durationHours: number;
  durationLabel: string;
  distanceKm: number;
  trajectory: DriftPoint[];
  destination: DriftDestination | null;
}> {
  const sim = await simulateDrift(
    { lat: vesselLat, lon: vesselLon },
    currentAt,
    {
      stepHours: opts.stepHours ?? 6,
      maxSteps: opts.maxSteps ?? 12,
      coastHitKm: opts.coastHitKm ?? 5,
      maxTotalDistanceKm: opts.maxTotalDistanceKm ?? 200,
      resampleEverySteps: opts.resampleEverySteps ?? 4,
    }
  );
  return {
    bearingDeg: Math.round(sim.bearingDeg),
    directionLabel: cardinalLabel(sim.bearingDeg),
    durationHours: sim.durationHours,
    durationLabel: formatDurationHours(sim.durationHours),
    distanceKm: Math.round(sim.totalDistanceKm * 10) / 10,
    trajectory: sim.trajectory,
    destination: sim.destination,
  };
}
