import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/firebase";
import type {
  FishQualityAnalysis,
  TangkapanVerificationInput,
  TangkapanVerificationVerdict,
} from "@/app/types/maritime";
import type { FishingFormData } from "@/components/zona-tangkap/FishingForm";

/**
 * Riwayat prediksi kualitas ikan (collection `fishQualityAnalyses`) dan
 * verifikasi kesegaran tangkapan (collection `fishVerifications`), disimpan
 * per pengguna di Firestore agar peneliti bisa melihat kembali hasil
 * prediksi & penilaian kesegaran ikan yang sudah ditangkap.
 */

export interface FishQualityHistoryEntry {
  id?: string;
  uid: string;
  regionName: string;
  /** Parameter form yang menghasilkan analisis (untuk membuka ulang peta). */
  form: FishingFormData;
  /** Hasil analisis kualitas ikan lengkap (Peta + panel tetap bisa dibaca). */
  analysis: FishQualityAnalysis;
  /** Firestore Timestamp atau ISO string */
  createdAt?: unknown;
}

export interface FishVerificationRecord {
  id?: string;
  uid: string;
  /** ID dokumen fishQualityAnalyses bila verifikasi berasal dari prediksi. */
  analysisId?: string | null;
  regionName: string;
  input: TangkapanVerificationInput;
  verdict: TangkapanVerificationVerdict;
  /** Firestore Timestamp atau ISO string */
  createdAt?: unknown;
}

/** Strip fields Firestore cannot store (undefined / functions). */
function sanitize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Ringkas citra overlay (PNG data URL 256×256) menjadi 96×96 via canvas agar
 * dokumen Firestore jauh di bawah batas 1 MiB, tanpa mengubah bentuk data —
 * peta tetap bisa menampilkan layer klorofil/SST/pH saat dibuka dari riwayat.
 */
export async function compactAnalysisForHistory(
  analysis: FishQualityAnalysis
): Promise<FishQualityAnalysis> {
  const layers = analysis.layers;
  if (!layers) return analysis;
  try {
    const downscale = async (dataUrl: string): Promise<string | null> => {
      const size = 96;
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('load failed'));
        el.src = dataUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, size, size);
      return canvas.toDataURL('image/png');
    };

    const [chl, sst, ph] = await Promise.all([
      layers.chl && layers.chl.dataUrl ? downscale(layers.chl.dataUrl) : Promise.resolve(null),
      layers.sst && layers.sst.dataUrl ? downscale(layers.sst.dataUrl) : Promise.resolve(null),
      layers.ph && layers.ph.dataUrl ? downscale(layers.ph.dataUrl) : Promise.resolve(null),
    ]);

    return {
      ...analysis,
      layers: {
        ...(chl ? { chl: { ...layers.chl!, dataUrl: chl } } : {}),
        ...(sst ? { sst: { ...layers.sst!, dataUrl: sst } } : {}),
        ...(ph ? { ph: { ...layers.ph!, dataUrl: ph } } : {}),
      },
    };
  } catch (err) {
    console.warn("compactAnalysisForHistory fallback (drop layers):", err);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { layers: _drop, ...rest } = analysis;
    return rest as FishQualityAnalysis;
  }
}

/** Simpan satu hasil prediksi kualitas ikan ke riwayat. */
export async function saveFishQualityAnalysis(
  uid: string,
  payload: Omit<FishQualityHistoryEntry, "id" | "uid" | "createdAt">
): Promise<string> {
  const ref = await addDoc(collection(db, "fishQualityAnalyses"), {
    uid,
    regionName: payload.regionName,
    form: sanitize(payload.form),
    analysis: sanitize(payload.analysis),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Ambil riwayat prediksi kualitas ikan milik user, terbaru dulu. */
export async function loadFishQualityAnalyses(
  uid: string,
  max = 30
): Promise<FishQualityHistoryEntry[]> {
  try {
    const q = query(
      collection(db, "fishQualityAnalyses"),
      where("uid", "==", uid),
      orderBy("createdAt", "desc"),
      limit(max)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FishQualityHistoryEntry);
  } catch (err) {
    console.warn("loadFishQualityAnalyses failed (Firestore unavailable):", err);
    return [];
  }
}

/** Hapus satu entri riwayat prediksi. */
export async function deleteFishQualityAnalysis(uid: string, id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "fishQualityAnalyses", id));
  } catch (err) {
    console.warn("deleteFishQualityAnalysis failed (Firestore unavailable):", err);
  }
}

/**
 * Simpan hasil verifikasi kesegaran tangkapan; bila user sudah memverifikasi
 * prediksi yang sama (analysisId), lampirkan ke dokumen riwayat agar
 * analisisnya ikut terbawa saat dibuka kembali.
 */
export async function saveFishVerification(
  uid: string,
  payload: Omit<FishVerificationRecord, "id" | "uid" | "createdAt">
): Promise<string> {
  const ref = await addDoc(collection(db, "fishVerifications"), {
    uid,
    analysisId: payload.analysisId ?? null,
    regionName: payload.regionName,
    input: sanitize(payload.input),
    verdict: sanitize(payload.verdict),
    createdAt: serverTimestamp(),
  });
  if (payload.analysisId) {
    try {
      await updateDoc(doc(db, "fishQualityAnalyses", payload.analysisId), {
        verifications: arrayUnion({
          refId: ref.id,
          verdict: sanitize(payload.verdict),
          input: sanitize(payload.input),
        }),
      });
    } catch (err) {
      console.warn("attachVerificationToHistory failed:", err);
    }
  }
  return ref.id;
}

/** Ambil riwayat verifikasi kesegaran milik user, terbaru dulu. */
export async function loadFishVerifications(
  uid: string,
  max = 30
): Promise<FishVerificationRecord[]> {
  try {
    const q = query(
      collection(db, "fishVerifications"),
      where("uid", "==", uid),
      orderBy("createdAt", "desc"),
      limit(max)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FishVerificationRecord);
  } catch (err) {
    console.warn("loadFishVerifications failed (Firestore unavailable):", err);
    return [];
  }
}