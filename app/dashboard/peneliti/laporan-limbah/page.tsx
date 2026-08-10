'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { onAuthChange, getUserProfile } from '@/app/service/authentication';
import {
  deleteWasteReport,
  loadWasteReports,
  wasteReportStats,
  type WasteReportEntry,
} from '@/app/service/wasteReports';
import ReportList, { type WasteFilter } from '@/components/laporan-limbah/ReportList';
import ReportDetail from '@/components/laporan-limbah/ReportDetail';

const ReportMap = dynamic(() => import('@/components/laporan-limbah/ReportMap'), { ssr: false });

export default function LaporanLimbahPage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('Peneliti');
  const [authLoading, setAuthLoading] = useState(true);
  const [reports, setReports] = useState<WasteReportEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<WasteFilter>('semua');
  const [selected, setSelected] = useState<WasteReportEntry | null>(null);

  useEffect(() => {
    const unsub = onAuthChange(async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }
      const profile = await getUserProfile(user.uid).catch(() => null);
      if (profile && profile.role !== 'peneliti' && profile.role !== 'nelayan-modern') {
        router.push('/dashboard/masyarakat');
        return;
      }
      setUid(user.uid);
      setDisplayName(profile?.displayName || 'Peneliti');
      setAuthLoading(false);
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (authLoading || !uid) return;
    let cancelled = false;
    loadWasteReports(100).then((entries) => {
      if (!cancelled) {
        setReports(entries);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [authLoading, uid]);

  const handleDelete = useCallback(async (id: string) => {
    if (!uid) return;
    await deleteWasteReport(uid, id);
    setSelected(null);
    const entries = await loadWasteReports(100);
    setReports(entries);
  }, [uid]);

  const filtered = filter === 'semua' ? reports : reports.filter((r) => r.validation?.status === filter);
  const stats = wasteReportStats(reports);

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#162e52] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Laporan',
      value: stats.total,
      badgeBg: 'bg-[#162e52] text-white border-sky-400/30',
      numCol: 'text-sky-300',
      bgCard: 'bg-gradient-to-br from-[#152e50] to-[#1e3c66] text-white border-white/10 shadow-lg',
      subText: 'text-sky-100/80',
    },
    {
      label: 'Terverifikasi',
      value: stats.verified,
      badgeBg: 'bg-emerald-500/20 text-emerald-700 border-emerald-300/50',
      numCol: 'text-emerald-600',
      bgCard: 'bg-gradient-to-br from-emerald-50/90 via-white to-emerald-50/40 border-emerald-200/80 shadow-sm',
      subText: 'text-emerald-800',
    },
    {
      label: 'Perlu Diuji',
      value: stats.suspected,
      badgeBg: 'bg-amber-500/20 text-amber-700 border-amber-300/50',
      numCol: 'text-amber-600',
      bgCard: 'bg-gradient-to-br from-amber-50/90 via-white to-amber-50/40 border-amber-200/80 shadow-sm',
      subText: 'text-amber-800',
    },
    {
      label: 'Ditolak',
      value: stats.rejected,
      badgeBg: 'bg-rose-500/20 text-rose-700 border-rose-300/50',
      numCol: 'text-rose-600',
      bgCard: 'bg-gradient-to-br from-rose-50/90 via-white to-rose-50/40 border-rose-200/80 shadow-sm',
      subText: 'text-rose-800',
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 selection:bg-[#162e52] selection:text-white">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#162e52] via-[#1b3f6b] to-[#0e2a4a] text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-sky-400/15 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <Link
              href="/dashboard/peneliti"
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md flex items-center justify-center transition-all duration-200 text-white shadow-sm hover:scale-105"
              aria-label="Kembali ke Dashboard"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-sky-200 uppercase tracking-widest">
                  Dashboard Peneliti
                </span>
                <span className="text-white/40">/</span>
                <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest">
                  Monitoring Pesisir
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white leading-tight mt-0.5">
                Laporan Limbah Warga
              </h1>
              <p className="text-xs text-sky-100/80 font-normal mt-0.5">
                Validasi AI 3 Lapis (Keaslian Foto, GPS &amp; Waktu EXIF) · Peneliti: {displayName}
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <span className="px-3.5 py-1.5 rounded-full bg-emerald-400/20 text-emerald-200 border border-emerald-300/30 text-xs font-bold uppercase tracking-wider backdrop-blur-md shadow-sm">
              {stats.verified} Terverifikasi
            </span>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-8 space-y-6">
        {/* Statistik Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((s) => (
            <div
              key={s.label}
              className={`relative rounded-2xl p-5 border transition-all duration-300 ${s.bgCard}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-widest opacity-80">{s.label}</span>
                <span className={`text-2xl font-black ${s.numCol}`}>
                  {String(s.value).padStart(2, '0')}
                </span>
              </div>
              <p className={`text-[11px] font-medium mt-2 ${s.subText}`}>
                {s.label === 'Total Laporan'
                  ? 'Total laporan masuk'
                  : s.label === 'Terverifikasi'
                  ? 'Lolos validasi AI'
                  : s.label === 'Perlu Diuji'
                  ? 'Perlu cek lapangan'
                  : 'Gagal / Rekayasa'}
              </p>
            </div>
          ))}
        </div>

        {/* Peta + daftar */}
        <div className="grid lg:grid-cols-5 gap-6 items-start">
          <div className="lg:col-span-3 lg:sticky lg:top-6 space-y-3">
            <div className="bg-white p-1 rounded-2xl border border-zinc-200 shadow-md">
              {loading ? (
                <div className="rounded-xl bg-zinc-50 h-[46vh] lg:h-[calc(100vh-300px)] flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-[#162e52] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <ReportMap reports={filtered} onSelect={setSelected} />
              )}
            </div>

            <div className="flex flex-wrap gap-2.5 px-1 py-1">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                Terverifikasi
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                Perlu Diuji
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                Ditolak
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200 text-[10px] font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-400" />
                Belum Divalidasi
              </span>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div>
                  <h2 className="text-sm font-extrabold text-[#162e52] uppercase tracking-wider">Daftar Laporan Warga</h2>
                  <p className="text-[10px] text-zinc-500">Klik item untuk melihat detail validasi AI</p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-bold uppercase tracking-wider">
                  {filtered.length} Tampil
                </span>
              </div>
              <ReportList reports={filtered} filter={filter} onFilter={setFilter} onSelect={setSelected} />
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200/80 text-xs text-sky-900 space-y-1">
          <p className="font-bold flex items-center gap-2 text-sky-950">
            <svg className="w-4 h-4 text-sky-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
            Metode Validasi AI 3 Lapis:
          </p>
          <p className="text-[11px] text-sky-800 leading-relaxed">
            (1) Model vision Groq mengevaluasi keaslian foto limbah, (2) Pengujian toleransi GPS perangkat vs metadata EXIF foto, dan (3) Selisih timestamp foto EXIF vs waktu pengiriman laporan. Laporan berstatus &quot;Perlu Diuji&quot; memerlukan verifikasi lapangan oleh peneliti sebelum aksi resmi.
          </p>
        </div>
      </main>

      {selected && (
        <ReportDetail
          report={selected}
          isOwner={selected.uid === uid}
          onDelete={handleDelete}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}