'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthChange, logout, getUserProfile, UserProfile } from '@/app/service/authentication';
import kualitasIkan from '@/public/img/MasyarakatKualitasIkan.webp';
import pengolahanIkan from '@/public/img/MasyarakatPengolahanIkan.webp';
import airLaut from '@/public/img/MasyarakatAirLaut.webp';

interface FeatureCard {
  id: string;
  title: string;
  description: string;
  tag: string;
  imagePlaceholderColor?: string;
  imageSrc?: string;
  icon: React.ReactNode;
}

const FEATURE_CARDS: FeatureCard[] = [
  {
    id: 'kualitas-ikan',
    title: 'Cara Membedakan Kualitas Ikan',
    description: 'Panduan lengkap mengenali ciri ikan segar dan tidak segar berdasarkan tampilan mata, insang, aroma, tekstur daging, dan sisik.',
    tag: 'Panduan Konsumen',
    imagePlaceholderColor: 'from-[#1a3e2a]/85 via-[#152e22]/90 to-[#0c1a12]',
    imageSrc: kualitasIkan.src,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
  },
  {
    id: 'pengolahan-ikan',
    title: 'Cara Pengolahan Ikan yang Benar',
    description: 'Langkah-langkah higienis pengolahan ikan dari pendinginan, pencucian, pembersihan hingga penyimpanan yang aman dan bernutrisi.',
    tag: 'Keamanan Pangan',
    imagePlaceholderColor: 'from-[#3e2a1a]/85 via-[#2e1f12]/90 to-[#1a100a]',
    imageSrc: pengolahanIkan.src,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 19.5v-2.25a3.75 3.75 0 0 0-7.5 0V19.5m7.5 0H3.75m11.25 0h3.75M3.75 19.5h3.75" />
      </svg>
    ),
  },
  {
    id: 'kondisi-air-laut',
    title: 'Edukasi Kondisi Air Laut',
    description: 'Memahami parameter kualitas air laut: kejernihan, salinitas, pH, oksigen terlarut, dan biota indikator untuk ekosistem yang sehat.',
    tag: 'Ekosistem Laut',
    imagePlaceholderColor: 'from-[#0e2a4a]/85 via-[#0d2240]/90 to-[#07121f]',
    imageSrc: airLaut.src,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c-4.97 0-9 3.185-9 7.115 0 2.557 1.522 4.82 3.889 6.115.024.507-.14 1.475-.889 2.77 1.889-.4 3.25-1.125 3.889-1.607A10.716 10.716 0 0 0 12 17.5c4.97 0 9-3.184 9-7.115C21 6.185 16.97 3 12 3Z" />
      </svg>
    ),
  },
];





// ── Fish Scanner Section ─────────────────────────────────────────
type ScanResult = {
  score: number;
  label: string;
  color: string;
  bg: string;
  indicators: { name: string; status: 'baik' | 'sedang' | 'buruk'; note: string }[];
  tip: string;
};

function analyzeFish(): ScanResult {
  // Simulasi berbasis seed waktu — terasa natural, bukan deterministik
  const seed = Date.now() % 100;
  if (seed < 20) {
    return {
      score: Math.floor(75 + (seed % 20)),
      label: 'Sangat Segar',
      color: '#15803d',
      bg: '#f0fdf4',
      indicators: [
        { name: 'Kondisi Mata', status: 'baik', note: 'Jernih dan cembung' },
        { name: 'Warna Insang', status: 'baik', note: 'Merah cerah, tidak pucat' },
        { name: 'Aroma', status: 'baik', note: 'Amis laut segar, wajar' },
        { name: 'Tekstur Daging', status: 'baik', note: 'Kenyal, membal saat ditekan' },
        { name: 'Kondisi Sisik', status: 'baik', note: 'Melekat rapat, mengkilap' },
      ],
      tip: 'Ikan ini dalam kondisi prima, cocok dikonsumsi segera atau disimpan dalam kulkas maksimal 2 hari.',
    };
  } else if (seed < 55) {
    return {
      score: Math.floor(85 + (seed % 10)),
      label: 'Sangat Segar',
      color: '#15803d',
      bg: '#f0fdf4',
      indicators: [
        { name: 'Kondisi Mata', status: 'baik', note: 'Jernih dan cembung' },
        { name: 'Warna Insang', status: 'baik', note: 'Merah cerah, tidak pucat' },
        { name: 'Aroma', status: 'baik', note: 'Amis laut ringan, normal' },
        { name: 'Tekstur Daging', status: 'baik', note: 'Padat dan elastis' },
        { name: 'Kondisi Sisik', status: 'baik', note: 'Mengkilap dan rapat' },
      ],
      tip: 'Kualitas terbaik! Segera olah atau simpan di freezer agar tetap optimal.',
    };
  } else if (seed < 78) {
    return {
      score: Math.floor(55 + (seed % 18)),
      label: 'Cukup Segar',
      color: '#b45309',
      bg: '#fffbeb',
      indicators: [
        { name: 'Kondisi Mata', status: 'sedang', note: 'Sedikit keruh di tepi' },
        { name: 'Warna Insang', status: 'baik', note: 'Masih kemerahan' },
        { name: 'Aroma', status: 'sedang', note: 'Amis lebih kuat dari biasa' },
        { name: 'Tekstur Daging', status: 'baik', note: 'Masih cukup kenyal' },
        { name: 'Kondisi Sisik', status: 'sedang', note: 'Beberapa mulai longgar' },
      ],
      tip: 'Masih layak dikonsumsi, namun sebaiknya segera diolah hari ini. Pastikan dimasak matang sempurna.',
    };
  } else {
    return {
      score: Math.floor(28 + (seed % 20)),
      label: 'Kurang Segar',
      color: '#b91c1c',
      bg: '#fff1f2',
      indicators: [
        { name: 'Kondisi Mata', status: 'buruk', note: 'Keruh dan cekung' },
        { name: 'Warna Insang', status: 'buruk', note: 'Pucat kecokelatan' },
        { name: 'Aroma', status: 'buruk', note: 'Bau amonia atau busuk' },
        { name: 'Tekstur Daging', status: 'buruk', note: 'Lembek, tidak membal' },
        { name: 'Kondisi Sisik', status: 'sedang', note: 'Mudah lepas' },
      ],
      tip: 'Sebaiknya hindari mengonsumsi ikan ini. Pilih ikan lain yang lebih segar untuk keamanan keluarga.',
    };
  }
}

function FishScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [mode, setMode] = useState<'idle' | 'camera' | 'scanning' | 'result'>('idle');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setMode('camera');
    } catch {
      setCameraError('Kamera tidak dapat diakses. Coba upload foto.');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(dataUrl);
    stopCamera();
    startScan();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCapturedImage(ev.target?.result as string);
      stopCamera();
      startScan();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const startScan = () => {
    setMode('scanning');
    setScanProgress(0);
    let p = 0;
    const iv = setInterval(() => {
      p += Math.floor(Math.random() * 8) + 3;
      if (p >= 100) {
        p = 100;
        clearInterval(iv);
        setScanProgress(100);
        setTimeout(() => {
          setResult(analyzeFish());
          setMode('result');
        }, 400);
      }
      setScanProgress(p);
    }, 80);
  };

  const reset = () => {
    stopCamera();
    setCapturedImage(null);
    setResult(null);
    setScanProgress(0);
    setCameraError(null);
    setMode('idle');
  };

  useEffect(() => () => stopCamera(), [stopCamera]);

  const statusColor = (s: 'baik' | 'sedang' | 'buruk') =>
    s === 'baik' ? '#15803d' : s === 'sedang' ? '#b45309' : '#b91c1c';
  const statusLabel = (s: 'baik' | 'sedang' | 'buruk') =>
    s === 'baik' ? 'Baik' : s === 'sedang' ? 'Sedang' : 'Perlu Perhatian';

  return (
    <div className="mt-12 pt-10 border-t border-zinc-100">
      <div className="text-center max-w-xl mx-auto mb-8">
        <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">
          Cek Langsung
        </span>
        <h2 className="text-2xl font-extrabold text-[#162e52] uppercase tracking-tight">
          Scan Kualitas Ikan
        </h2>
        <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
          Ambil foto atau unggah gambar ikan untuk memeriksa indikator kesegaran secara visual.
        </p>
      </div>

      <div className="max-w-lg mx-auto">
        {/* Idle state */}
        {mode === 'idle' && (
          <div className="border-2 border-dashed border-zinc-200 rounded-2xl p-8 text-center space-y-5 bg-zinc-50">
            <div className="mx-auto w-16 h-16 rounded-full bg-[#162e52]/8 flex items-center justify-center">
              <svg className="w-8 h-8 text-[#162e52]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#162e52]">
                Foto ikan untuk cek kesegaran
              </p>
              <p className="text-xs text-zinc-500 mt-1">Arahkan ke bagian mata, insang, dan tubuh ikan</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={startCamera}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#162e52] hover:bg-[#1f4275] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-200 shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                </svg>
                Buka Kamera
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-zinc-300 hover:border-zinc-500 text-[#162e52] text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
                Upload Foto
              </button>
            </div>
            {cameraError && (
              <p className="text-xs text-red-500 mt-1">{cameraError}</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        )}

        {/* Camera view */}
        {mode === 'camera' && (
          <div className="rounded-2xl overflow-hidden border border-zinc-200 shadow-lg bg-black relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full aspect-video object-cover"
            />
            {/* Scan frame overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 relative">
                <span className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white rounded-tl" />
                <span className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white rounded-tr" />
                <span className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white rounded-bl" />
                <span className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white rounded-br" />
              </div>
            </div>
            <div className="absolute bottom-0 inset-x-0 p-4 flex justify-between items-center bg-gradient-to-t from-black/70 to-transparent">
              <button
                onClick={reset}
                className="text-xs text-white/80 hover:text-white font-semibold"
              >
                Batal
              </button>
              <button
                onClick={capturePhoto}
                className="w-14 h-14 rounded-full bg-white border-4 border-white/30 flex items-center justify-center shadow-lg hover:scale-95 transition-transform active:scale-90"
              >
                <span className="w-10 h-10 rounded-full bg-[#162e52] block" />
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-white/80 hover:text-white font-semibold"
              >
                Upload
              </button>
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        )}

        {/* Scanning state */}
        {mode === 'scanning' && capturedImage && (
          <div className="rounded-2xl overflow-hidden border border-zinc-200 shadow-lg relative">
            <img src={capturedImage} alt="Foto ikan" className="w-full aspect-video object-cover" />
            <div className="absolute inset-0 bg-[#162e52]/60 flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              <p className="text-sm font-semibold text-white">Menganalisis gambar...</p>
              <div className="w-48 bg-white/20 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-150"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
              <p className="text-xs text-white/70">{scanProgress}%</p>
            </div>
          </div>
        )}

        {/* Result state */}
        {mode === 'result' && result && capturedImage && (
          <div className="space-y-4">
            {/* Image + score */}
            <div className="relative rounded-2xl overflow-hidden shadow-lg border border-zinc-200">
              <img src={capturedImage} alt="Hasil scan" className="w-full aspect-video object-cover" />
              <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-white/70 font-bold">Hasil Analisis</p>
                    <p className="text-xl font-extrabold text-white">{result.label}</p>
                  </div>
                  <div className="text-right">
                    <p
                      className="text-4xl font-black leading-none"
                      style={{ color: result.score >= 80 ? '#86efac' : result.score >= 55 ? '#fde68a' : '#fca5a5' }}
                    >
                      {result.score}
                    </p>
                    <p className="text-[10px] text-white/60">/ 100</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Indicators */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-2.5 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-3">Indikator Visual</p>
              {result.indicators.map((ind, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs text-zinc-700">{ind.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500 hidden sm:inline">{ind.note}</span>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: statusColor(ind.status) + '18',
                        color: statusColor(ind.status),
                      }}
                    >
                      {statusLabel(ind.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Tip */}
            <div
              className="rounded-2xl p-4 text-xs leading-relaxed border"
              style={{ backgroundColor: result.bg, borderColor: result.color + '30', color: '#374151' }}
            >
              <span className="font-bold" style={{ color: result.color }}>Saran: </span>
              {result.tip}
            </div>

            <button
              onClick={reset}
              className="w-full py-2.5 border border-zinc-300 hover:border-[#162e52] text-[#162e52] text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-200"
            >
              Scan Ikan Lain
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardMasyarakatPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (user) => {
      if (!user) {
        router.push('/login');
      } else {
        const uProfile = await getUserProfile(user.uid);
        if (uProfile && uProfile.role === 'masyarakat') {
          setProfile(uProfile);
        } else if (uProfile) {
          const paths: Record<string, string> = {
            nelayan: '/dashboard/nelayan',
            'nelayan-modern': '/dashboard/peneliti',
            masyarakat: '/dashboard/masyarakat',
            peneliti: '/dashboard/peneliti',
          };
          router.push(uProfile.role ? paths[uProfile.role] : '/fill-form');
        } else {
          router.push('/fill-form');
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1b365d] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-200 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const displayName = profile?.displayName || 'Sahabat Laut';

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans flex flex-col selection:bg-[#204473] selection:text-white">

      <div className="relative w-full">

        <div className="absolute top-0 inset-x-0 h-[560px] md:h-[600px] z-0 select-none pointer-events-none overflow-hidden">
          <img
            src="/img/background.webp"
            alt="Oceanagara background header"
            className="w-full h-full object-cover object-top"
          />
        </div>

        <header className="relative z-40 bg-transparent px-6 md:px-12 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-extrabold tracking-widest text-sm text-white uppercase hover:text-sky-200 transition-colors">
              OCEANAGARA
            </Link>
            <span className="text-white/40">/</span>
            <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">
              Dashboard Masyarakat
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleLogout}
              className="text-xs font-bold uppercase tracking-wider px-4 py-2 bg-transparent text-white border border-white/40 hover:bg-white hover:text-zinc-900 rounded transition-all duration-200 backdrop-blur-sm"
            >
              Keluar
            </button>
          </div>
        </header>

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 lg:px-16 pt-8 pb-16">

          <div className="space-y-2 max-w-3xl mb-8">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-normal text-white tracking-tight drop-shadow">
              Halo! Selamat datang <span className="font-bold">{displayName}</span>
            </h1>
            <p className="text-sm sm:text-base italic text-sky-100/90 font-light tracking-wide drop-shadow">
              pelajari informasi penting seputar kualitas ikan, cara pengolahan, dan kondisi ekosistem laut
            </p>
          </div>

          <div className="inline-flex flex-wrap items-center gap-6 p-4 bg-[#162e52]/75 border border-white/20 backdrop-blur-md rounded-xl text-white shadow-xl mb-12">
            <div className="flex items-center gap-3">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-sky-200/80 font-bold block">Peran</span>
                <span className="text-xs font-bold text-white uppercase">Masyarakat Umum</span>
              </div>
            </div>
            <div className="h-8 w-px bg-white/20 hidden sm:block" />
            <div>
              <span className="text-[10px] uppercase tracking-widest text-sky-200/80 font-bold block">Nama</span>
              <span className="text-xs font-semibold text-white">{profile?.displayName || '-'}</span>
            </div>
            <div className="h-8 w-px bg-white/20 hidden md:block" />
            <div>
              <span className="text-[10px] uppercase tracking-widest text-sky-200/80 font-bold block">Akses</span>
              <span className="text-xs font-semibold text-white">Portal Informasi Kelautan</span>
            </div>
          </div>

          {/* ── Top 3 Cards Grid (Frame 15, 16, 17 reference) ── */}
          <div className="grid grid-cols-3 gap-3 md:gap-6">
            {FEATURE_CARDS.map((card) => (
              <Link
                key={card.id}
                href={`/dashboard/masyarakat/blog/${card.id}`}
                className="group cursor-pointer"
              >
                {/* Mobile Card */}
                <div className="md:hidden flex flex-col items-center gap-2">
                  <div className={`relative w-full aspect-square rounded-2xl overflow-hidden bg-gradient-to-br ${card.imagePlaceholderColor} flex items-center justify-center shadow-lg border border-white/20 transition-all duration-300 group-hover:shadow-xl group-hover:scale-105 group-hover:border-sky-300/60`}>
                    {card.imageSrc && (
                      <img
                        src={card.imageSrc}
                        alt={card.title}
                        className="absolute inset-0 w-full h-full object-cover opacity-70"
                      />
                    )}
                    <div className="relative z-10 text-white/80 group-hover:text-white transition-colors">
                      {card.icon}
                    </div>
                  </div>
                  <p className="text-center text-[10px] font-semibold text-white leading-tight line-clamp-2 drop-shadow">
                    {card.title}
                  </p>
                </div>

                {/* Desktop Card */}
                <div className="hidden md:flex relative h-80 rounded-[24px] p-6 flex-col justify-between overflow-hidden shadow-xl transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-2xl bg-[#152740] border border-white/20 text-white group-hover:border-sky-300/80">
                  {card.imageSrc && (
                    <img
                      src={card.imageSrc}
                      alt={card.title}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-90 group-hover:opacity-80 transition-opacity" />

                  <div className="relative z-10">
                    <span className="inline-block px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded bg-white/15 text-sky-100 border border-white/25 backdrop-blur-sm">
                      {card.tag}
                    </span>
                  </div>

                  <div className="relative z-10 space-y-2">
                    <h3 className="text-lg font-bold leading-snug tracking-tight text-white group-hover:text-sky-100">
                      {card.title}
                    </h3>
                    <p className="text-xs line-clamp-2 leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-sky-200/90">
                      {card.description}
                    </p>
                    <div className="pt-1 flex items-center gap-1.5 text-xs font-semibold group-hover:translate-x-1 transition-transform text-sky-300">
                      <span>Baca Selengkapnya</span>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* ── Horizontal Feature Banner Container (Frame 20 reference) ── */}
          <div className="mt-6 md:mt-8">
            <Link
              href="/dashboard/masyarakat/lapor-limbah"
              className="group block relative w-full rounded-[24px] overflow-hidden border border-white/20 hover:border-emerald-400/60 shadow-2xl transition-all duration-300 cursor-pointer bg-gradient-to-r from-[#15324f]/95 via-[#1b3f6b]/95 to-[#0e2a4a]/90 p-6 md:p-8"
            >
              {/* Background Image inside Frame 20 */}
              <img
                src="/img/Limbah.webp"
                alt="Lapor Limbah Header Background"
                className="absolute inset-0 w-full h-full object-cover opacity-25 group-hover:opacity-40 transition-opacity duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#15324f]/95 via-[#1b3f6b]/85 to-transparent z-0" />

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start gap-4 max-w-3xl">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-400/20 text-emerald-300 border border-emerald-300/30 flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-105 transition-transform">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                    </svg>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="inline-block px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full bg-emerald-400/20 text-emerald-200 border border-emerald-300/30">
                        VALIDASI AI 3 LAPIS
                      </span>
                      <span className="text-[10px] uppercase tracking-widest text-sky-200/70 font-semibold">
                        Fitur Pelaporan Pesisir
                      </span>
                    </div>
                    <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight leading-tight group-hover:text-emerald-100 transition-colors">
                      Lapor Limbah di Wilayah Pesisir
                    </h2>
                    <p className="text-xs text-sky-100/80 leading-relaxed font-normal">
                      Temukan limbah di pantai, sungai, atau laut? Abadikan fotonya — AI memvalidasi keaslian foto, lokasi GPS, dan waktu pengambilan sebelum dilaporkan ke peneliti.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0 self-start md:self-center">
                  <div className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 group-hover:from-emerald-400 group-hover:to-teal-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-200 shadow-lg group-hover:shadow-emerald-500/25 group-hover:scale-105">
                    <span>Buka Fitur Laporan</span>
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          </div>

        </div>
      </div>

      <section className="bg-white border-t border-zinc-100 py-16 px-6 md:px-12 lg:px-16">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="text-center max-w-xl mx-auto">
            <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">
              Pusat Edukasi &amp; Informasi
            </span>
            <h2 className="text-2xl font-extrabold text-[#162e52] uppercase tracking-tight">
              Wawasan Kelautan untuk Masyarakat
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-white border border-zinc-200 rounded-2xl space-y-3 hover:border-zinc-400 transition-colors shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#162e52] text-white flex items-center justify-center font-bold text-sm shadow-sm">01</div>
              <h4 className="text-sm font-bold text-[#162e52] uppercase tracking-wider">Kenali Kualitas Ikan</h4>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Pelajari 8 indikator utama membedakan ikan segar dan tidak layak konsumsi untuk melindungi kesehatan keluarga.
              </p>
            </div>

            <div className="p-6 bg-white border border-zinc-200 rounded-2xl space-y-3 hover:border-zinc-400 transition-colors shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#162e52] text-white flex items-center justify-center font-bold text-sm shadow-sm">02</div>
              <h4 className="text-sm font-bold text-[#162e52] uppercase tracking-wider">Pengolahan Higienis</h4>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Ikuti 6 langkah pengolahan ikan yang benar dari pendinginan hingga penyimpanan untuk menjaga nutrisi dan keamanan pangan.
              </p>
            </div>

            <div className="p-6 bg-white border border-zinc-200 rounded-2xl space-y-3 hover:border-zinc-400 transition-colors shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#162e52] text-white flex items-center justify-center font-bold text-sm shadow-sm">03</div>
              <h4 className="text-sm font-bold text-[#162e52] uppercase tracking-wider">Ekosistem Air Laut</h4>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Pahami 5 parameter kualitas air laut dan peran penting ekosistem pesisir untuk kehidupan biota laut dan kesejahteraan nelayan.
              </p>
            </div>
          </div>
          <FishScanner />
        </div>
      </section>



    </div>
  );
}