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
import ReportList, { type WasteFilter, type DateFilterOption } from '@/components/laporan-limbah/ReportList';
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
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('semua');
  const [specificDate, setSpecificDate] = useState<string>(new Date().toISOString().slice(0, 10));
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

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    const entries = await loadWasteReports(100);
    setReports(entries);
    setLoading(false);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!uid) return;
    await deleteWasteReport(uid, id);
    setSelected(null);
    const entries = await loadWasteReports(100);
    setReports(entries);
  }, [uid]);

  const filtered = reports.filter((r) => {
    const statusMatch = filter === 'semua' || r.validation?.status === filter;
    if (!statusMatch) return false;

    if (dateFilter === 'semua') return true;
    const rawDate = r.createdAt || r.capturedAt;
    if (!rawDate) return true;

    const dateObj = new Date(
      typeof rawDate === 'object' && 'seconds' in (rawDate as Record<string, unknown>)
        ? (rawDate as { seconds: number }).seconds * 1000
        : String(rawDate)
    );
    if (isNaN(dateObj.getTime())) return true;

    const now = new Date();
    if (dateFilter === 'hari-ini') {
      return dateObj.toDateString() === now.toDateString();
    }
    if (dateFilter === '7-hari') {
      const past7 = new Date();
      past7.setDate(now.getDate() - 7);
      return dateObj >= past7;
    }
    if (dateFilter === '30-hari') {
      const past30 = new Date();
      past30.setDate(now.getDate() - 30);
      return dateObj >= past30;
    }
    if (dateFilter === 'spesifik' && specificDate) {
      const reportYMD = dateObj.toISOString().slice(0, 10);
      return reportYMD === specificDate;
    }
    return true;
  });

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
      badgeBg: 'bg-[#162e52] text-white',
      numCol: 'text-[#162e52]',
      bgCard: 'bg-white border-zinc-200 shadow-sm',
      subText: 'text-zinc-500',
    },
    {
      label: 'Terverifikasi',
      value: stats.verified,
      badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      numCol: 'text-emerald-700',
      bgCard: 'bg-white border-zinc-200 shadow-sm',
      subText: 'text-zinc-500',
    },
    {
      label: 'Perlu Diuji',
      value: stats.suspected,
      badgeBg: 'bg-amber-100 text-amber-800 border-amber-300',
      numCol: 'text-amber-700',
      bgCard: 'bg-white border-zinc-200 shadow-sm',
      subText: 'text-zinc-500',
    },
    {
      label: 'Ditolak',
      value: stats.rejected,
      badgeBg: 'bg-rose-100 text-rose-800 border-rose-300',
      numCol: 'text-rose-700',
      bgCard: 'bg-white border-zinc-200 shadow-sm',
      subText: 'text-zinc-500',
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 selection:bg-[#162e52] selection:text-white">
      {/* Clean Solid Header */}
      <div className="bg-[#162e52] text-white shadow-sm border-b border-[#1f3864]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <Link
              href="/dashboard/peneliti"
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center transition-colors text-white shadow-sm"
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
              <p className="text-xs text-sky-100/90 font-normal mt-0.5">
                Validasi AI 3 Lapis (Keaslian Foto, GPS &amp; Waktu EXIF) · Peneliti: {displayName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-white flex items-center gap-2 transition-colors shadow-sm active:scale-95 disabled:opacity-50"
            >
              <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Refresh Data
            </button>
            <span className="hidden sm:inline-block px-3.5 py-2 rounded-xl bg-white/10 text-white border border-white/20 text-xs font-bold uppercase tracking-wider shadow-sm">
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
              className={`p-5 rounded-2xl border transition-all duration-200 ${s.bgCard}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border ${s.badgeBg}`}>
                  {s.label}
                </span>
                <span className="text-[10px] text-zinc-400 font-bold">Terbaru</span>
              </div>
              <p className={`text-2xl sm:text-3xl font-black tracking-tight mt-3 ${s.numCol}`}>
                {s.value}
              </p>
              <p className={`text-[10px] font-semibold mt-1 ${s.subText}`}>
                {s.label === 'Total Laporan'
                  ? 'Total laporan dari warga'
                  : s.label === 'Terverifikasi'
                    ? 'Foto, lokasi &amp; waktu valid'
                    : s.label === 'Perlu Diuji'
                      ? 'Perlu verifikasi manual'
                      : 'Foto/lokasi tidak cocok'}
              </p>
            </div>
          ))}
        </div>

        {/* Peta & Daftar Laporan */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-[#162e52] tracking-tight">Daftar Laporan Limbah</h2>
                <p className="text-xs text-zinc-500 font-medium mt-0.5">Filter berdasarkan hasil validasi 3 lapis</p>
              </div>
            </div>

            {loading ? (
              <div className="space-y-3 py-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-zinc-100 animate-pulse" />
                ))}
              </div>
            ) : (
              <ReportList
                reports={filtered}
                filter={filter}
                onFilter={setFilter}
                dateFilter={dateFilter}
                onDateFilterChange={setDateFilter}
                specificDate={specificDate}
                onSpecificDateChange={setSpecificDate}
                onSelect={setSelected}
              />
            )}
          </div>

          <div className="lg:col-span-7 bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-[#162e52] tracking-tight">Sebaran Geospasial Laporan</h2>
                <p className="text-xs text-zinc-500 font-medium mt-0.5">Penanda merah = Perlu Diuji/Ditolak, Hijau = Terverifikasi</p>
              </div>
              <span className="text-xs font-mono font-extrabold text-[#162e52] bg-zinc-100 px-3 py-1 rounded-full border border-zinc-200">
                {filtered.length} Titik
              </span>
            </div>

            <div className="rounded-xl border border-zinc-200 overflow-hidden shadow-sm">
              <ReportMap reports={filtered} onSelect={setSelected} />
            </div>
          </div>
        </div>
      </main>

      {/* Modal Detail Laporan */}
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