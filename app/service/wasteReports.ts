import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase';
import type { WasteReport, WasteValidationStatus } from '@/app/types/maritime';

/**
 * Laporan limbah warga (collection `wasteReports`) — foto + lokasi GPS + hasil
 * validasi AI, disimpan per pengguna namun bisa dibaca publik (peneliti).
 */

export interface WasteReportEntry extends WasteReport {
  id: string;
  createdAt?: unknown;
}

export interface WasteReportSaveResult {
  id: string;
  /** true bila laporan sudah pernah dikirim (deduplikasi) */
  duplicate: boolean;
}

/** Hash sederhana string (untuk kunci deduplikasi, bukan kriptografi). */
function simpleHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(36);
}

/** Kunci deduplikasi: bulan + koordinat (3 desimal) + hash foto pertama. */
export function buildReportKey(lat: number, lon: number, thumbs: string[]): string {
  const month = new Date().toISOString().slice(0, 7);
  const photoHash = thumbs[0] ? simpleHash(thumbs[0].slice(-120)) : 'nofoto';
  return `${month}@${lat.toFixed(3)},${lon.toFixed(3)}@${photoHash}`;
}

/** Strip fields yang tidak bisa disimpan Firestore. */
function sanitize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const LOCAL_CACHE_KEY = 'oceanagara_waste_reports_cache_v1';

function getLocalCache(): WasteReportEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToLocalCache(entry: WasteReportEntry) {
  if (typeof window === 'undefined') return;
  try {
    const current = getLocalCache();
    const updated = [entry, ...current.filter((r) => r.id !== entry.id && r.reportKey !== entry.reportKey)].slice(0, 100);
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore quota errors
  }
}

/** Simpan laporan; bila laporan identik sudah ada dalam sebulan terakhir, lewati. */
export async function saveWasteReport(
  uid: string,
  payload: Omit<WasteReportEntry, 'id' | 'uid' | 'createdAt'>
): Promise<WasteReportSaveResult> {
  const sanitizedDoc = {
    uid,
    reporterName: payload.reporterName,
    location: sanitize(payload.location),
    wasteType: payload.wasteType,
    description: payload.description,
    photoThumbs: sanitize(payload.photoThumbs),
    capturedAt: payload.capturedAt || new Date().toISOString(),
    exif: sanitize(payload.exif ?? null),
    validation: sanitize(payload.validation),
    reportKey: payload.reportKey || undefined,
  };

  try {
    if (payload.reportKey) {
      const existing = await getDocs(
        query(
          collection(db, 'wasteReports'),
          where('uid', '==', uid),
          where('reportKey', '==', payload.reportKey),
          limit(1)
        )
      ).catch(() => null);
      if (existing && !existing.empty) {
        const id = existing.docs[0].id;
        saveToLocalCache({ id, ...sanitizedDoc, createdAt: new Date().toISOString() });
        return { id, duplicate: true };
      }
    }

    const ref = await addDoc(collection(db, 'wasteReports'), {
      ...sanitizedDoc,
      createdAt: serverTimestamp(),
    });

    const entry: WasteReportEntry = {
      id: ref.id,
      ...sanitizedDoc,
      createdAt: new Date().toISOString(),
    };
    saveToLocalCache(entry);

    return { id: ref.id, duplicate: false };
  } catch (err) {
    console.warn('saveWasteReport Firestore write warning, caching locally:', err);
    const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const entry: WasteReportEntry = {
      id: tempId,
      ...sanitizedDoc,
      createdAt: new Date().toISOString(),
    };
    saveToLocalCache(entry);
    return { id: tempId, duplicate: false };
  }
}

/** Ambil laporan terbaru (untuk peneliti — semua pelapor). */
export async function loadWasteReports(max = 100): Promise<WasteReportEntry[]> {
  const localItems = getLocalCache();
  try {
    let snap;
    try {
      const q = query(collection(db, 'wasteReports'), orderBy('createdAt', 'desc'), limit(max));
      snap = await getDocs(q);
    } catch {
      // Fallback bila query orderBy gagal / belum ber-indeks
      const qFallback = query(collection(db, 'wasteReports'), limit(max));
      snap = await getDocs(qFallback);
    }

    const remoteItems = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WasteReportEntry);
    const combinedMap = new Map<string, WasteReportEntry>();

    // Masukkan remote dulu
    remoteItems.forEach((item) => combinedMap.set(item.id, item));
    // Masukkan local (bila belum ada di remote)
    localItems.forEach((item) => {
      if (!combinedMap.has(item.id)) {
        combinedMap.set(item.id, item);
      }
    });

    const resultList = Array.from(combinedMap.values());

    return resultList.sort((a, b) => {
      const getTime = (val: unknown) => {
        if (!val) return 0;
        if (typeof val === 'object' && 'seconds' in (val as Record<string, unknown>)) {
          return (val as { seconds: number }).seconds * 1000;
        }
        const parsed = new Date(String(val)).getTime();
        return isNaN(parsed) ? 0 : parsed;
      };
      return getTime(b.createdAt || b.capturedAt) - getTime(a.createdAt || a.capturedAt);
    }).slice(0, max);
  } catch (err) {
    console.warn('loadWasteReports using local cache fallback:', err);
    return localItems.slice(0, max);
  }
}

/** Ambil laporan milik satu pelapor, terbaru dulu. */
export async function loadMyWasteReports(uid: string, max = 50): Promise<WasteReportEntry[]> {
  try {
    const q = query(
      collection(db, 'wasteReports'),
      where('uid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(max)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WasteReportEntry);
  } catch (err) {
    console.warn('loadMyWasteReports failed (Firestore unavailable):', err);
    return [];
  }
}

/** Hapus laporan (hanya milik sendiri). */
export async function deleteWasteReport(uid: string, id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'wasteReports', id));
  } catch (err) {
    console.warn('deleteWasteReport failed (Firestore unavailable):', err);
  }
}

/** Statistik ringkas kumpulan laporan. */
export function wasteReportStats(reports: WasteReportEntry[]): {
  total: number;
  verified: number;
  suspected: number;
  rejected: number;
  pending: number;
} {
  const count = (s: WasteValidationStatus) =>
    reports.filter((r) => r.validation?.status === s).length;
  return {
    total: reports.length,
    verified: count('verified'),
    suspected: count('suspected'),
    rejected: count('rejected'),
    pending: reports.filter((r) => !r.validation?.status).length,
  };
}

/** Kode tampil laporan (WL-YYYYMMDD-xxxx) dari ID dokumen. */
export function reportDisplayCode(id: string): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const suffix = (id.slice(-4) || '0000').toUpperCase();
  return `WL-${ymd}-${suffix}`;
}

/** Format tanggal & jam untuk tampilan. */
export function formatReportDate(value: unknown): string {
  const d = value instanceof Date ? value : new Date(String(value ?? ''));
  if (d.getTime() !== d.getTime()) return '—';
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}