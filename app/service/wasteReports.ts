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

/** Simpan laporan; bila laporan identik sudah ada dalam sebulan terakhir, lewati. */
export async function saveWasteReport(
  uid: string,
  payload: Omit<WasteReportEntry, 'id' | 'uid' | 'createdAt'>
): Promise<WasteReportSaveResult> {
  try {
    if (payload.reportKey) {
      const existing = await getDocs(
        query(
          collection(db, 'wasteReports'),
          where('uid', '==', uid),
          where('reportKey', '==', payload.reportKey),
          limit(1)
        )
      );
      if (!existing.empty) {
        return { id: existing.docs[0].id, duplicate: true };
      }
    }
    const ref = await addDoc(collection(db, 'wasteReports'), {
      uid,
      reporterName: payload.reporterName,
      location: sanitize(payload.location),
      wasteType: payload.wasteType,
      description: payload.description,
      photoThumbs: sanitize(payload.photoThumbs),
      capturedAt: payload.capturedAt,
      exif: sanitize(payload.exif ?? null),
      validation: sanitize(payload.validation),
      reportKey: payload.reportKey ?? null,
      createdAt: serverTimestamp(),
    });
    return { id: ref.id, duplicate: false };
  } catch (err) {
    console.warn('saveWasteReport failed (Firestore unavailable):', err);
    throw err;
  }
}

/** Ambil laporan terbaru (untuk peneliti — semua pelapor). */
export async function loadWasteReports(max = 100): Promise<WasteReportEntry[]> {
  try {
    const q = query(collection(db, 'wasteReports'), orderBy('createdAt', 'desc'), limit(max));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WasteReportEntry);
  } catch (err) {
    console.warn('loadWasteReports failed (Firestore unavailable):', err);
    return [];
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