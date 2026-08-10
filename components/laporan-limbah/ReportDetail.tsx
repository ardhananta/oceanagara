'use client';

import type { WasteReportEntry } from '@/app/service/wasteReports';
import { formatReportDate, reportDisplayCode } from '@/app/service/wasteReports';

const STATUS_META = {
  verified: { label: 'Terverifikasi', cls: 'bg-emerald-50 text-emerald-800 border-emerald-300', col: '#059669' },
  suspected: { label: 'Perlu Diuji', cls: 'bg-amber-50 text-amber-800 border-amber-300', col: '#f59e0b' },
  rejected: { label: 'Ditolak', cls: 'bg-rose-50 text-rose-800 border-rose-300', col: '#ef4444' },
  pending: { label: 'Belum Divalidasi', cls: 'bg-zinc-100 text-zinc-700 border-zinc-200', col: '#64748b' },
} as const;

const WASTE_TYPE_LABELS: Record<string, string> = {
  plastik: 'Sampah Plastik',
  'tumpahan-minyak': 'Tumpahan Minyak',
  'kimia-pabrik': 'Limbah Kimia / Pabrik',
  organik: 'Limbah Organik',
  'sampah-campuran': 'Sampah Campuran',
  lainnya: 'Lainnya',
};

interface ReportDetailProps {
  report: WasteReportEntry;
  isOwner: boolean;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

function CheckRow({
  title,
  ok,
  note,
}: {
  title: string;
  ok: 'ok' | 'warn' | 'fail';
  note: string;
}) {
  const dot = ok === 'ok' ? 'bg-emerald-500' : ok === 'warn' ? 'bg-amber-500' : 'bg-rose-500';
  const label = ok === 'ok' ? 'Lolos' : ok === 'warn' ? 'Perlu Dicermati' : 'Gagal';
  const labelCls = ok === 'ok' ? 'text-emerald-800' : ok === 'warn' ? 'text-amber-800' : 'text-rose-800';
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-extrabold text-zinc-900 flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dot}`} />
          {title}
        </p>
        <span className={`text-[9px] font-extrabold uppercase tracking-wider ${labelCls}`}>{label}</span>
      </div>
      <p className="text-[10px] text-zinc-600 leading-relaxed mt-1.5">{note}</p>
    </div>
  );
}

export default function ReportDetail({ report, isOwner, onDelete, onClose }: ReportDetailProps) {
  const v = report.validation;
  const status = v?.status ?? 'pending';
  const meta = STATUS_META[status];
  const mapsUrl = `https://www.google.com/maps?q=${report.location.lat},${report.location.lon}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-zinc-200 rounded-2xl max-w-2xl w-full p-6 relative space-y-4 shadow-xl text-zinc-900 my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 p-2 rounded-lg hover:bg-zinc-100 transition-colors"
          aria-label="Tutup detail"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex items-center justify-between gap-3 flex-wrap pr-8">
          <div className="flex items-center gap-2.5">
            <span className={`inline-block px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest rounded-full border ${meta.cls}`}>
              {meta.label}
            </span>
            {v && (
              <span className="text-[10px] font-bold text-zinc-600 bg-zinc-100 border border-zinc-200 px-2.5 py-0.5 rounded-full">
                Keyakinan {v.confidence}%{v.model ? ` · ${v.model.split('/')[0]}` : ''}
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono font-bold text-zinc-500">{reportDisplayCode(report.id)}</span>
        </div>

        <div>
          <h3 className="text-lg font-extrabold text-[#162e52] capitalize">
            {WASTE_TYPE_LABELS[report.wasteType] ?? report.wasteType.replace(/-/g, ' ')}
          </h3>
          <p className="text-xs text-zinc-600 leading-relaxed mt-0.5">
            {report.description || 'Tanpa deskripsi tambahan.'}
          </p>
          <p className="text-[10px] text-zinc-500 mt-1 font-medium">
            Dilaporkan oleh {report.reporterName} · {formatReportDate(report.createdAt)}
          </p>
        </div>

        {report.photoThumbs.length > 0 && (
          <div className="flex gap-2">
            {report.photoThumbs.map((t, i) => (
              <a key={i} href={t} target="_blank" rel="noreferrer" title="Buka foto di tab baru">
                <img
                  src={t}
                  alt={`Foto laporan ${i + 1}`}
                  className="w-32 h-32 rounded-xl object-cover border border-zinc-200 shadow-sm hover:opacity-90 transition-opacity"
                />
              </a>
            ))}
          </div>
        )}

        {/* Ringkasan validasi */}
        {v ? (
          <div className="space-y-3">
            <div className="rounded-xl border-l-4 bg-zinc-50 p-3 border-zinc-300">
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Ringkasan Validasi</p>
              <p className="text-xs text-zinc-800 font-medium leading-relaxed">{v.summary}</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-2.5">
              <CheckRow
                title="Keaslian Foto"
                ok={v.photoCheck.genuine ? 'ok' : 'fail'}
                note={v.photoCheck.note}
              />
              <CheckRow
                title="Lokasi (GPS vs EXIF)"
                ok={v.locationCheck.verdict === 'match' ? 'ok' : v.locationCheck.verdict === 'mismatch' ? 'fail' : 'warn'}
                note={v.locationCheck.note}
              />
              <CheckRow
                title="Waktu (EXIF vs Laporan)"
                ok={v.timestampCheck.verdict === 'valid' ? 'ok' : v.timestampCheck.verdict === 'drifted' ? 'fail' : 'warn'}
                note={v.timestampCheck.note}
              />
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-[11px] font-extrabold text-zinc-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#162e52]" />
                  Jenis Terdeteksi AI
                </p>
                <p className="text-[10px] text-zinc-600 leading-relaxed mt-1.5">
                  {v.photoCheck.wasteType} · lingkungan: {v.photoCheck.environment}
                </p>
              </div>
            </div>

            {v.timestampCheck.photoTime && (
              <p className="text-[9px] text-zinc-500 font-mono">
                Waktu EXIF foto: {new Date(v.timestampCheck.photoTime).toLocaleString('id-ID')}
              </p>
            )}
          </div>
        ) : (
          <p className="text-[10px] text-zinc-500 italic">Laporan belum melalui validasi AI.</p>
        )}

        {/* Lokasi */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 space-y-1">
          <p className="text-[9px] font-extrabold uppercase tracking-widest text-[#162e52]">Koordinat Pelapor</p>
          <p className="text-[11px] font-mono font-bold text-zinc-900">
            {report.location.lat.toFixed(6)}, {report.location.lon.toFixed(6)}
          </p>
          <p className="text-[9px] text-zinc-500 font-medium">
            {report.location.source === 'gps'
              ? `GPS perangkat saat memotret${report.location.accuracyMeters ? ` · akurasi ±${report.location.accuracyMeters} m` : ''}`
              : 'Koordinat input manual'}
            {report.exif?.gpsLat ? ` · EXIF foto: ${report.exif.gpsLat.toFixed(4)}, ${report.exif.gpsLon?.toFixed(4)}` : ''}
          </p>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#162e52] hover:underline mt-1"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
            </svg>
            Buka di Google Maps
          </a>
        </div>

        {onDelete && isOwner && (
          <button
            onClick={() => {
              if (window.confirm('Hapus laporan ini? Tindakan tidak dapat dibatalkan.')) {
                onDelete(report.id);
              }
            }}
            className="text-[10px] font-bold text-rose-600 hover:text-rose-800 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
            Hapus laporan saya
          </button>
        )}
      </div>
    </div>
  );
}