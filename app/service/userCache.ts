import type { UserProfile } from "./authentication";

/**
 * Client-side user profile cache.
 * Layer 1: in-memory Map (fast within a page session).
 * Layer 2: localStorage (survives reloads & navigations between dashboards).
 * Entries expire after TTL_MS to avoid serving stale profile data forever.
 */

const TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  profile: UserProfile;
  fetchedAt: number;
}

const MEMORY: Record<string, CacheEntry> = {};

function storageKey(uid: string): string {
  return `oceanagara:user:${uid}`;
}

/** Read from memory, then localStorage. Returns null when absent or expired. */
export function getCachedUserProfile(uid: string, ignoreTtl = false): UserProfile | null {
  if (typeof window === "undefined") return null;

  const fresh = (entry: CacheEntry) => ignoreTtl || Date.now() - entry.fetchedAt < TTL_MS;

  const mem = MEMORY[uid];
  if (mem && fresh(mem)) return mem.profile;

  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (raw) {
      const entry = JSON.parse(raw) as CacheEntry;
      if (entry?.profile && fresh(entry)) {
        MEMORY[uid] = entry;
        return entry.profile;
      }
      localStorage.removeItem(storageKey(uid));
    }
  } catch {
    // storage unavailable (SSR/private mode) → ignore
  }

  return null;
}

/** Store a fetched profile into memory + localStorage. */
export function setCachedUserProfile(uid: string, profile: UserProfile): void {
  const entry: CacheEntry = { profile, fetchedAt: Date.now() };
  MEMORY[uid] = entry;
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(entry));
  } catch {
    // storage unavailable → memory-only cache
  }
}

/** Drop the cache for a uid (profile updated, logout, etc.). */
export function invalidateUserProfile(uid: string): void {
  delete MEMORY[uid];
  try {
    localStorage.removeItem(storageKey(uid));
  } catch {
    // ignore
  }
}
