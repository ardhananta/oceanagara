'use client';

import { useState } from 'react';
import type { FishScanResult } from '@/app/types/maritime';
import ScanUploader from './ScanUploader';
import ScanLoading from './ScanLoading';
import ScanResult from './ScanResult';

/** Hasilkan thumbnail (max 512px) dari data URL hasil kompresi uploader. */
async function photoThumb(src: string): Promise<string> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode failed'));
      el.src = src;
    });
    const scale = Math.min(1, 512 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return src;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.6);
  } catch {
    return src;
  }
}

export default function FishScanSection() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<FishScanResult | null>(null);
  const [photoThumbs, setPhotoThumbs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async (payload: {
    photos: string[];
    species: string;
    holdHours?: string;
    waterTemp?: number;
  }) => {
    setScanning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/ai/scan-kualitas-ikan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data?.result) {
        throw new Error(data?.error ?? 'Pemindaian gagal');
      }
      setResult(data.result as FishScanResult);
      setPhotoThumbs(await Promise.all(payload.photos.map(photoThumb)));
    } catch (err) {
      console.error('[FishScanSection] Error:', err);
      setError('Gagal memindai kualitas ikan. Silakan coba lagi.');
    } finally {
      setScanning(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setPhotoThumbs([]);
    setError(null);
  };

  return (
    <section className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#0a2450] via-[#0c3060] to-[#123f7d] border border-white/10 shadow-2xl">
      {/* dekoratif */}
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-sky-400/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-28 -left-20 w-72 h-72 rounded-full bg-cyan-300/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 p-5 md:p-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-400/20 text-sky-100 border border-sky-300/30 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-5.196-9a5.25 5.25 0 0 1 9.393 0m-4.197-3h.008v.008H12V9Z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-extrabold text-white tracking-tight leading-tight">
                Scan Kualitas Ikan
              </h2>
              <p className="text-[11px] text-sky-200/80 font-medium mt-0.5 max-w-xl">
                Foto ikan lalu AI memeriksa detail fisik — mata, insang, sisik, lendir, tekstur daging, hingga tanda rigor — untuk menilai kesegaran secara lengkap.
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-block px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded-full bg-sky-400/15 text-sky-200 border border-sky-300/25 flex-shrink-0">
            Model Vision Groq
          </span>
        </div>

        <div className="rounded-2xl bg-white text-zinc-900 shadow-xl p-4 md:p-5">
          {scanning ? (
            <ScanLoading />
          ) : result ? (
            <ScanResult result={result} photoThumbs={photoThumbs} onReset={handleReset} />
          ) : (
            <>
              <ScanUploader loading={scanning} onScan={handleScan} onError={setError} />
              {error && (
                <p className="mt-3 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        <p className="mt-4 text-[9px] text-sky-200/50 font-medium leading-relaxed">
          Hasil scan adalah estimasi AI berbasis analisis visual — bukan sertifikat mutu resmi. Untuk keputusan jual-beli, verifikasi langsung bau, mata, insang & tekstur daging. Data foto dikirim ke layanan Groq untuk diproses.
        </p>
      </div>
    </section>
  );
}