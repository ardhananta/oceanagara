'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthChange, getUserProfile } from '@/app/service/authentication';
import heroImg from '@/public/img/MasyarakatKualitasIkan.png';
import articleImg from '@/public/img/fresh_vs_spoiled_fish.png';
import relatedImg1 from '@/public/img/MasyarakatPengolahanIkan.png';
import relatedImg2 from '@/public/img/MasyarakatAirLaut.png';

const INDICATORS = [
  {
    number: '01',
    title: 'Kondisi Mata',
    detail:
      'Mata adalah indikator paling mudah dilihat secara langsung. Ikan segar memiliki mata yang menonjol ke luar (cembung), bening seperti kaca, dan kornea tampak transparan. Hindari ikan dengan mata yang sudah cekung, keruh, atau berwarna abu-abu.',
    fresh: 'Jernih, cembung, kornea transparan',
    spoiled: 'Keruh, cekung, kornea buram',
  },
  {
    number: '02',
    title: 'Warna Insang',
    detail:
      'Insang adalah organ pernapasan ikan yang sangat sensitif terhadap perubahan kesegaran. Insang ikan segar berwarna merah cerah atau merah muda terang dan tidak berlendir berlebihan. Warna yang semakin kusam, pucat, atau kecokelatan menandakan ikan sudah lama dari perairan.',
    fresh: 'Merah cerah, tidak berlendir',
    spoiled: 'Pucat, kecokelatan, berlendir',
  },
  {
    number: '03',
    title: 'Aroma',
    detail:
      'Ikan segar memiliki aroma khas laut yang ringan — sedikit amis namun segar, seperti aroma pasir pantai. Aroma yang menyengat, seperti bau amonia atau bau busuk yang tajam, merupakan tanda utama bahwa bakteri dekomposisi sudah aktif dan ikan tidak lagi layak dikonsumsi.',
    fresh: 'Amis laut ringan, segar alami',
    spoiled: 'Amonia tajam, bau busuk menyengat',
  },
  {
    number: '04',
    title: 'Tekstur Daging',
    detail:
      'Tekan bagian perut atau punggung ikan dengan jari selama 2 detik. Daging ikan segar akan segera membal kembali ke bentuk semula dengan cepat. Daging yang sudah tidak segar terasa lembek, meninggalkan bekas tekanan, dan terasa lekat di jari.',
    fresh: 'Kenyal, elastis, membal saat ditekan',
    spoiled: 'Lembek, tidak membal, lekat',
  },
  {
    number: '05',
    title: 'Kondisi Sisik',
    detail:
      'Sisik ikan segar melekat erat dan rapat pada kulit, mengkilap, dan sulit dilepas bahkan dengan gosokan. Sisik yang mudah terlepas saat disentuh ringan atau sudah banyak yang rontok adalah tanda kesegaran yang telah berkurang.',
    fresh: 'Melekat kuat, mengkilap, rapat',
    spoiled: 'Mudah lepas, kusam, banyak rontok',
  },
  {
    number: '06',
    title: 'Warna Kulit',
    detail:
      'Kulit ikan segar memiliki warna cerah, mengkilap, dan sesuai warna alami spesiesnya — misalnya merah muda pucat untuk ikan kakap, atau perak berkilau untuk ikan kembung. Warna kulit yang memudar atau berubah abu-abu mengindikasikan penurunan kualitas.',
    fresh: 'Cerah, mengkilap, warna alami',
    spoiled: 'Kusam, pucat, berubah warna',
  },
  {
    number: '07',
    title: 'Kondisi Lendir',
    detail:
      'Ikan segar memiliki lapisan lendir tipis dan jernih yang berfungsi sebagai pelindung alami dari lingkungan perairan. Lendir yang sudah menjadi tebal, berwarna keruh kekuningan, dan berbau tidak sedap adalah tanda aktifnya bakteri perusak.',
    fresh: 'Tipis, jernih, tidak berbau',
    spoiled: 'Tebal, keruh, berbau tidak sedap',
  },
  {
    number: '08',
    title: 'Rongga Perut',
    detail:
      'Perut ikan segar terasa padat dan tidak mengeluarkan gas ketika ditekan ringan. Rongga perut yang kembung, terasa bergas, atau mengeluarkan cairan dengan aroma busuk merupakan tanda bahwa proses dekomposisi internal sudah berlangsung cukup jauh.',
    fresh: 'Padat, tidak kembung, tidak bergas',
    spoiled: 'Kembung, bergas, cairan berbau',
  },
];

const TABLE_ROWS = [
  { indicator: 'Mata', fresh: 'Jernih, cembung', spoiled: 'Keruh, cekung' },
  { indicator: 'Insang', fresh: 'Merah cerah', spoiled: 'Pucat, kecokelatan' },
  { indicator: 'Aroma', fresh: 'Ringan, amis laut', spoiled: 'Amonia, busuk menyengat' },
  { indicator: 'Tekstur', fresh: 'Kenyal, elastis', spoiled: 'Lembek, tidak membal' },
  { indicator: 'Sisik', fresh: 'Melekat kuat, mengkilap', spoiled: 'Mudah lepas, kusam' },
  { indicator: 'Kulit', fresh: 'Cerah, mengkilap', spoiled: 'Kusam, berubah warna' },
  { indicator: 'Lendir', fresh: 'Tipis, jernih', spoiled: 'Tebal, keruh, berbau' },
  { indicator: 'Perut', fresh: 'Padat, tidak kembung', spoiled: 'Kembung, bergas' },
];

const TIPS = [
  'Belanja ikan di pagi hari, idealnya sebelum pukul 09.00, ketika pasokan dari pelelangan masih segar.',
  'Pilih lapak penjual yang memiliki tempat pendingin atau es balok yang cukup dan bersih untuk menyimpan ikan.',
  'Perhatikan lingkungan sekitar tempat penjualan — lapak yang bersih dan tidak berbau busuk biasanya menjual ikan lebih segar.',
  'Jangan ragu untuk meminta pedagang membuka insang ikan agar bisa memeriksa warnanya secara langsung.',
  'Bawa tas berpendingin (cooler bag) saat berbelanja agar ikan tetap terjaga suhunya selama perjalanan pulang.',
];

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#162e52] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-200 border-t-white rounded-full animate-spin" />
    </div>
  );
}

export default function KualitasIkanBlogPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }
      const uProfile = await getUserProfile(user.uid);
      if (!uProfile) {
        router.push('/fill-form');
        return;
      }
      if (uProfile.role !== 'masyarakat') {
        const paths: Record<string, string> = {
          nelayan: '/dashboard/nelayan',
          'nelayan-modern': '/dashboard/peneliti',
          peneliti: '/dashboard/peneliti',
        };
        router.push(paths[uProfile.role ?? ''] || '/dashboard/masyarakat');
        return;
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-[#204473] selection:text-white">
      {/* ── Sticky Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[#162e52] border-b border-white/10 px-6 md:px-12 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2 text-white min-w-0">
          <Link
            href="/"
            className="font-extrabold tracking-widest text-sm text-white hover:text-sky-200 transition-colors flex-shrink-0"
          >
            OCEANAGARA
          </Link>
          <span className="text-white/30 flex-shrink-0">/</span>
          <Link
            href="/dashboard/masyarakat"
            className="text-xs text-white/60 hover:text-white transition-colors flex-shrink-0 hidden sm:inline"
          >
            Masyarakat
          </Link>
          <span className="text-white/30 flex-shrink-0 hidden sm:inline">/</span>
          <span className="text-xs text-sky-200 font-semibold truncate">Kualitas Ikan</span>
        </div>
        <Link
          href="/dashboard/masyarakat"
          className="flex-shrink-0 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-4 py-2 border border-white/30 text-white hover:bg-white hover:text-[#162e52] rounded-lg transition-all duration-200"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          <span className="hidden sm:inline">Kembali</span>
        </Link>
      </header>

      {/* ── Hero Section ──────────────────────────────────────────── */}
      <section className="relative h-[62vh] min-h-[420px] flex items-end overflow-hidden">
        <img
          src={heroImg.src}
          alt="Cara Membedakan Kualitas Ikan"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a1a2e]/92 via-[#0a1a2e]/45 to-transparent" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 md:px-12 w-full pb-14">
          <div className="mb-4">
            <span className="inline-block px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-white/15 border border-white/25 text-sky-200 rounded backdrop-blur-sm">
              Panduan Konsumen
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white leading-tight tracking-tight mb-4 max-w-2xl">
            Cara Membedakan Kualitas Ikan
          </h1>
          <div className="flex items-center gap-4 text-xs text-white/55">
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <span>5 menit baca</span>
            </div>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span>8 indikator utama</span>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span>Keamanan Pangan</span>
          </div>
        </div>
      </section>

      {/* ── Article Body ──────────────────────────────────────────── */}
      <article className="max-w-4xl mx-auto px-6 md:px-12 py-14">

        {/* Intro */}
        <div className="max-w-3xl mb-14">
          <div className="w-12 h-1 bg-[#162e52] rounded mb-6" />
          <p className="text-lg sm:text-xl text-zinc-700 leading-relaxed mb-5 font-light">
            Memilih ikan segar bukan hanya soal kualitas rasa, tetapi juga menyangkut
            keamanan pangan seluruh keluarga. Ikan yang sudah tidak segar dapat
            mengandung bakteri patogen seperti <em>Staphylococcus aureus</em> dan
            toksin histamin yang berbahaya, berpotensi menyebabkan keracunan makanan
            serius.
          </p>
          <p className="text-base text-zinc-600 leading-relaxed">
            Dengan memahami 8 indikator visual kesegaran ikan berikut, Anda dapat
            membuat keputusan berbelanja yang lebih cerdas, aman, dan menguntungkan.
            Tidak diperlukan alat khusus — cukup kepekaan indera dan panduan ini.
          </p>
        </div>

        {/* Section title */}
        <div className="flex items-center gap-4 mb-10">
          <div className="flex-1 h-px bg-zinc-100" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 px-2">
            8 Indikator Utama
          </span>
          <div className="flex-1 h-px bg-zinc-100" />
        </div>

        {/* Indicators grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-16">
          {INDICATORS.map((ind) => (
            <div
              key={ind.number}
              className="p-6 border border-zinc-200 rounded-2xl hover:border-[#162e52]/40 hover:shadow-lg transition-all duration-300 bg-white group"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#162e52] text-white flex items-center justify-center font-extrabold text-sm shadow-sm">
                  {ind.number}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-[#162e52] text-sm mb-2 uppercase tracking-wide">
                    {ind.title}
                  </h3>
                  <p className="text-xs text-zinc-600 leading-relaxed mb-4">
                    {ind.detail}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-xl bg-green-50 border border-green-100">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-green-700 mb-1">
                        Segar
                      </p>
                      <p className="text-xs text-green-900 leading-snug">{ind.fresh}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-red-50 border border-red-100">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-red-700 mb-1">
                        Tidak Segar
                      </p>
                      <p className="text-xs text-red-900 leading-snug">{ind.spoiled}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Article image */}
        <figure className="rounded-2xl overflow-hidden mb-16 shadow-lg border border-zinc-100">
          <img
            src={articleImg.src}
            alt="Perbandingan ikan segar dan tidak segar"
            className="w-full object-cover max-h-72 md:max-h-80"
          />
          <figcaption className="px-5 py-3.5 bg-zinc-50 border-t border-zinc-100">
            <p className="text-xs text-zinc-500 italic">
              Perbedaan visual yang jelas antara ikan dalam kondisi segar dan ikan yang
              sudah melewati batas konsumsi — terlihat pada mata, kulit, dan warna
              daging.
            </p>
          </figcaption>
        </figure>

        {/* Comparison Table */}
        <div className="mb-16">
          <h2 className="text-xl font-extrabold text-[#162e52] uppercase tracking-tight mb-2">
            Tabel Perbandingan Cepat
          </h2>
          <p className="text-sm text-zinc-500 mb-6 leading-relaxed">
            Gunakan tabel ini sebagai referensi ringkas saat berbelanja di pasar.
          </p>
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#162e52] text-white">
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider w-1/4">
                    Indikator
                  </th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider w-[37.5%]">
                    Ikan Segar
                  </th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider w-[37.5%]">
                    Tidak Segar
                  </th>
                </tr>
              </thead>
              <tbody>
                {TABLE_ROWS.map((row, i) => (
                  <tr
                    key={row.indicator}
                    className={`border-t border-zinc-100 ${i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/60'}`}
                  >
                    <td className="px-5 py-3.5 text-xs font-semibold text-zinc-800">
                      {row.indicator}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-green-700">{row.fresh}</td>
                    <td className="px-5 py-3.5 text-xs text-red-600">{row.spoiled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tips section */}
        <div className="mb-16">
          <h2 className="text-xl font-extrabold text-[#162e52] uppercase tracking-tight mb-2">
            Tips Berbelanja Ikan Segar
          </h2>
          <p className="text-sm text-zinc-500 mb-6 leading-relaxed">
            Mengetahui cara memilih saja belum cukup — ini adalah kebiasaan belanja
            yang akan melengkapi pengetahuan Anda.
          </p>
          <div className="space-y-3">
            {TIPS.map((tip, i) => (
              <div
                key={i}
                className="flex items-start gap-4 p-4 bg-zinc-50 rounded-xl border border-zinc-100 hover:border-zinc-300 transition-colors"
              >
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#162e52] text-white flex items-center justify-center font-bold text-[10px] mt-0.5">
                  {i + 1}
                </div>
                <p className="text-sm text-zinc-700 leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Callout */}
        <div className="p-6 rounded-2xl bg-[#162e52]/5 border border-[#162e52]/15 mb-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#162e52] text-white flex items-center justify-center mt-0.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#162e52] uppercase tracking-wide mb-1.5">
                Penting untuk Diingat
              </h3>
              <p className="text-sm text-zinc-700 leading-relaxed">
                Tidak ada satu indikator tunggal yang bisa dijadikan patokan mutlak.
                Evaluasi ikan secara menyeluruh menggunakan semua 8 indikator di atas.
                Jika Anda ragu, lebih baik tidak membeli. Keamanan dan kesehatan
                keluarga jauh lebih berharga dari harga ikan sekalipun murah.
              </p>
            </div>
          </div>
        </div>
      </article>

      {/* ── Related Articles ──────────────────────────────────────── */}
      <section className="border-t border-zinc-100 bg-zinc-50/50 py-14 px-6 md:px-12">
        <div className="max-w-4xl mx-auto">
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-8">
            Baca Juga
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
            <Link
              href="/dashboard/masyarakat/blog/pengolahan-ikan"
              className="group flex gap-4 p-4 border border-zinc-200 rounded-2xl bg-white hover:border-[#162e52]/40 hover:shadow-md transition-all duration-300"
            >
              <div className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden">
                <img
                  src={relatedImg1.src}
                  alt="Pengolahan Ikan"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#162e52]/50">
                  Keamanan Pangan
                </span>
                <h4 className="text-sm font-bold text-zinc-900 mt-1 leading-snug group-hover:text-[#162e52] transition-colors line-clamp-2">
                  Cara Pengolahan Ikan yang Benar
                </h4>
                <p className="text-xs text-zinc-400 mt-1.5">4 menit baca</p>
              </div>
            </Link>

            <Link
              href="/dashboard/masyarakat/blog/kondisi-air-laut"
              className="group flex gap-4 p-4 border border-zinc-200 rounded-2xl bg-white hover:border-[#162e52]/40 hover:shadow-md transition-all duration-300"
            >
              <div className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden">
                <img
                  src={relatedImg2.src}
                  alt="Kondisi Air Laut"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#162e52]/50">
                  Ekosistem Laut
                </span>
                <h4 className="text-sm font-bold text-zinc-900 mt-1 leading-snug group-hover:text-[#162e52] transition-colors line-clamp-2">
                  Edukasi Kondisi Air Laut
                </h4>
                <p className="text-xs text-zinc-400 mt-1.5">6 menit baca</p>
              </div>
            </Link>
          </div>

          <div className="text-center">
            <Link
              href="/dashboard/masyarakat"
              className="inline-flex items-center gap-2.5 px-7 py-3 bg-[#162e52] text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-[#1f4275] transition-all duration-200 shadow-md"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Kembali ke Dashboard
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
