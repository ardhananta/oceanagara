'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthChange, getUserProfile } from '@/app/service/authentication';
import WasteReportSection from '@/components/lapor-limbah/WasteReportSection';

export default function LaporLimbahMasyarakatPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }
      const profile = await getUserProfile(user.uid).catch(() => null);
      if (profile && profile.role && profile.role !== 'masyarakat') {
        const paths: Record<string, string> = {
          nelayan: '/dashboard/nelayan',
          'nelayan-modern': '/dashboard/peneliti',
          peneliti: '/dashboard/peneliti',
        };
        const roleKey = profile.role;
        if (roleKey in paths) {
          router.push(paths[roleKey]);
          return;
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1b365d] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-200 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans flex flex-col selection:bg-[#204473] selection:text-white">
      {/* Header */}
      <header className="bg-[#162e52] text-white shadow-md">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/masyarakat"
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white"
              aria-label="Kembali ke Dashboard"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-sky-200 uppercase tracking-wider">
                  Dashboard Masyarakat
                </span>
                <span className="text-white/40">/</span>
                <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                  Fitur Lapor Limbah
                </span>
              </div>
              <h1 className="text-xl font-extrabold tracking-tight text-white leading-tight">
                Lapor Limbah di Wilayah Pesisir
              </h1>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-emerald-400/15 text-emerald-200 border border-emerald-300/30 text-[10px] font-bold uppercase tracking-wider">
              Validasi AI 3 Lapis
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 md:px-8 py-8">
        <WasteReportSection />
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-6 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4">
          OCEANAGARA &copy; {new Date().getFullYear()} — Portal Informasi Kelautan &amp; Pelaporan Pesisir
        </div>
      </footer>
    </div>
  );
}
