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
} from "firebase/firestore";
import { db } from "@/firebase";
import type { ArusPencemaranResult } from "@/app/types/maritime";

/**
 * Riwayat prediksi penyebaran limbah (collection `driftPredictions`),
 * disimpan per pengguna di Firestore agar bisa dilihat kembali.
 */

export interface DriftHistoryEntry {
  id?: string;
  uid: string;
  regionName: string;
  destinationLabel: string;
  durationLabel: string;
  result: ArusPencemaranResult;
  /** Firestore Timestamp atau ISO string */
  createdAt?: unknown;
}

/** Strip fields Firestore cannot store (undefined / functions). */
function sanitize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Subsample agar panjang array tetap terkendali (Firestore limit 1 MiB). */
function subsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = Math.ceil(arr.length / max);
  return arr.filter((_, i) => i % step === 0 || i === arr.length - 1);
}

/**
 * Versi ringkas hasil analisis untuk Firestore: lintasan & riwayat di-subsample
 * agar dokumen tetap jauh di bawah batas 1 MiB (terutama horizon 14 hari dengan
 * banyak kapal), tanpa mengubah bentuk data — peta & panel tetap bisa membaca.
 */
export function compactResultForHistory(
  result: ArusPencemaranResult,
): ArusPencemaranResult {
  const r = sanitize(result);
  r.trajectory = subsample(r.trajectory ?? [], 48);
  if (r.vesselTracks) {
    r.vesselTracks = r.vesselTracks.map((t) => ({
      ...t,
      passes: subsample(t.passes, 30),
      wasteDrift: t.wasteDrift
        ? {
            ...t.wasteDrift,
            trajectory: subsample(t.wasteDrift.trajectory, 40),
          }
        : t.wasteDrift,
    }));
  }
  if (r.vesselCandidates) {
    r.vesselCandidates = r.vesselCandidates.map((v) => ({
      ...v,
      predicted: v.predicted
        ? { ...v.predicted, trajectory: subsample(v.predicted.trajectory, 40) }
        : v.predicted,
    }));
  }
  if (r.factorySources) {
    r.factorySources = r.factorySources.map((f) => ({
      ...f,
      drift: f.drift
        ? { ...f.drift, trajectory: subsample(f.drift.trajectory, 40) }
        : f.drift,
    }));
  }
  return r;
}

/**
 * Simpan satu hasil prediksi ke riwayat.
 * Melempar error bila gagal (izin Firestore, ukuran dokumen, dll) agar pemakai
 * diberi tahu — tidak disenyapkan seperti sebelumnya.
 */
export async function saveDriftPrediction(
  uid: string,
  payload: Omit<DriftHistoryEntry, "id" | "uid" | "createdAt">,
): Promise<void> {
  await addDoc(collection(db, "driftPredictions"), {
    uid,
    regionName: payload.regionName,
    destinationLabel: payload.destinationLabel,
    durationLabel: payload.durationLabel,
    result: compactResultForHistory(payload.result),
    createdAt: serverTimestamp(),
  });
}

/** Ambil riwayat prediksi milik user, terbaru dulu. */
export async function loadDriftPredictions(
  uid: string,
  max = 30,
): Promise<DriftHistoryEntry[]> {
  try {
    const q = query(
      collection(db, "driftPredictions"),
      where("uid", "==", uid),
      orderBy("createdAt", "desc"),
      limit(max),
    );
    const snap = await getDocs(q);
    return snap.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as DriftHistoryEntry,
    );
  } catch (err) {
    console.warn("loadDriftPredictions failed (Firestore unavailable):", err);
    return [];
  }
}

/** Hapus satu entri riwayat. */
export async function deleteDriftPrediction(
  uid: string,
  id: string,
): Promise<void> {
  try {
    await deleteDoc(doc(db, "driftPredictions", id));
  } catch (err) {
    console.warn("deleteDriftPrediction failed (Firestore unavailable):", err);
  }
}
