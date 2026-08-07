import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/firebase";

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
  const snap = await getDoc(userRef);

  // Only write baseline doc if user doesn't have one in Firestore
  if (!snap.exists()) {
    await setDoc(userRef, {
      uid:              user.uid,
      email:            user.email ?? null,
      displayName:      user.displayName ?? null,
      photoURL:         user.photoURL ?? null,
      provider,
      profileCompleted: false,
      createdAt:        serverTimestamp(),
    });
  }
}

/** Read Firestore role and return the correct redirect path. */
async function resolveRedirect(uid: string): Promise<AuthResult["redirectTo"]> {
  // If running on the server (SSR), skip Firestore call
  if (typeof window === "undefined") {
    return "/fill-form";
  }

  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return "/fill-form";

    const data = snap.data() as Partial<UserProfile>;
    if (!data.profileCompleted || !data.role) return "/fill-form";
    return ROLE_DASHBOARD[data.role] ?? "/fill-form";
  } catch (err) {
    console.error("Firestore redirect check failed (client offline?):", err);
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
 * Sign in / register with Google OAuth popup.
 * Bootstraps Firestore for new users, then resolves role-based redirect.
 */
export async function loginWithGoogle(): Promise<AuthResult> {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    const { user } = await signInWithPopup(auth, provider);

    // Bootstrap doc (safe fallback if Firestore fails)
    try {
      await bootstrapUserDoc(user, "google");
    } catch (fsErr) {
      console.warn("Bootstrap Firestore doc failed during Google login:", fsErr);
    }

    const redirectTo = await resolveRedirect(user.uid);
    return { user, redirectTo };
  } catch (err: unknown) {
    console.error("Google Auth error details:", err);
    const code = (err as { code?: string })?.code;
    const message = (err as { message?: string })?.message;
    throw new Error(resolveError(code, message));
  }
}

/** Sign out the current user. */
export async function logout(): Promise<void> {
  await signOut(auth);
}

/** Subscribe to Firebase auth state changes. */
export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Persist the completed user profile to Firestore.
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

  await setDoc(doc(db, "users", uid), {
    ...cleanedData,
    profileCompleted:   true,
    profileCompletedAt: serverTimestamp(),
  });
}

/**
 * Fetch a user's full profile from Firestore.
 * Returns null if the document doesn't exist.
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;
    return snap.data() as UserProfile;
  } catch (err) {
    console.error("getUserProfile failed (Firestore offline/permission issue?):", err);
    return null;
  }
}

/**
 * Checks if a user is logged in, and redirects them to their active dashboard or fill-form.
 */
export async function redirectUserIfLoggedIn(uid: string, routerPush: (path: string) => void): Promise<void> {
  const target = await resolveRedirect(uid);
  routerPush(target);
}