'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { registerWithEmail, loginWithGoogle, onAuthChange, redirectUserIfLoggedIn } from '@/app/service/authentication';

const passwordStrength = (pw: string): 0 | 1 | 2 | 3 => {
  if (pw.length === 0) return 0;
  if (pw.length < 6) return 1;
  if (pw.length < 10 || !/[0-9]/.test(pw)) return 2;
  return 3;
};

const STRENGTH_LABEL = ['', 'Lemah', 'Sedang', 'Kuat'] as const;
const STRENGTH_COLOR = ['', 'bg-red-500', 'bg-amber-400', 'bg-emerald-500'] as const;
const STRENGTH_TEXT = ['', 'text-red-500', 'text-amber-400', 'text-emerald-500'] as const;

export default function SignupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState<'email' | 'google' | null>(null);

  // Redirect if already logged in
  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      if (user) {
        redirectUserIfLoggedIn(user.uid, router.push);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const strength = passwordStrength(password);
  const pwsMatch = confirmPw.length > 0 && confirmPw === password;
  const pwsMismatch = confirmPw.length > 0 && confirmPw !== password;
  const busy = loading !== null;

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) { setError('Nama lengkap wajib diisi.'); return; }
    if (password.length < 6) { setError('Password minimal 6 karakter.'); return; }
    if (password !== confirmPw) { setError('Password dan konfirmasi tidak cocok.'); return; }

    setLoading('email');
    try {
      const { redirectTo } = await registerWithEmail(email, password, fullName);
      router.push(redirectTo);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setLoading(null);
    }
  }

  async function handleGoogleSignup() {
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

  return (
    <div className="min-h-screen flex bg-zinc-950">
      {/* ── Left brand panel ─────────────────────────────── */}
      <aside className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black" />
        <div className="absolute inset-0 z-0">
          <img
            src="/img/login.webp"
            alt="Oceanagara background"
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-zinc-950/80" />
        </div>

        <div className="absolute top-0 left-0 w-px h-full bg-gradient-to-b from-transparent via-zinc-700 to-transparent" />

        <div className="relative z-10">
          <Link href="/" className="text-white text-sm font-bold tracking-widest uppercase flex items-center gap-3">
            <span className="w-6 h-px bg-white block" />
            OCEANAGARA
          </Link>
        </div>

        <div className="relative z-10 space-y-6">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Bergabung Sekarang</p>
          <h2 className="text-4xl font-extrabold text-white leading-tight tracking-tight uppercase">
            Daftarkan Diri<br />
            dan Mulai<br />
            Berlayar.
          </h2>
          <p className="text-sm text-zinc-400 leading-relaxed max-w-xs">
            Buat akun dan identifikasi peran Anda — nelayan profesional atau masyarakat umum.
          </p>

          <div className="space-y-3 pt-2">
            {[
              { step: '01', label: 'Daftar akun' },
              { step: '02', label: 'Isi profil & pilih peran' },
              { step: '03', label: 'Akses dashboard' },
            ].map(({ step, label }) => (
              <div key={step} className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-zinc-600 tabular-nums">{step}</span>
                <div className="w-px h-4 bg-zinc-800" />
                <span className="text-xs text-zinc-400">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-4">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`h-px ${i === 1 ? 'w-8 bg-white' : 'w-4 bg-zinc-700'}`} />
            ))}
          </div>
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Oceanagara &copy; 2025</span>
        </div>
      </aside>

      {/* ── Right form panel ─────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center p-6 md:p-12 bg-white overflow-y-auto">
        <div className="w-full max-w-sm py-8">

          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <Link href="/" className="text-zinc-900 text-sm font-bold tracking-widest uppercase">
              OCEANAGARA
            </Link>
          </div>

          {/* Header */}
          <div className="mb-10">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Langkah 1 dari 2</p>
            <h1 className="text-2xl font-extrabold text-zinc-900 uppercase tracking-tight">Buat Akun Baru</h1>
            <p className="mt-2 text-xs text-zinc-500">
              Sudah punya akun?{' '}
              <Link href="/login" className="font-bold text-zinc-900 underline underline-offset-2 hover:text-zinc-600 transition-colors">
                Masuk di sini
              </Link>
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 px-4 py-3 border border-red-200 bg-red-50 text-red-700 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Google signup */}
          <button
            id="signup-google"
            type="button"
            onClick={handleGoogleSignup}
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
            Daftar dengan Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-5">
            <div className="flex-1 h-px bg-zinc-200" />
            <span className="text-[10px] text-zinc-400 uppercase tracking-widest">atau</span>
            <div className="flex-1 h-px bg-zinc-200" />
          </div>

          {/* Email form */}
          <form onSubmit={handleEmailSignup} noValidate className="space-y-5">
            {/* Full name */}
            <div>
              <label htmlFor="signup-name" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                Nama Lengkap
              </label>
              <input
                id="signup-name"
                type="text"
                autoComplete="name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nama lengkap Anda"
                className="w-full px-4 py-3 border border-zinc-300 bg-white text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="signup-email" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                Email
              </label>
              <input
                id="signup-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full px-4 py-3 border border-zinc-300 bg-white text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="signup-password" className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
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
                id="signup-password"
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 karakter"
                className="w-full px-4 py-3 border border-zinc-300 bg-white text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
              />
              {/* Strength meter */}
              {strength > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex gap-1 flex-1">
                    {([1, 2, 3] as const).map((lvl) => (
                      <div
                        key={lvl}
                        className={`h-0.5 flex-1 transition-colors duration-300 ${strength >= lvl ? STRENGTH_COLOR[strength] : 'bg-zinc-200'}`}
                      />
                    ))}
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${STRENGTH_TEXT[strength]}`}>
                    {STRENGTH_LABEL[strength]}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label htmlFor="signup-confirm" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                Konfirmasi Password
              </label>
              <input
                id="signup-confirm"
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Ulangi password"
                className={`w-full px-4 py-3 border bg-white text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none transition-colors ${pwsMismatch ? 'border-red-300 focus:border-red-500'
                  : pwsMatch ? 'border-emerald-400 focus:border-emerald-500'
                    : 'border-zinc-300 focus:border-zinc-900'
                  }`}
              />
              {pwsMatch && (
                <p className="mt-1.5 text-[10px] text-emerald-600 font-medium uppercase tracking-widest flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Password cocok
                </p>
              )}
            </div>

            <button
              id="signup-submit"
              type="submit"
              disabled={busy}
              className="w-full py-3.5 bg-zinc-900 text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading === 'email' ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" strokeWidth="3" strokeDasharray="30 70" />
                  </svg>
                  Membuat akun...
                </>
              ) : (
                <>
                  Buat Akun
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Terms */}
          <p className="mt-6 text-[10px] text-zinc-400 text-center leading-relaxed">
            Dengan mendaftar, Anda menyetujui{' '}
            <span className="underline underline-offset-2 cursor-pointer hover:text-zinc-700 transition-colors">Syarat &amp; Ketentuan</span>
            {' '}dan{' '}
            <span className="underline underline-offset-2 cursor-pointer hover:text-zinc-700 transition-colors">Kebijakan Privasi</span>
            {' '}Oceanagara.
          </p>

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
