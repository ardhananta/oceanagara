import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/firebase";
import type { WaveRegionPoint, WindFieldGrid, WindFieldMeta } from "@/components/dashboard/wave/types";

/**
 * Persists the last successfully-fetched BMKG maritime data to Firestore
 * (collection `maritimeCache`), so the dashboard can:
 *  - show last-known data instantly while fresh data loads, and
 *  - keep working when BMKG is unreachable.
 */

export interface MaritimeCacheSnapshot {
  points?: WaveRegionPoint[];
  grid?: WindFieldGrid;
  meta?: WindFieldMeta;
  /** Firestore Timestamp or ISO string */
  savedAt?: unknown;
}

/** Strip fields Firestore cannot store (undefined / functions). */
function sanitize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Write the latest region telemetry + wind grid to Firestore (best-effort). */
export async function saveMaritimeCache(
  points: WaveRegionPoint[],
  grid: WindFieldGrid | null,
  meta: WindFieldMeta | null
): Promise<void> {
  try {
    await Promise.all([
      setDoc(doc(db, "maritimeCache", "regionPoints"), {
        points: sanitize(points),
        savedAt: serverTimestamp(),
      }, { merge: true }),
      setDoc(doc(db, "maritimeCache", "windField"), {
        grid: sanitize(grid),
        meta: sanitize(meta),
        savedAt: serverTimestamp(),
      }, { merge: true }),
    ]);
  } catch (err) {
    console.warn("saveMaritimeCache skipped (Firestore unavailable):", err);
  }
}

/** Read the last persisted BMKG snapshot, if any. */
export async function loadMaritimeCache(): Promise<MaritimeCacheSnapshot | null> {
  try {
    const [pointSnap, gridSnap] = await Promise.all([
      getDoc(doc(db, "maritimeCache", "regionPoints")),
      getDoc(doc(db, "maritimeCache", "windField")),
    ]);

    const snapshot: MaritimeCacheSnapshot = {};
    if (pointSnap.exists()) {
      const data = pointSnap.data();
      if (Array.isArray(data?.points) && data.points.length > 0) {
        snapshot.points = data.points as WaveRegionPoint[];
      }
      if (data?.savedAt) snapshot.savedAt = data.savedAt;
    }
    if (gridSnap.exists()) {
      const data = gridSnap.data();
      if (data?.grid?.uData?.length && data?.grid?.vData?.length) {
        snapshot.grid = data.grid as WindFieldGrid;
        if (data?.meta) snapshot.meta = data.meta as WindFieldMeta;
      }
    }

    return snapshot.points || snapshot.grid ? snapshot : null;
  } catch (err) {
    console.warn("loadMaritimeCache failed (Firestore unavailable):", err);
    return null;
  }
}
