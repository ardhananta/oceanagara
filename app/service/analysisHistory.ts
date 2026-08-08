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
import type {
  GfwVesselEvent,
  LocationQuery,
  RiskAnalysisResult,
  SatelliteAnalysis,
  SatelliteSolidWasteAnalysis,
} from '@/app/types/maritime';
import type { NearbySource } from '@/components/peta-risiko/sources';

/**
 * Riwayat analisis risiko pencemaran, disimpan per pengguna di Firestore
 * (collection `riskAnalyses`). Memungkinkan peneliti melihat kembali hasil
 * analisis sebelumnya langsung dari halaman Peta Risiko.
 */

export interface AnalysisHistoryEntry {
  id?: string;
  uid: string;
  regionName: string;
  overallRiskLevel: RiskAnalysisResult['overallRiskLevel'];
  result: RiskAnalysisResult;
  location: LocationQuery;
  vessels: GfwVesselEvent[];
  nearbySources: NearbySource[];
  /** Analisis citra satelit NASA GIBS (opsional) */
  satellite?: SatelliteAnalysis;
  /** Deteksi sampah padat terapung Sentinel-2 (opsional) */
  solidWaste?: SatelliteSolidWasteAnalysis;
  /** Firestore Timestamp atau ISO string */
  createdAt?: unknown;
}

/** Strip fields Firestore cannot store (undefined / functions). */
function sanitize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Simpan satu hasil analisis ke riwayat (best-effort). */
export async function saveAnalysisHistory(
  uid: string,
  payload: Omit<AnalysisHistoryEntry, 'id' | 'uid' | 'createdAt'>
): Promise<void> {
  try {
    await addDoc(collection(db, 'riskAnalyses'), {
      uid,
      regionName: payload.regionName,
      overallRiskLevel: payload.overallRiskLevel,
      result: sanitize(payload.result),
      location: sanitize(payload.location),
      vessels: sanitize(payload.vessels ?? []),
      nearbySources: sanitize(payload.nearbySources ?? []),
      satellite: payload.satellite ? sanitize(payload.satellite) : null,
      solidWaste: payload.solidWaste ? sanitize(payload.solidWaste) : null,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('saveAnalysisHistory skipped (Firestore unavailable):', err);
  }
}

/** Ambil riwayat analisis milik user, terbaru dulu. */
export async function loadAnalysisHistory(uid: string, max = 30): Promise<AnalysisHistoryEntry[]> {
  try {
    const q = query(
      collection(db, 'riskAnalyses'),
      where('uid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(max)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AnalysisHistoryEntry);
  } catch (err) {
    console.warn('loadAnalysisHistory failed (Firestore unavailable):', err);
    return [];
  }
}

/** Hapus satu entri riwayat. */
export async function deleteAnalysisHistory(uid: string, id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'riskAnalyses', id));
  } catch (err) {
    console.warn('deleteAnalysisHistory failed (Firestore unavailable):', err);
  }
}

/** Format tanggal dari Firestore Timestamp / ISO string. */
export function formatHistoryDate(value: unknown): string {
  if (!value) return '—';
  const t = value as { toDate?: () => Date };
  const date = typeof t.toDate === 'function' ? t.toDate() : new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}
