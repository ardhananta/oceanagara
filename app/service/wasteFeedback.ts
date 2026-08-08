import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase';

/**
 * Umpan balik verifikasi lapangan untuk kandidat sampah padat terapung
 * (collection `wasteFeedback`). Setiap peneliti bisa mengonfirmasi sebuah
 * kandidat sebagai "tervalidasi" (benar ada limbah) atau "bukan limbah"
 * (false positive). Akurasi aktual dihitung dari kumpulan laporan ini.
 */

export type WasteVerdict = 'confirmed' | 'rejected';

export interface WasteFeedback {
  id?: string;
  uid: string;
  /** Identitas kandidat (lat & lon dibulatkan 3 desimal) agar laporan dari analisis berbeda bertumpuk */
  candidateKey: string;
  lat: number;
  lon: number;
  verdict: WasteVerdict;
  note?: string;
  createdAt?: unknown;
}

/** Statistik akurasi terverifikasi dari semua laporan. */
export interface WasteFeedbackStats {
  confirmed: number;
  rejected: number;
  /** Akurasi = confirmed / (confirmed + rejected), 0-1 (null bila belum ada laporan) */
  accuracy: number | null;
  total: number;
}

/** Simpan laporan verifikasi; kalau user sudah menilai kandidat ini, perbarui. */
export async function saveWasteFeedback(payload: Omit<WasteFeedback, 'id' | 'createdAt'>): Promise<void> {
  try {
    const existing = await getDocs(
      query(
        collection(db, 'wasteFeedback'),
        where('uid', '==', payload.uid),
        where('candidateKey', '==', payload.candidateKey),
        limit(1)
      )
    );
    if (!existing.empty) {
      const ref = doc(db, 'wasteFeedback', existing.docs[0].id);
      await updateDoc(ref, { verdict: payload.verdict, note: payload.note ?? null });
      return;
    }
    await addDoc(collection(db, 'wasteFeedback'), {
      ...payload,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('saveWasteFeedback skipped (Firestore unavailable):', err);
  }
}

/** Laporan verifikasi user saat ini untuk kandidat-kandidat tertentu. */
export async function loadMyFeedback(uid: string, candidateKeys: string[]): Promise<WasteFeedback[]> {
  const keys = [...new Set(candidateKeys)];
  if (keys.length === 0 || !uid) return [];
  try {
    const out: WasteFeedback[] = [];
    // Firestore `in` maksimal 10 nilai per query
    for (let i = 0; i < keys.length; i += 10) {
      const chunk = keys.slice(i, i + 10);
      const snap = await getDocs(
        query(collection(db, 'wasteFeedback'), where('uid', '==', uid), where('candidateKey', 'in', chunk))
      );
      snap.docs.forEach((d) => out.push({ id: d.id, ...d.data() } as WasteFeedback));
    }
    return out;
  } catch (err) {
    console.warn('loadMyFeedback failed (Firestore unavailable):', err);
    return [];
  }
}

/** Statistik akurasi terverifikasi global (semua peneliti). */
export async function loadWasteFeedbackStats(): Promise<WasteFeedbackStats> {
  const stats: WasteFeedbackStats = { confirmed: 0, rejected: 0, accuracy: null, total: 0 };
  try {
    const snap = await getDocs(query(collection(db, 'wasteFeedback'), limit(1000)));
    snap.docs.forEach((d) => {
      const v = (d.data() as WasteFeedback).verdict;
      if (v === 'confirmed') stats.confirmed++;
      else if (v === 'rejected') stats.rejected++;
    });
    stats.total = stats.confirmed + stats.rejected;
    stats.accuracy = stats.total > 0 ? stats.confirmed / stats.total : null;
    return stats;
  } catch (err) {
    console.warn('loadWasteFeedbackStats failed (Firestore unavailable):', err);
    return stats;
  }
}

/** Hapus laporan verifikasi sendiri (opsional, untuk koreksi). */
export async function deleteWasteFeedback(uid: string, id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'wasteFeedback', id));
  } catch (err) {
    console.warn('deleteWasteFeedback failed (Firestore unavailable):', err);
  }
}
