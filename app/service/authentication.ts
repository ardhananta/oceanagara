import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  updateProfile,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { doc, getDoc, getDocFromCache, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/firebase";
import { getCachedUserProfile, invalidateUserProfile, setCachedUserProfile } from "./userCache";

// ─── Types ───────────────────────────────────────────────────────────────────

export type UserRole = "nelayan" | "nelayan-modern" | "masyarakat" | "peneliti";

export type DashboardPath =
  | "/dashboard/nelayan"
  | "/dashboard/nelayan-modern"
  | "/dashboard/masyarakat"
  | "/dashboard/peneliti";

export interface AuthResult {
  user: User;
  redirectTo: "/fill-form" | DashboardPath;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  role?: UserRole;
  provider: "email" | "google";
  profileCompleted: boolean;
  // contact
  noHP?: string;
  provinsi?: string;
  kota?: string;
  alamat?: string;
  // timestamps
  createdAt?: unknown;
  profileCompletedAt?: unknown;
  // role-specific — typed loosely; pages cast as needed
  [key: string]: unknown;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const ROLE_DASHBOARD: Record<UserRole, DashboardPath> = {
  "nelayan":        "/dashboard/nelayan",
  "nelayan-modern": "/dashboard/peneliti",
  "masyarakat":     "/dashboard/masyarakat",
  "peneliti":       "/dashboard/peneliti",
};

/** Exponential backoff retry helper for transient network/Firestore channel disconnects */
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 300
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

function resolveError(code: string | undefined, message?: string): string {
  const map: Record<string, string> = {
    // Auth errors
    "auth/invalid-credential":                  "Email atau password salah.",
    "auth/wrong-password":                      "Email atau password salah.",
    "auth/user-not-found":                      "Email atau password salah.",
    "auth/email-already-in-use":                "Email sudah terdaftar. Silakan login.",
    "auth/weak-password":                       "Password terlalu lemah. Gunakan minimal 6 karakter.",
    "auth/invalid-email":                       "Format email tidak valid.",
    "auth/too-many-requests":                   "Terlalu banyak percobaan. Coba lagi beberapa saat.",
    "auth/popup-closed-by-user":                "Login dibatalkan oleh pengguna.",
    "auth/cancelled-popup-request":             "Permintaan login dibatalkan.",
    "auth/popup-blocked":                       "Popup diblokir oleh browser. Harap izinkan popup di browser Anda dan coba lagi.",
    "auth/unauthorized-domain":                 "Domain ini belum diizinkan di Firebase Console (Authentication > Settings > Authorized domains).",
    "auth/operation-not-allowed":               "Metode login Google belum diaktifkan di Firebase Console (Authentication > Sign-in method).",
    "auth/account-exists-with-different-credential": "Akun dengan email ini sudah terdaftar menggunakan metode login lain.",
    "auth/credential-already-in-use":           "Kredensial Google ini sudah digunakan oleh akun pengguna lain.",
    "auth/auth-domain-config-required":         "Konfigurasi authDomain Firebase belum sesuai.",
    "auth/network-request-failed":              "Koneksi jaringan terputus. Periksa jaringan internet Anda.",
    "auth/internal-error":                      "Terjadi kesalahan internal pada Firebase Auth. Coba lagi.",
    // Firestore errors
    "permission-denied":                        "Akses database (Firestore) ditolak. Periksa Firestore Security Rules.",
    "unavailable":                              "Layanan Firestore sedang tidak tersedia.",
  };

  if (code && map[code]) {
    return map[code];
  }

  if (code) {
    return `Gagal autentikasi (${code}): ${message ?? "Terjadi kesalahan. Silakan coba lagi."}`;
  }

  return message || "Terjadi kesalahan. Silakan coba lagi.";
}

/** Create a base Firestore document right after account creation if it doesn't exist yet. */
async function bootstrapUserDoc(
  user: User,
  provider: "email" | "google"
): Promise<void> {
  const userRef = doc(db, "users", user.uid);
  const snap = await executeWithRetry(() => getDoc(userRef)).catch(() => null);

  // Only write baseline doc if user doesn't have one in Firestore
  if (snap && !snap.exists()) {
    await executeWithRetry(() => setDoc(userRef, {
      uid:              user.uid,
      email:            user.email ?? null,
      displayName:      user.displayName ?? null,
      photoURL:         user.photoURL ?? null,
      provider,
      profileCompleted: false,
      createdAt:        serverTimestamp(),
    })).catch((fsErr) => console.warn("Bootstrap Firestore doc failed:", fsErr));
  }
}

/** Read Firestore role and return the correct redirect path. Cache-first + retry resilient + cache fallback. */
async function resolveRedirect(uid: string): Promise<AuthResult["redirectTo"]> {
  // If running on the server (SSR), skip Firestore call
  if (typeof window === "undefined") {
    return "/fill-form";
  }

  // 1. Fast path: check fresh client-side cache
  const cached = getCachedUserProfile(uid);
  if (cached && cached.profileCompleted && cached.role) {
    return ROLE_DASHBOARD[cached.role] ?? "/fill-form";
  }

  // 2. Retry-resilient query to Firestore server
  try {
    const snap = await executeWithRetry(() => getDoc(doc(db, "users", uid)));
    if (!snap.exists()) return "/fill-form";

    const data = snap.data() as UserProfile;
    if (!data.profileCompleted || !data.role) return "/fill-form";

    setCachedUserProfile(uid, data);
    return ROLE_DASHBOARD[data.role] ?? "/fill-form";
  } catch (err) {
    console.warn("Firestore server redirect check failed, trying Firestore local cache:", err);

    // Try reading directly from Firestore's local cache if network/WebChannel channel closed during macOS fullscreen
    try {
      const cacheSnap = await getDocFromCache(doc(db, "users", uid));
      if (cacheSnap.exists()) {
        const data = cacheSnap.data() as UserProfile;
        if (data.profileCompleted && data.role) {
          setCachedUserProfile(uid, data);
          return ROLE_DASHBOARD[data.role] ?? "/fill-form";
        }
      }
    } catch (cacheErr) {
      console.warn("Firestore local cache read failed:", cacheErr);
    }

    // 3. Fallback to any cached copy (even if expired) before defaulting to /fill-form
    const expiredCached = getCachedUserProfile(uid, true);
    if (expiredCached && expiredCached.profileCompleted && expiredCached.role) {
      return ROLE_DASHBOARD[expiredCached.role] ?? "/fill-form";
    }

    return "/fill-form";
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Sign in with email and password → role-based redirect. */
export async function loginWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    const redirectTo = await resolveRedirect(user.uid);
    return { user, redirectTo };
  } catch (err: unknown) {
    console.error("Email login error details:", err);
    const code = (err as { code?: string })?.code;
    const message = (err as { message?: string })?.message;
    throw new Error(resolveError(code, message));
  }
}

/**
 * Register with email + password.
 * Immediately writes a base Firestore document, then redirects to /fill-form.
 */
export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<AuthResult> {
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName.trim()) {
      await updateProfile(user, { displayName: displayName.trim() });
    }
    try {
      await bootstrapUserDoc(user, "email");
    } catch (fsErr) {
      console.warn("Bootstrap Firestore doc failed (ignored):", fsErr);
    }
    return { user, redirectTo: "/fill-form" };
  } catch (err: unknown) {
    console.error("Email registration error details:", err);
    const code = (err as { code?: string })?.code;
    const message = (err as { message?: string })?.message;
    throw new Error(resolveError(code, message));
  }
}

/**
 * Sign in / register with Google OAuth popup. Fallback to redirect if popup is blocked.
 * Bootstraps Firestore for new users, then resolves role-based redirect.
 */
export async function loginWithGoogle(): Promise<AuthResult> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  let user: User;
  try {
    const result = await signInWithPopup(auth, provider);
    user = result.user;
  } catch (err: unknown) {
    console.warn("Google Auth popup error details:", err);
    const code = (err as { code?: string })?.code;
    const message = (err as { message?: string })?.message;

    if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request") {
      await signInWithRedirect(auth, provider);
      return new Promise(() => {});
    }

    throw new Error(resolveError(code, message));
  }

  // Bootstrap doc (safe fallback if Firestore fails)
  try {
    await bootstrapUserDoc(user, "google");
  } catch (fsErr) {
    console.warn("Bootstrap Firestore doc failed during Google login:", fsErr);
  }

  const redirectTo = await resolveRedirect(user.uid);
  return { user, redirectTo };
}

/** Helper to process pending Google OAuth redirect result on app load if signInWithRedirect was used. */
export async function checkGoogleRedirectResult(): Promise<AuthResult | null> {
  try {
    const result = await getRedirectResult(auth);
    if (!result?.user) return null;
    await bootstrapUserDoc(result.user, "google");
    const redirectTo = await resolveRedirect(result.user.uid);
    return { user: result.user, redirectTo };
  } catch (err) {
    console.error("Google redirect result error:", err);
    return null;
  }
}

/** Fast, instant sign out for the current user. */
export async function logout(): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (uid) invalidateUserProfile(uid);

  try {
    if (typeof window !== "undefined") {
      localStorage.removeItem(`oceanagara:user:${uid}`);
      sessionStorage.clear();
    }
  } catch {
    // ignore storage access errors
  }

  // Execute Firebase signOut asynchronously in background without blocking caller UI thread
  signOut(auth).catch((err) => console.warn("Background signOut error:", err));
}

/** Subscribe to Firebase auth state changes. */
export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Persist the completed user profile to Firestore with retries.
 * Sets profileCompleted: true so future logins redirect to the dashboard.
 */
export async function saveUserProfile(
  uid: string,
  data: Record<string, unknown>
): Promise<void> {
  const cleanedData: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    cleanedData[key] = val === undefined ? null : val;
  }

  await executeWithRetry(() =>
    setDoc(doc(db, "users", uid), {
      ...cleanedData,
      profileCompleted:   true,
      profileCompletedAt: serverTimestamp(),
    })
  );

  // Profile just changed → never serve the stale cached copy
  invalidateUserProfile(uid);
}

/**
 * Fetch a user's full profile from Firestore (cache-first + retry-resilient + local cache fallback).
 * Returns null if the document doesn't exist.
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  // Cache-first: dashboards fetch the profile on every auth change
  const cached = getCachedUserProfile(uid);
  if (cached) return cached;

  try {
    const snap = await executeWithRetry(() => getDoc(doc(db, "users", uid)));
    if (!snap.exists()) return null;
    const profile = snap.data() as UserProfile;
    setCachedUserProfile(uid, profile);
    return profile;
  } catch (err) {
    console.warn("getUserProfile server fetch failed, trying Firestore local cache:", err);
    try {
      const cacheSnap = await getDocFromCache(doc(db, "users", uid));
      if (cacheSnap.exists()) {
        const profile = cacheSnap.data() as UserProfile;
        setCachedUserProfile(uid, profile);
        return profile;
      }
    } catch {
      // ignore
    }
    return getCachedUserProfile(uid, true);
  }
}

/**
 * Checks if a user is logged in, and redirects them to their active dashboard or fill-form.
 */
export async function redirectUserIfLoggedIn(uid: string, routerPush: (path: string) => void): Promise<void> {
  const target = await resolveRedirect(uid);
  routerPush(target);
}