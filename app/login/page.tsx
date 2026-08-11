'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { loginWithEmail, loginWithGoogle, onAuthChange, redirectUserIfLoggedIn, checkGoogleRedirectResult } from '@/app/service/authentication';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState<'email' | 'google' | null>(null);

  // Redirect if already logged in or process redirect auth result
  useEffect(() => {
    checkGoogleRedirectResult().then((res) => {
      if (res) {
        router.push(res.redirectTo);
      }
    });

    const unsubscribe = onAuthChange((user) => {
      if (user) {
        redirectUserIfLoggedIn(user.uid, router.push);
      }
    });
    return () => unsubscribe();
  }, [router]);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading('email');
    try {
      const { redirectTo } = await loginWithEmail(email, password);
      router.push(redirectTo);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setLoading(null);
    }
  }

  async function handleGoogleLogin() {
    setError('');
    setLoading('google');
    try {
      const { redirectTo } = await loginWithGoogle();
      router.push(redirectTo);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setLoading(null);
    }
  }

  const busy = loading !== null;

  return (
    <div className="min-h-screen flex bg-zinc-950">
      {/* ── Left brand panel ─────────────────────────────── */}
      <aside className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0 z-0">
          <img
            src="/img/login.webp"
            alt="Oceanagara background"
            className="w-full h-full object-cover opacity-60"
          />
          {/* Overlay gradient to ensure contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-zinc-950/80" />
        </div>

        <div className="relative z-10">
          <Link href="/" className="text-white text-sm font-bold tracking-widest uppercase flex items-center gap-3">
            <span className="w-6 h-px bg-white block" />
            OCEANAGARA
          </Link>
        </div>

        <div className="relative z-10 space-y-6">
          <p className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">Platform Kelautan</p>
          <h2 className="text-4xl font-extrabold text-white leading-tight tracking-tight uppercase">
            Cerdas Memantau,<br />
            Aman Berlayar,<br />
            Mutu Terjaga.
          </h2>
          <p className="text-sm text-zinc-300 leading-relaxed max-w-xs">
            Masuk ke platform dan nikmati pemantauan kapal real-time, navigasi aman, dan log hasil laut digital.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-4">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`h-px ${i === 0 ? 'w-8 bg-white' : 'w-4 bg-zinc-500'}`} />
            ))}
          </div>
          <span className="text-[10px] text-zinc-400 uppercase tracking-widest">Oceanagara &copy; 2025</span>
        </div>
      </aside>

      {/* ── Right form panel ─────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center p-6 md:p-12 bg-white">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <Link href="/" className="text-zinc-900 text-sm font-bold tracking-widest uppercase">
              OCEANAGARA
            </Link>
          </div>

          {/* Header */}
          <div className="mb-10">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Selamat Datang</p>
            <h1 className="text-2xl font-extrabold text-zinc-900 uppercase tracking-tight">Masuk ke Akun</h1>
            <p className="mt-2 text-xs text-zinc-500">
              Belum punya akun?{' '}
              <Link href="/signup" className="font-bold text-zinc-900 underline underline-offset-2 hover:text-zinc-600 transition-colors">
                Daftar sekarang
              </Link>
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 px-4 py-3 border border-red-200 bg-red-50 text-red-700 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Google login */}
          <button
            id="login-google"
            type="button"
            onClick={handleGoogleLogin}
            disabled={busy}
            className="w-full mb-5 flex items-center justify-center gap-3 px-4 py-3 border border-zinc-300 bg-white text-zinc-700 text-xs font-bold uppercase tracking-widest hover:border-zinc-900 hover:text-zinc-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'google' ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" strokeWidth="3" strokeDasharray="30 70" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            Masuk dengan Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-5">
            <div className="flex-1 h-px bg-zinc-200" />
            <span className="text-[10px] text-zinc-400 uppercase tracking-widest">atau</span>
            <div className="flex-1 h-px bg-zinc-200" />
          </div>

          {/* Email form */}
          <form onSubmit={handleEmailLogin} noValidate className="space-y-5">
            <div>
              <label htmlFor="login-email" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full px-4 py-3 border border-zinc-300 bg-white text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="login-password" className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="text-[10px] text-zinc-400 uppercase tracking-widest hover:text-zinc-900 transition-colors"
                >
                  {showPw ? 'Sembunyikan' : 'Tampilkan'}
                </button>
              </div>
              <input
                id="login-password"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                className="w-full px-4 py-3 border border-zinc-300 bg-white text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
              />
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={busy}
              className="w-full py-3.5 bg-zinc-900 text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading === 'email' ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" strokeWidth="3" strokeDasharray="30 70" />
                  </svg>
                  Memproses...
                </>
              ) : (
                <>
                  Masuk
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Back */}
          <div className="mt-8 text-center">
            <Link
              href="/"
              className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest hover:text-zinc-900 transition-colors inline-flex items-center gap-2"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
              </svg>
              Kembali ke Beranda
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
