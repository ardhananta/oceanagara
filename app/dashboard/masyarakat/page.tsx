'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { onAuthChange, logout, getUserProfile, UserProfile } from '@/app/service/authentication';



const FishIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M6.5 12C6.5 12 2 9 2 6c4 0 6.5 3 6.5 6z" />
    <path d="M6.5 12C6.5 12 2 15 2 18c4 0 6.5-3 6.5-6z" />
    <path d="M6.5 12h11" />
    <circle cx="19" cy="12" r="3" />
    <circle cx="20" cy="11" r="0.5" fill="currentColor" />
  </svg>
);

const WaterDropIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M12 2C12 2 5 9.5 5 14a7 7 0 0014 0C19 9.5 12 2 12 2z" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0">
    <circle cx="12" cy="12" r="10" />
    <polyline points="9,12 11,14 15,10" />
  </svg>
);

const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0">
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

const XCircleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

const WavesIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    <path d="M2 12c.6.5 1.2 1 2.5 1C7 13 7 11 9.5 11c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    <path d="M2 18c.6.5 1.2 1 2.5 1C7 19 7 17 9.5 17c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
  </svg>
);

const ChefHatIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z" />
    <line x1="6" y1="17" x2="18" y2="17" />
  </svg>
);

const ThermometerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
  </svg>
);

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

// ── Main Page ────────────────────────────────────────────────────────────────
export default function DashboardMasyarakatPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pengolahan' | 'kesegaran' | 'air-laut'>('pengolahan');

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
            'nelayan': '/dashboard/nelayan',
            'nelayan-modern': '/dashboard/peneliti',
            'masyarakat': '/dashboard/masyarakat',
            'peneliti': '/dashboard/peneliti',
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

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-sky-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-sky-200 border-t-sky-500 rounded-full animate-spin" style={{ borderWidth: '3px' }} />
          <p className="text-sky-600 text-sm font-medium">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-800 font-sans">

      {/* ── Navbar ────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-sky-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center">
              <WavesIcon />
            </div>
            <span className="font-extrabold tracking-wider text-slate-800 text-lg">
              OCEAN<span className="text-sky-500">AGARA</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block animate-pulse" />
              Masyarakat Umum
            </span>
            <button
              id="btn-logout"
              onClick={handleLogout}
              className="text-xs font-semibold text-slate-500 hover:text-red-500 bg-slate-100 hover:bg-red-50 border border-slate-200 hover:border-red-200 px-3 py-1.5 rounded-full transition-all duration-200"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero Section ──────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-r from-sky-500 via-blue-500 to-cyan-500">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-40 h-40 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-0 right-20 w-60 h-60 rounded-full bg-white blur-3xl" />
          <div className="absolute top-0 right-1/3 w-32 h-32 rounded-full bg-white blur-2xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-bold text-white/80 uppercase tracking-widest bg-white/20 px-3 py-1.5 rounded-full mb-4">
                <WavesIcon />
                Portal Informasi Kelautan
              </span>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-4">
                Selamat Datang,<br />
                <span className="text-cyan-200">{profile?.displayName || 'Sahabat Laut'}!</span>
              </h1>
              <p className="text-white/80 text-base md:text-lg leading-relaxed max-w-lg">
                Pelajari cara pengolahan ikan yang benar, kenali perbedaan ikan segar,
                dan pahami ciri-ciri air laut yang sehat untuk kelestarian ekosistem pesisir kita.
              </p>
            </div>
            <div className="hidden lg:block relative h-64">
              <div className="absolute inset-0 rounded-2xl overflow-hidden shadow-2xl shadow-blue-900/30">
                <Image
                  src="/img/ocean_water_quality.png"
                  alt="Ekosistem Laut Sehat"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-blue-600/40 to-transparent" />
              </div>
            </div>
          </div>
        </div>
        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 60L60 50C120 40 240 20 360 15C480 10 600 20 720 27.5C840 35 960 40 1080 37.5C1200 35 1320 25 1380 20L1440 15V60H0Z" fill="white" fillOpacity="0.05" />
            <path d="M0 60L60 55C120 50 240 40 360 37.5C480 35 600 40 720 45C840 50 960 55 1080 52.5C1200 50 1320 42.5 1380 38.8L1440 35V60H0Z" fill="rgb(240 249 255)" />
          </svg>
        </div>
      </section>

      {/* ── Info Cards (Quick Stats) ───────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-0 pt-6 pb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: <ChefHatIcon />, title: '6 Langkah', desc: 'Pengolahan ikan yang higienis & aman', color: 'from-orange-400 to-amber-500', bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-600' },
            { icon: <EyeIcon />, title: '8 Ciri', desc: 'Membedakan ikan segar dan tidak layak', color: 'from-emerald-400 to-teal-500', bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-600' },
            { icon: <WaterDropIcon />, title: '5 Parameter', desc: 'Indikator kualitas air laut yang sehat', color: 'from-sky-400 to-blue-500', bg: 'bg-sky-50', border: 'border-sky-100', text: 'text-sky-600' },
          ].map((card, i) => (
            <div key={i} className={`${card.bg} border ${card.border} rounded-2xl p-5 flex items-center gap-4`}>
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center text-white flex-shrink-0`}>
                {card.icon}
              </div>
              <div>
                <p className={`text-lg font-extrabold ${card.text}`}>{card.title}</p>
                <p className="text-xs text-slate-500 leading-snug">{card.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Main Content ──────────────────────────────────── */}
      <main id="info-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Tab Switcher */}
        <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl w-full md:w-fit">
          {(['pengolahan', 'kesegaran', 'air-laut'] as const).map((tab) => {
            const labels = { pengolahan: 'Pengolahan Ikan', kesegaran: 'Ikan Segar vs Tidak', 'air-laut': 'Kualitas Air Laut' };
            return (
              <button
                key={tab}
                id={`main-tab-${tab}`}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 md:flex-none text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 whitespace-nowrap ${activeTab === tab
                  ? 'bg-white text-sky-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {/* ── TAB: Pengolahan Ikan ───────────────────────── */}
        {activeTab === 'pengolahan' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Hero image + intro */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="relative h-56 md:h-72">
                  <Image src="/img/fish_processing.png" alt="Cara Pengolahan Ikan" fill className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-5">
                    <span className="text-xs font-bold text-white/80 uppercase tracking-wider">Panduan Lengkap</span>
                    <h2 className="text-xl md:text-2xl font-extrabold text-white">Pengolahan Ikan yang Benar</h2>
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Pengolahan ikan yang benar sangat penting untuk menjaga <strong>kualitas gizi</strong>,
                    <strong> keamanan pangan</strong>, dan mencegah kontaminasi bakteri berbahaya.
                    Ikan adalah sumber protein tinggi yang mudah rusak, sehingga penanganan yang tepat
                    sejak penangkapan hingga konsumsi sangat krusial.
                  </p>
                </div>
              </div>
              <div className="lg:col-span-2 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                    <span className="text-lg">⚠️</span>
                  </div>
                  <h3 className="font-bold text-amber-800 text-sm">Mengapa Penting?</h3>
                </div>
                <ul className="space-y-3">
                  {[
                    'Ikan mudah terkontaminasi bakteri dalam 2 jam di suhu ruang',
                    'Bakteri berbahaya seperti Salmonella bisa berkembang cepat',
                    'Pengolahan buruk menyebabkan keracunan makanan',
                    'Nutrisi ikan bisa hilang jika dimasak dengan cara yang salah',
                    'Higienitas menjaga kualitas dan nilai jual ikan',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-amber-900">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 mt-1.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 6 Langkah */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white">
                  <ChefHatIcon />
                </div>
                <div>
                  <h2 className="font-extrabold text-slate-800 text-lg">6 Langkah Pengolahan Ikan yang Benar</h2>
                  <p className="text-xs text-slate-500">Dari penangkapan hingga siap sajikan</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  {
                    step: '01',
                    title: 'Segera Dinginkan',
                    icon: '🧊',
                    color: 'border-sky-200 bg-sky-50',
                    badge: 'bg-sky-100 text-sky-700',
                    desc: 'Setelah ditangkap, segera masukkan ikan ke dalam wadah berisi es batu atau es serut. Suhu ideal penyimpanan adalah 0–4°C. Jangan biarkan ikan terkena sinar matahari langsung.',
                    tip: 'Gunakan perbandingan 1:1 antara ikan dan es',
                  },
                  {
                    step: '02',
                    title: 'Cuci dengan Air Bersih',
                    icon: '🚿',
                    color: 'border-blue-200 bg-blue-50',
                    badge: 'bg-blue-100 text-blue-700',
                    desc: 'Cuci ikan di bawah air mengalir yang bersih. Bersihkan bagian insang, rongga perut, dan sisik. Hindari air genangan yang bisa menjadi sumber bakteri.',
                    tip: 'Air mengalir lebih efektif dari air bak yang diam',
                  },
                  {
                    step: '03',
                    title: 'Bersihkan Isi Perut',
                    icon: '🔪',
                    color: 'border-teal-200 bg-teal-50',
                    badge: 'bg-teal-100 text-teal-700',
                    desc: 'Keluarkan isi perut ikan sesegera mungkin karena ini adalah sumber utama bakteri pembusuk. Gunakan pisau bersih dan cuci tangan terlebih dahulu.',
                    tip: 'Insang juga perlu dibuang karena mengandung bakteri tinggi',
                  },
                  {
                    step: '04',
                    title: 'Pisahkan dari Produk Lain',
                    icon: '📦',
                    color: 'border-violet-200 bg-violet-50',
                    badge: 'bg-violet-100 text-violet-700',
                    desc: 'Simpan ikan terpisah dari sayuran, daging, atau bahan makanan lain untuk menghindari kontaminasi silang. Gunakan wadah tertutup dan berlabel.',
                    tip: 'Taruh ikan di rak paling bawah kulkas',
                  },
                  {
                    step: '05',
                    title: 'Masak Hingga Matang',
                    icon: '🍳',
                    color: 'border-rose-200 bg-rose-50',
                    badge: 'bg-rose-100 text-rose-700',
                    desc: 'Masak ikan pada suhu minimal 70°C (bagian dalam daging) untuk membunuh semua bakteri patogen. Hindari setengah matang kecuali untuk hidangan khusus seperti sashimi dari ikan segar terjamin.',
                    tip: 'Daging ikan yang matang akan mudah dipisah dengan garpu',
                  },
                  {
                    step: '06',
                    title: 'Simpan Sisa Masakan',
                    icon: '🧺',
                    color: 'border-emerald-200 bg-emerald-50',
                    badge: 'bg-emerald-100 text-emerald-700',
                    desc: 'Sisa masakan ikan harus disimpan dalam wadah tertutup di kulkas dan dikonsumsi dalam 1–2 hari. Panaskan kembali hingga benar-benar panas sebelum dimakan.',
                    tip: 'Jangan diamkan sisa ikan matang lebih dari 2 jam di suhu ruang',
                  },
                ].map((item) => (
                  <div key={item.step} className={`border-2 ${item.color} rounded-xl p-5 group hover:shadow-md transition-shadow duration-200`}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{item.icon}</span>
                      <div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.badge}`}>Langkah {item.step}</span>
                        <h3 className="font-bold text-slate-800 text-sm mt-0.5">{item.title}</h3>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed mb-3">{item.desc}</p>
                    <div className="flex items-start gap-1.5 bg-white/60 rounded-lg px-3 py-2">
                      <span className="text-yellow-500 text-sm flex-shrink-0">💡</span>
                      <p className="text-xs text-slate-500 italic">{item.tip}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Metode Pengawetan */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 md:p-8 text-white">
              <h3 className="font-extrabold text-lg mb-1">Metode Pengawetan Ikan Tradisional & Modern</h3>
              <p className="text-slate-400 text-sm mb-6">Pilih metode yang sesuai kebutuhan dan ketersediaan fasilitas</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { name: 'Pendinginan', desc: 'Es atau kulkas 0–4°C. Tahan 1–3 hari', icon: '❄️', daya: '1-3 hari' },
                  { name: 'Pembekuan', desc: 'Freezer -18°C. Awet paling lama', icon: '🧊', daya: '3-12 bulan' },
                  { name: 'Penggaraman', desc: 'Metode tradisional mengurangi kadar air', icon: '🧂', daya: '1-6 bulan' },
                  { name: 'Pengasapan', desc: 'Panas atau dingin, memberi cita rasa khas', icon: '🔥', daya: '1-3 bulan' },
                ].map((m, i) => (
                  <div key={i} className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 transition-colors duration-200">
                    <div className="text-3xl mb-3">{m.icon}</div>
                    <h4 className="font-bold text-sm mb-1">{m.name}</h4>
                    <p className="text-slate-400 text-xs leading-relaxed mb-2">{m.desc}</p>
                    <span className="text-xs text-sky-400 font-semibold bg-sky-500/10 px-2 py-0.5 rounded-full">
                      ⏱ {m.daya}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: Kesegaran Ikan ─────────────────────────── */}
        {activeTab === 'kesegaran' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="relative h-56 md:h-72">
                  <Image src="/img/fresh_vs_spoiled_fish.png" alt="Perbedaan Ikan Segar dan Tidak Segar" fill className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-5">
                    <span className="text-xs font-bold text-white/80 uppercase tracking-wider">Panduan Konsumen</span>
                    <h2 className="text-xl md:text-2xl font-extrabold text-white">Kenali Ikan Segar vs Tidak Segar</h2>
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Kemampuan membedakan ikan segar adalah keterampilan dasar yang penting untuk
                    <strong> menjaga kesehatan keluarga</strong>. Ikan yang tidak segar mengandung bakteri
                    dan toksin yang bisa menyebabkan keracunan makanan serius.
                  </p>
                </div>
              </div>
              <div className="lg:col-span-2 space-y-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">✅</span>
                    <h3 className="font-bold text-emerald-800">Ikan Segar — Aman Dikonsumsi</h3>
                  </div>
                  <ul className="space-y-2">
                    {['Aroma amis segar, bukan busuk menyengat', 'Mata jernih dan cembung menonjol', 'Insang berwarna merah cerah', 'Daging kenyal, membal saat ditekan', 'Sisik melekat kuat dan mengkilap'].map((c, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-emerald-900">
                        <CheckCircleIcon />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">❌</span>
                    <h3 className="font-bold text-red-800">Ikan Tidak Segar — Hindari!</h3>
                  </div>
                  <ul className="space-y-2">
                    {['Bau busuk tajam atau amonia', 'Mata keruh, cekung, berwarna abu-abu', 'Insang berwarna cokelat atau abu-abu', 'Daging lembek, tidak kembali saat ditekan', 'Sisik mudah lepas dan kusam'].map((c, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-red-900">
                        <XCircleIcon />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Tabel Perbandingan Detail */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-5">
                <h3 className="font-extrabold text-white text-lg">Tabel Perbandingan Lengkap</h3>
                <p className="text-white/80 text-sm">Panduan visual membedakan ikan segar dan tidak segar</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-5 py-3 font-bold text-slate-700 text-xs uppercase tracking-wider w-1/3">Parameter</th>
                      <th className="text-left px-5 py-3 font-bold text-emerald-700 text-xs uppercase tracking-wider w-1/3">✅ Ikan Segar</th>
                      <th className="text-left px-5 py-3 font-bold text-red-700 text-xs uppercase tracking-wider w-1/3">❌ Ikan Tidak Segar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      { param: '👃 Bau / Aroma', segar: 'Segar khas laut, amis ringan', tidak: 'Bau busuk, menyengat, seperti amonia' },
                      { param: '👁️ Mata', segar: 'Jernih, cembung, kornea tidak keruh', tidak: 'Cekung, keruh, abu-abu kemerahan' },
                      { param: '🩺 Insang', segar: 'Merah cerah atau merah muda, lembab', tidak: 'Abu-abu, cokelat, atau hitam, kering' },
                      { param: '🤏 Tekstur Daging', segar: 'Kenyal, kencang, membal ketika ditekan', tidak: 'Lembek, berlendir, meninggalkan bekas' },
                      { param: '✨ Sisik', segar: 'Mengkilap, menempel kuat pada tubuh', tidak: 'Kusam, mudah lepas, retak' },
                      { param: '🎨 Warna Kulit', segar: 'Cerah, mengkilap, warna alami', tidak: 'Pudar, kusam, bercak tidak wajar' },
                      { param: '🫧 Lendir', segar: 'Lendir tipis, jernih, merata', tidak: 'Lendir tebal, keruh, berbau' },
                      { param: '💧 Rongga Perut', segar: 'Tidak menggembung, bersih', tidak: 'Menggembung, bergas, berbau' },
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3 font-semibold text-slate-700 text-xs">{row.param}</td>
                        <td className="px-5 py-3 text-emerald-700 text-xs">{row.segar}</td>
                        <td className="px-5 py-3 text-red-700 text-xs">{row.tidak}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tips Beli Ikan */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-100 rounded-2xl p-5">
                <h4 className="font-bold text-sky-800 mb-3 flex items-center gap-2">
                  <span>🛒</span> Tips Membeli Ikan di Pasar
                </h4>
                <ul className="space-y-2">
                  {[
                    'Belanja di pagi hari saat ikan baru datang',
                    'Pilih ikan yang disimpan di atas es, bukan air',
                    'Sentuh ikan dan cium aromanya sebelum membeli',
                    'Tanyakan kepada penjual kapan ikan ditangkap',
                    'Bawa cooler bag saat berbelanja ikan',
                  ].map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-sky-900">
                      <span className="text-sky-400 font-bold flex-shrink-0">{i + 1}.</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-gradient-to-br from-rose-50 to-orange-50 border border-rose-100 rounded-2xl p-5">
                <h4 className="font-bold text-rose-800 mb-3 flex items-center gap-2">
                  <span>🚨</span> Bahaya Mengonsumsi Ikan Tidak Segar
                </h4>
                <ul className="space-y-2">
                  {[
                    'Keracunan histamin (scombroid poisoning)',
                    'Infeksi bakteri Vibrio cholerae',
                    'Keracunan Staphylococcus aureus',
                    'Diare, muntah, dan kram perut parah',
                    'Risiko tinggi pada ibu hamil & anak-anak',
                  ].map((risk, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-rose-900">
                      <span className="text-rose-400 font-bold flex-shrink-0">•</span>
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: Kualitas Air Laut ──────────────────────── */}
        {activeTab === 'air-laut' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="relative h-56 md:h-72">
                  <Image src="/img/ocean_water_quality.png" alt="Kualitas Air Laut Sehat" fill className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-5">
                    <span className="text-xs font-bold text-white/80 uppercase tracking-wider">Ekosistem Laut</span>
                    <h2 className="text-xl md:text-2xl font-extrabold text-white">Ciri Air Laut yang Sehat</h2>
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Air laut yang sehat adalah fondasi kehidupan laut. Kualitas air laut menentukan
                    <strong> ketahanan ekosistem</strong>, <strong>keberhasilan nelayan</strong>, dan
                    <strong> keselamatan wisatawan</strong>. Kenali ciri-ciri air laut yang layak dan sehat.
                  </p>
                </div>
              </div>
              <div className="lg:col-span-2 bg-gradient-to-br from-sky-600 to-blue-700 rounded-2xl p-6 text-white">
                <div className="flex items-center gap-2 mb-4">
                  <WaterDropIcon />
                  <h3 className="font-bold text-sm">Tahukah Kamu?</h3>
                </div>
                <div className="space-y-3">
                  {[
                    { val: '70%', label: 'permukaan bumi adalah lautan' },
                    { val: '50%', label: 'oksigen bumi dihasilkan lautan' },
                    { val: '80%', label: 'kehidupan bumi berada di laut' },
                    { val: '3 Miliar', label: 'orang bergantung pada protein laut' },
                  ].map((stat, i) => (
                    <div key={i} className="bg-white/10 rounded-xl px-4 py-3">
                      <p className="text-2xl font-extrabold text-cyan-200">{stat.val}</p>
                      <p className="text-white/80 text-xs capitalize">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 5 Parameter Kualitas Air */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white">
                  <WaterDropIcon />
                </div>
                <div>
                  <h2 className="font-extrabold text-slate-800 text-lg">5 Parameter Kualitas Air Laut Sehat</h2>
                  <p className="text-xs text-slate-500">Indikator ilmiah yang digunakan para ahli kelautan</p>
                </div>
              </div>
              <div className="space-y-4">
                {[
                  {
                    no: '01',
                    title: 'Kejernihan & Warna Air',
                    icon: '💎',
                    color: 'from-cyan-400 to-sky-500',
                    bg: 'bg-cyan-50',
                    border: 'border-cyan-200',
                    sehat: [
                      'Air berwarna biru jernih hingga biru kehijauan alami',
                      'Jarak pandang di bawah air (visibilitas) minimal 10–20 meter',
                      'Tidak ada lapisan minyak atau buih tebal di permukaan',
                      'Warna hijau ringan pada area dengan plankton normal adalah wajar',
                    ],
                    bahaya: 'Air berwarna cokelat, merah, atau hitam pekat menandakan polusi atau harmful algal bloom (HAB).',
                  },
                  {
                    no: '02',
                    title: 'Kadar Salinitas (Garam)',
                    icon: '🧂',
                    color: 'from-blue-400 to-indigo-500',
                    bg: 'bg-blue-50',
                    border: 'border-blue-200',
                    sehat: [
                      'Salinitas normal laut tropis: 30–35 PSU (Practical Salinity Unit)',
                      'Salinitas stabil menunjukkan tidak ada pencemaran air tawar berlebih',
                      'Perubahan salinitas yang drastis bisa mengganggu kehidupan biota laut',
                      'Air laut dekat muara sungai memiliki salinitas lebih rendah (brackish)',
                    ],
                    bahaya: 'Salinitas sangat rendah (<20 PSU) di tengah laut bisa menunjukkan pencemaran atau banjir besar.',
                  },
                  {
                    no: '03',
                    title: 'Tingkat Keasaman (pH)',
                    icon: '⚗️',
                    color: 'from-violet-400 to-purple-500',
                    bg: 'bg-violet-50',
                    border: 'border-violet-200',
                    sehat: [
                      'pH sehat air laut berkisar 7.8–8.3 (sedikit basa)',
                      'pH stabil menandakan keseimbangan karbon dioksida di laut terjaga',
                      'Terumbu karang membutuhkan pH minimal 7.9 untuk tumbuh optimal',
                      'Perubahan pH 0.5 unit saja bisa berdampak besar pada ekosistem',
                    ],
                    bahaya: 'pH < 7.5 (asidifikasi laut) akibat penyerapan CO₂ berlebih mengancam terumbu karang dan kerang.',
                  },
                  {
                    no: '04',
                    title: 'Kadar Oksigen Terlarut (DO)',
                    icon: '🫧',
                    color: 'from-teal-400 to-emerald-500',
                    bg: 'bg-teal-50',
                    border: 'border-teal-200',
                    sehat: [
                      'Kadar oksigen terlarut (DO) ideal: ≥6 mg/L',
                      'Oksigen cukup ditandai dengan kehidupan biota yang aktif dan beragam',
                      'Zona "dead zone" terjadi ketika DO < 2 mg/L — tidak ada kehidupan',
                      'Ikan dan udang laut membutuhkan DO minimal 4–5 mg/L untuk hidup',
                    ],
                    bahaya: 'Eutrofikasi dari limbah pertanian menyebabkan alga meledak dan menghabiskan oksigen (hypoxia).',
                  },
                  {
                    no: '05',
                    title: 'Keberadaan Biota Indikator',
                    icon: '🐠',
                    color: 'from-rose-400 to-pink-500',
                    bg: 'bg-rose-50',
                    border: 'border-rose-200',
                    sehat: [
                      'Keberadaan terumbu karang hidup dan berwarna-warni menandakan air sehat',
                      'Populasi ikan beragam dan banyak adalah tanda ekosistem seimbang',
                      'Lamun (seagrass) tumbuh di dasar perairan menandakan air jernih',
                      'Bintang laut, bulu babi, dan kuda laut hanya hidup di air berkualitas baik',
                    ],
                    bahaya: 'Karang memutih (bleaching), alga invasif menutupi karang, atau tidak ada ikan adalah tanda bahaya serius.',
                  },
                ].map((param) => (
                  <div key={param.no} className={`${param.bg} border-2 ${param.border} rounded-xl overflow-hidden`}>
                    <div className="p-5">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${param.color} flex items-center justify-center text-xl flex-shrink-0`}>
                          {param.icon}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Parameter {param.no}</span>
                          <h3 className="font-bold text-slate-800">{param.title}</h3>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-bold text-emerald-700 mb-2 uppercase tracking-wider">✅ Ciri Air Sehat</p>
                          <ul className="space-y-1.5">
                            {param.sehat.map((ciri, j) => (
                              <li key={j} className="flex items-start gap-2 text-xs text-slate-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0 mt-1.5" />
                                {ciri}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                          <p className="text-xs font-bold text-red-700 mb-1.5 uppercase tracking-wider">⚠️ Tanda Bahaya</p>
                          <p className="text-xs text-red-800 leading-relaxed">{param.bahaya}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Apa yang Bisa Dilakukan */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-6">
                <h3 className="font-extrabold text-emerald-800 text-base mb-4 flex items-center gap-2">
                  <span>🌿</span> Yang Bisa Kamu Lakukan untuk Menjaga Kualitas Air Laut
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { act: 'Buang sampah pada tempatnya, tidak ke sungai atau pantai', icon: '🗑️' },
                    { act: 'Gunakan produk ramah lingkungan saat beraktivitas di pantai', icon: '🧴' },
                    { act: 'Jangan menyentuh atau merusak terumbu karang saat menyelam', icon: '🤿' },
                    { act: 'Dukung program daur ulang sampah plastik di pesisir', icon: '♻️' },
                    { act: 'Laporkan pencemaran laut ke otoritas setempat atau KLHK', icon: '📢' },
                    { act: 'Kurangi penggunaan pupuk kimia yang mengalir ke laut', icon: '🌱' },
                  ].map((a, i) => (
                    <div key={i} className="flex items-start gap-2 bg-white/70 rounded-xl px-3 py-2.5">
                      <span className="text-base flex-shrink-0">{a.icon}</span>
                      <p className="text-xs text-emerald-900 leading-relaxed">{a.act}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-gradient-to-br from-sky-800 to-blue-900 rounded-2xl p-6 text-white flex flex-col justify-between">
                <div>
                  <div className="text-4xl mb-3">🌏</div>
                  <h3 className="font-extrabold text-lg mb-2 leading-tight">Jaga Laut, Jaga Masa Depan</h3>
                  <p className="text-white/70 text-xs leading-relaxed">
                    Laut yang sehat berarti nelayan yang sejahtera, wisata yang berkelanjutan,
                    dan pangan laut yang aman untuk generasi mendatang.
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-white/20">
                  <p className="text-white/50 text-xs">Sumber Referensi:</p>
                  <p className="text-white/80 text-xs mt-1">BRIN · KKP · LIPI Oseanografi · UNEP</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center">
              <span className="text-white text-xs">🌊</span>
            </div>
            <span className="font-bold text-slate-700 text-sm">OCEAN<span className="text-sky-500">AGARA</span></span>
          </div>
          <p className="text-xs text-slate-400 text-center">
            Portal Informasi Kelautan & Perikanan Indonesia · Untuk Masyarakat Umum
          </p>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Informasi diperbarui secara berkala
          </div>
        </div>
      </footer>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        body { font-family: 'Inter', sans-serif; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
      `}</style>
    </div>
  );}
