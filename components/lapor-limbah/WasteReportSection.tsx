'use client';

import { useState } from 'react';
import type { WasteReportValidation } from '@/app/types/maritime';
import { buildReportKey, reportDisplayCode, saveWasteReport } from '@/app/service/wasteReports';
import WasteReportForm, { type WasteReportPayload } from './WasteReportForm';
import WasteReportResult from './WasteReportResult';

interface WasteReportSectionProps {
  uid?: string | null;
  reporterName?: string;
}

const VALIDATION_STEPS = [
  { label: 'Membaca Metadata EXIF', desc: 'GPS & timestamp foto' },
  { label: 'Validasi Geospasial', desc: 'Jarak GPS vs posisi pelapor' },
  { label: 'Analisis keaslian foto', desc: 'Deteksi objek & tipe limbah' },
  { label: 'Mengompilasi Rekomendasi', desc: 'Rekomendasi untuk peneliti' },
];

export default function WasteReportSection({ uid, reporterName }: WasteReportSectionProps) {
  const [validating, setValidating] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [result, setResult] = useState<WasteReportValidation | null>(null);
  const [submittedPayload, setSubmittedPayload] = useState<WasteReportPayload | null>(null);
  const [reportCode, setReportCode] = useState<string>('');
  const [duplicate, setDuplicate] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSubmit = async (payload: WasteReportPayload) => {
    setValidating(true);
    setStepIndex(0);
    setFormError(null);
    setSaveError(null);
    setResult(null);

    const tick = setInterval(() => {
      setStepIndex((s) => (s < VALIDATION_STEPS.length - 1 ? s + 1 : s));
    }, 1100);

    try {
      const res = await fetch('/api/ai/validasi-laporan-limbah', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as { validation?: WasteReportValidation; error?: string };
      if (!res.ok || !data.validation) {
        clearInterval(tick);
        throw new Error(data.error || 'Gagal memvalidasi laporan.');
      }
      clearInterval(tick);
      setStepIndex(VALIDATION_STEPS.length - 1);

      const validation = data.validation;
      setResult(validation);
      setSubmittedPayload(payload);

      // Simpan ke Firestore agar peneliti bisa melihat.
      const effectiveUid = uid || 'masyarakat_anon';
      try {
        const saved = await saveWasteReport(effectiveUid, {
          reporterName: reporterName || 'Masyarakat',
          location: payload.location,
          wasteType: payload.wasteType,
          description: payload.description,
          photoThumbs: payload.thumbs,
          capturedAt: new Date().toISOString(),
          exif: payload.exif,
          validation,
          reportKey: buildReportKey(payload.location.lat, payload.location.lon, payload.thumbs),
        });
        setReportCode(reportDisplayCode(saved.id));
        setDuplicate(saved.duplicate);
      } catch (err) {
        console.warn('[WasteReportSection] save failed:', err);
        setSaveError('Hasil validasi tersedia, tetapi laporan gagal tersimpan ke database.');
      }
    } catch (err) {
      console.error('[WasteReportSection] Error:', err);
      setFormError('Gagal memvalidasi laporan. Silakan coba lagi.');
    } finally {
      setValidating(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setSubmittedPayload(null);
    setReportCode('');
    setDuplicate(false);
    setFormError(null);
    setSaveError(null);
  };

  return (
    <section className="rounded-2xl bg-white border border-zinc-200 shadow-sm overflow-hidden">
      {/* Clean Solid Header */}
      <div className="bg-[#162e52] text-white p-5 md:p-6 flex items-start justify-between gap-4 border-b border-[#1f3f6e]">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-extrabold text-white tracking-tight leading-tight">
              Lapor Limbah di Wilayah Pesisir
            </h2>
            <p className="text-xs text-sky-100/90 font-normal mt-0.5 max-w-xl leading-relaxed">
              Temukan limbah di pantai, sungai, atau laut? Abadikan fotonya — sistem memvalidasi keaslian foto, lokasi GPS, dan waktu pengambilan sebelum dilaporkan ke peneliti.
            </p>
          </div>
        </div>
        <span className="hidden sm:inline-block px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider rounded-full bg-white/10 text-white border border-white/20 flex-shrink-0">
          Validasi 3 Lapis
        </span>
      </div>

      {/* Main Content Area */}
      <div className="p-5 md:p-6 bg-white text-zinc-900">
        {validating ? (
          <div className="space-y-5 py-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center flex-shrink-0 text-[#162e52]">
                <span className="w-5 h-5 border-2 border-[#162e52] border-t-transparent rounded-full animate-spin" />
              </div>
              <div>
                <p className="text-xs font-extrabold text-zinc-900 uppercase tracking-wider">
                  Memvalidasi keaslian laporan…
                </p>
                <p className="text-xs text-zinc-500 font-medium mt-0.5">
                  Proses pengujian foto &amp; analisis geospasial
                </p>
              </div>
            </div>

            <div className="space-y-3 bg-zinc-50 p-4 rounded-xl border border-zinc-200">
              {VALIDATION_STEPS.map((step, i) => (
                <div key={step.label} className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0 ${
                      i < stepIndex
                        ? 'bg-[#162e52] text-white'
                        : i === stepIndex
                          ? 'bg-[#1f4275] text-white animate-pulse'
                          : 'bg-zinc-200 text-zinc-500'
                    }`}
                  >
                    {i < stepIndex ? '✓' : i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-xs font-bold ${i <= stepIndex ? 'text-zinc-900' : 'text-zinc-400'}`}>
                      {step.label}
                    </p>
                    <p className="text-[10px] text-zinc-500 font-medium">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="h-2 rounded-full bg-zinc-100 overflow-hidden border border-zinc-200">
              <div
                className="h-full bg-[#162e52] transition-all duration-500 rounded-full"
                style={{ width: `${((stepIndex + 1) / VALIDATION_STEPS.length) * 100}%` }}
              />
            </div>
          </div>
        ) : result && submittedPayload ? (
          <WasteReportResult
            validation={result}
            location={submittedPayload.location}
            thumbs={submittedPayload.thumbs}
            reportCode={reportCode}
            duplicate={duplicate}
            saveError={saveError}
            onReset={handleReset}
          />
        ) : (
          <>
            <WasteReportForm loading={validating} onSubmit={handleSubmit} onError={setFormError} />
            {formError && (
              <p className="mt-3 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5">
                {formError}
              </p>
            )}
          </>
        )}
      </div>

      {/* Footer Info */}
      <div className="bg-zinc-50 px-5 py-3.5 border-t border-zinc-200 text-[11px] text-zinc-600 font-medium leading-relaxed">
        Lokasi diambil dari GPS perangkat saat Anda memotret, lalu dibandingkan dengan metadata EXIF foto. Laporan terverifikasi akan langsung tercatat dan dapat ditinjau oleh peneliti Oceanagara.
      </div>
    </section>
  );
}