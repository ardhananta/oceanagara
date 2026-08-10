'use client';

import type { WasteReportEntry } from '@/app/service/wasteReports';
import { formatReportDate, reportDisplayCode } from '@/app/service/wasteReports';
import type { WasteValidationStatus } from '@/app/types/maritime';

const STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  verified: { label: 'Terverifikasi', cls: 'bg-emerald-50 text-emerald-800 border-emerald-300', dot: 'bg-emerald-500' },
  suspected: { label: 'Perlu Diuji', cls: 'bg-amber-50 text-amber-800 border-amber-300', dot: 'bg-amber-500' },
  rejected: { label: 'Ditolak', cls: 'bg-rose-50 text-rose-800 border-rose-300', dot: 'bg-rose-500' },
  pending: { label: 'Belum Divalidasi', cls: 'bg-zinc-100 text-zinc-700 border-zinc-300', dot: 'bg-zinc-400' },
};

export type WasteFilter = 'semua' | WasteValidationStatus;
export type DateFilterOption = 'semua' | 'hari-ini' | '7-hari' | '30-hari' | 'spesifik';

interface ReportListProps {
  reports: WasteReportEntry[];
  filter: WasteFilter;
  onFilter: (f: WasteFilter) => void;
  dateFilter: DateFilterOption;
  onDateFilterChange: (df: DateFilterOption) => void;
  specificDate: string;
  onSpecificDateChange: (date: string) => void;
  onSelect: (report: WasteReportEntry) => void;
}

export default function ReportList({
  reports,
  filter,
  onFilter,
  dateFilter,
  onDateFilterChange,
  specificDate,
  onSpecificDateChange,
  onSelect,
}: ReportListProps) {
  const counts: Record<WasteFilter, number> = {
    semua: reports.length,
    verified: reports.filter((r) => r.validation?.status === 'verified').length,
    suspected: reports.filter((r) => r.validation?.status === 'suspected').length,
    rejected: reports.filter((r) => r.validation?.status === 'rejected').length,
  };

  const DATE_OPTIONS: { id: DateFilterOption; label: string }[] = [
    { id: 'semua', label: 'Semua Riwayat' },
    { id: 'hari-ini', label: 'Hari Ini' },
    { id: '7-hari', label: '7 Hari Terakhir' },
    { id: '30-hari', label: '30 Hari Terakhir' },
    { id: 'spesifik', label: 'Pilih Tanggal' },
  ];

  return (
    <div className="space-y-4">
      {/* Filter Status Validasi */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-extrabold uppercase tracking-wider text-[#162e52] block">
          Status Validasi
        </label>
        <div className="flex flex-wrap gap-1.5">
          {(['semua', 'verified', 'suspected', 'rejected'] as WasteFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => onFilter(f)}
              className={`px-3 py-1.5 rounded-xl border text-[10px] font-extrabold uppercase tracking-wider transition-colors ${
                filter === f
                  ? 'bg-[#162e52] text-white border-[#162e52] shadow-sm'
                  : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              {f === 'semua' ? 'Semua Status' : STATUS_META[f].label} · {counts[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Filter Riwayat Tanggal */}
      <div className="space-y-1.5 pt-2 border-t border-zinc-100">
        <label className="text-[10px] font-extrabold uppercase tracking-wider text-[#162e52] block">
          Riwayat Tanggal Laporan
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          {DATE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => onDateFilterChange(opt.id)}
              className={`px-3 py-1.5 rounded-xl border text-[10px] font-extrabold transition-colors ${
                dateFilter === opt.id
                  ? 'bg-zinc-800 text-white border-zinc-800 shadow-sm'
                  : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-white'
              }`}
            >
              {opt.label}
            </button>
          ))}

          {dateFilter === 'spesifik' && (
            <input
              type="date"
              value={specificDate}
              onChange={(e) => onSpecificDateChange(e.target.value)}
              className="px-2.5 py-1 rounded-xl border border-zinc-300 text-xs font-semibold text-zinc-900 bg-white focus:outline-none focus:border-[#162e52] shadow-sm"
            />
          )}
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-12 text-zinc-400 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
          <svg className="w-10 h-10 mx-auto mb-2 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
          </svg>
          <p className="text-xs font-bold text-zinc-700">Tidak ada laporan pada filter/tanggal ini.</p>
          <p className="text-[10px] text-zinc-400 mt-0.5">Coba ubah tanggal atau status validasi di atas.</p>
        </div>
      ) : (
        <ul className="space-y-2.5 max-h-[460px] lg:max-h-none lg:overflow-y-auto scroll-slim pr-1">
          {reports.map((r) => {
            const status = r.validation?.status ?? 'pending';
            const meta = STATUS_META[status];
            return (
              <li
                key={r.id}
                onClick={() => onSelect(r)}
                className="group flex items-center gap-3.5 p-3.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 shadow-sm transition-colors cursor-pointer"
              >
                {r.photoThumbs[0] ? (
                  <img
                    src={r.photoThumbs[0]}
                    alt="Foto laporan"
                    className="w-14 h-14 rounded-xl object-cover border border-zinc-200 flex-shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-400 flex-shrink-0">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Z" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[9px] font-extrabold uppercase tracking-wider rounded-full px-2.5 py-0.5 border ${meta.cls}`}>
                      {meta.label}
                    </span>
                    {r.validation && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200">
                        {r.validation.confidence}% AI
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-extrabold text-[#162e52] truncate mt-1.5 capitalize">
                    {r.wasteType.replace(/-/g, ' ')}
                    {r.description ? ` — ${r.description.slice(0, 48)}` : ''}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[9px] text-zinc-500 font-medium">
                    <span className="font-mono font-bold text-zinc-700">{reportDisplayCode(r.id)}</span>
                    <span>·</span>
                    <span>{r.reporterName}</span>
                    <span>·</span>
                    <span>{formatReportDate(r.createdAt || r.capturedAt)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}