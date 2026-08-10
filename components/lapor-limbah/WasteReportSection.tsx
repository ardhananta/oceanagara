'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { WasteReportValidation } from '@/app/types/maritime';
import { onAuthChange, getUserProfile } from '@/app/service/authentication';
import {
  buildReportKey,
  reportDisplayCode,
  saveWasteReport,
} from '@/app/service/wasteReports';
import WasteReportForm, { type WasteReportPayload } from './WasteReportForm';
import WasteReportResult from './WasteReportResult';

const VALIDATION_STEPS = [
  { label: 'Memeriksa keaslian foto', desc: 'Model vision — rekayasa / stok / foto lama' },
  { label: 'Cocokkan lokasi GPS', desc: 'Perangkat vs metadata EXIF foto' },
  { label: 'Cocokkan waktu pengambilan', desc: 'Waktu EXIF vs waktu pelaporan' },
  { label: 'Menyusun status & rekomendasi', desc: 'Verified / Diuji / Ditolak' },
];

export default function WasteReportSection() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [reporterName, setReporterName] = useState('Warga');
  const [validating, setValidating] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [result, setResult] = useState<WasteReportValidation | null>(null);
  const [submittedPayload, setSubmittedPayload] = useState<WasteReportPayload | null>(null);
  const [reportCode, setReportCode] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const authCheckedRef = useRef(false);

  // Ambil identitas pelapor dari sesi.
  useEffect(() => {
    if (authCheckedRef.current) return;
    authCheckedRef.current = true;
    const unsubscribe = onAuthChange(async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }
      setUid(user.uid);
      const profile = await getUserProfile(user.uid).catch(() => null);
      setReporterName(profile?.displayName || user.displayName || 'Warga');
    });
    return () => unsubscribe();
  }, [router]);

  const handleSubmit = async (payload: WasteReportPayload) => {
    setValidating(true);
    setStepIndex(0);
    setFormError(null);
    setSaveError(null);
    try {
      const tick = setInterval(() => {
        setStepIndex((s) => Math.min(s + 1, VALIDATION_STEPS.length - 1));
      }, 700);

      const res = await fetch('/api/ai/validasi-laporan-limbah', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data?.validation) {
        throw new Error(data?.error ?? 'Validasi gagal');
      }
      clearInterval(tick);
      setStepIndex(VALIDATION_STEPS.length - 1);

      const validation = data.validation as WasteReportValidation;
      setResult(validation);
      setSubmittedPayload(payload);

      // Simpan ke Firestore agar peneliti bisa melihat.
      if (uid) {
        try {
          const saved = await saveWasteReport(uid, {
            reporterName,
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
          setSaveError(
            'Hasil validasi tersedia, tetapi laporan gagal tersimpan ke database — periksa izin Firestore.'
          );
        }
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
    setReportCode(null);
    setDuplicate(false);
    setSaveError(null);
    setFormError(null);
  };

  return (
    <section className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#15324f] via-[#1b3f6b] to-[#0e2a4a] border border-white/10 shadow-2xl">
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-28 -left-20 w-72 h-72 rounded-full bg-sky-300/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 p-5 md:p-8">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-400/20 text-emerald-100 border border-emerald-300/30 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-extrabold text-white tracking-tight leading-tight">
                Lapor Limbah di Wilayah Pesisir
              </h2>
              <p className="text-[11px] text-sky-200/80 font-medium mt-0.5 max-w-xl">
                Temukan limbah di pantai, sungai, atau laut? Abadikan fotonya — AI memvalidasi keaslian foto, lokasi GPS, dan waktu pengambilan sebelum dilaporkan ke peneliti.
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-block px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded-full bg-emerald-400/15 text-emerald-200 border border-emerald-300/25 flex-shrink-0">
            Validasi AI 3 Lapis
          </span>
        </div>

        <div className="rounded-2xl bg-white text-zinc-900 shadow-xl p-4 md:p-5">
          {validating ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative w-14 h-14 flex-shrink-0">
                  <div className="absolute inset-0 rounded-full border-2 border-emerald-400/30" />
                  <div className="absolute inset-0 rounded-full border-2 border-t-emerald-300 border-r-emerald-300 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center text-emerald-600">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-extrabold text-zinc-800 uppercase tracking-wider">
                    Memvalidasi keaslian laporan…
                  </p>
                  <p className="text-[10px] text-zinc-500 font-medium">
                    Model vision Groq · biasanya selesai dalam beberapa detik
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {VALIDATION_STEPS.map((step, i) => (
                  <div key={step.label} className="flex items-center gap-3">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0 transition-colors ${
                        i < stepIndex
                          ? 'bg-emerald-500 text-white'
                          : i === stepIndex
                            ? 'bg-emerald-400 text-emerald-950 animate-pulse'
                            : 'bg-zinc-100 text-zinc-400'
                      }`}
                    >
                      {i < stepIndex ? '✓' : i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className={`text-[11px] font-bold ${i <= stepIndex ? 'text-zinc-800' : 'text-zinc-400'}`}>
                        {step.label}
                      </p>
                      <p className="text-[9px] text-zinc-400 font-medium">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all duration-500"
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
                <p className="mt-3 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  {formError}
                </p>
              )}
            </>
          )}
        </div>

        <p className="mt-4 text-[10px] text-sky-100/90 font-medium leading-relaxed">
          Lokasi diambil dari GPS perangkat saat Anda memotret, lalu dibandingkan dengan metadata EXIF foto dan waktu pengambilan. Foto dikirim ke layanan Groq untuk analisis keaslian. Laporan terverifikasi akan terlihat oleh peneliti Oceanagara.
        </p>
      </div>
    </section>
  );
}