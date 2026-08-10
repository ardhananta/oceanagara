'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadWasteReports, loadMyWasteReports, reportDisplayCode, formatReportDate, type WasteReportEntry } from '@/app/service/wasteReports';

interface MyReportListProps {
  uid?: string | null;
}

export default function MyReportList({ uid }: MyReportListProps) {
  const [reports, setReports] = useState<WasteReportEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<WasteReportEntry | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    let items: WasteReportEntry[] = [];
    if (uid) {
      items = await loadMyWasteReports(uid, 50);
    }
    if (items.length === 0) {
      items = await loadWasteReports(50);
    }
    setReports(items);
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-sm flex items-center justify-center gap-3">
        <div className="w-5 h-5 border-2 border-[#162e52] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold text-zinc-600">Memuat riwayat laporan Anda…</span>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-zinc-200 shadow-sm text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-700 mx-auto flex items-center justify-center">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
        </div>
        <h3 className="text-sm font-extrabold text-[#162e52]">Belum Ada Laporan Terikirim</h3>
        <p className="text-xs text-zinc-500 max-w-sm mx-auto">
          Setiap laporan limbah yang Anda kirimkan melalui formulir di atas akan muncul di sini beserta hasil validasi AI dan peninjauan peneliti.
        </p>
      </div>
    );
  }

  const getStatusBadge = (status?: string) => {
    if (status === 'verified') {
      return <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-extrabold uppercase">Terverifikasi</span>;
    }
    if (status === 'suspected') {
      return <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-extrabold uppercase">Perlu Diuji AI</span>;
    }
    if (status === 'rejected') {
      return <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-extrabold uppercase">Ditolak</span>;
    }
    return <span className="px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 border border-sky-300 text-[10px] font-extrabold uppercase">Proses Validasi</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold text-[#162e52]">Riwayat Laporan Saya</h2>
          <p className="text-xs text-zinc-500 font-medium">Daftar laporan limbah pesisir yang telah dikirimkan ke peneliti Oceanagara</p>
        </div>
        <button
          type="button"
          onClick={fetchReports}
          className="text-xs font-bold text-[#162e52] hover:bg-zinc-100 flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-zinc-200 shadow-sm transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {reports.map((item) => {
          const isSelected = selectedReport?.id === item.id;
          const thumb = item.photoThumbs?.[0];
          const val = item.validation;

          return (
            <div
              key={item.id}
              className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm hover:shadow-md ${
                isSelected ? 'border-[#162e52] ring-1 ring-[#162e52]' : 'border-zinc-200'
              }`}
            >
              <div
                onClick={() => setSelectedReport(isSelected ? null : item)}
                className="p-4 flex items-center gap-4 cursor-pointer"
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt="Foto Limbah"
                    className="w-16 h-16 rounded-xl object-cover border border-zinc-200 flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-zinc-100 text-zinc-400 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                    No Photo
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-mono font-extrabold text-[#162e52]">
                      {reportDisplayCode(item.id)}
                    </span>
                    {getStatusBadge(val?.status)}
                    <span className="text-[10px] text-zinc-400 font-medium">
                      {formatReportDate(item.createdAt || item.capturedAt)}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-zinc-800 capitalize truncate">
                    Jenis: {item.wasteType ? item.wasteType.replace('-', ' ') : 'Limbah Pesisir'}
                  </p>
                  <p className="text-[11px] text-zinc-500 font-medium truncate">
                    📍 {item.location?.lat.toFixed(4)}, {item.location?.lon.toFixed(4)}
                  </p>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-black text-[#162e52]">
                    {val?.confidence != null ? `${val.confidence}/100` : '—'}
                  </div>
                  <span className="text-[10px] font-bold text-[#162e52] underline">
                    {isSelected ? 'Tutup Detail' : 'Lihat Detail'}
                  </span>
                </div>
              </div>

              {/* Detail Dropdown / Expanded View */}
              {isSelected && (
                <div className="border-t border-zinc-200 bg-zinc-50 p-4 space-y-3 text-xs">
                  {(val?.summary || val?.photoCheck?.note) && (
                    <div className="bg-white p-3 rounded-xl border border-zinc-200 shadow-sm">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#162e52] mb-1">
                        Catatan Validasi AI:
                      </p>
                      <p className="text-xs text-zinc-700 font-medium leading-relaxed">
                        {val.summary || val.photoCheck?.note}
                      </p>
                    </div>
                  )}

                  {val?.findings && val.findings.length > 0 && (
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#162e52] mb-1">
                        Temuan Visual AI:
                      </p>
                      <ul className="list-disc list-inside text-xs text-zinc-700 space-y-0.5 font-medium">
                        {val.findings.map((f, idx) => (
                          <li key={idx}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {item.description && (
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#162e52] mb-1">
                        Deskripsi Pelapor:
                      </p>
                      <p className="text-xs text-zinc-700 bg-white p-2.5 rounded-xl border border-zinc-200">
                        {item.description}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
