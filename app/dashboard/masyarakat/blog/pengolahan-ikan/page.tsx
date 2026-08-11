'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthChange, getUserProfile } from '@/app/service/authentication';
import heroImg from '@/public/img/MasyarakatPengolahanIkan.webp';
import articleImg from '@/public/img/fish_processing.webp';
import relatedImg1 from '@/public/img/MasyarakatKualitasIkan.webp';
import relatedImg2 from '@/public/img/MasyarakatAirLaut.webp';

const STEPS = [
  {
    number: '01',
    title: 'Pendinginan Segera',
    subtitle: 'Dalam 30 menit setelah ditangkap atau dibeli',
    detail:
      'Bakteri pembusuk berkembang paling cepat pada suhu antara 4 derajat C hingga 60 derajat C — zona bahaya ini harus dihindari. Segera simpan ikan dalam wadah berisi es batu yang cukup dengan perbandingan 1:1 (es dan ikan) untuk menjaga suhu di kisaran 0–4 derajat C. Es batu menghambat pertumbuhan bakteri dan memperlambat proses oksidasi lemak.',
    temp: '0 – 4 derajat C',
    duration: 'Maks. 2 hari dalam kulkas',
    tip: 'Letakkan ikan di atas lapisan es, bukan di bawah es, agar air lelehan es tidak mengkontaminasi.',
  },
  {
    number: '02',
    title: 'Pencucian dengan Air Mengalir',
    subtitle: 'Cuci sebelum dan sesudah membuang isi perut',
    detail:
      'Cuci seluruh permukaan ikan di bawah air mengalir yang bersih untuk menghilangkan kotoran permukaan, lendir berlebih, dan kontaminan lainnya. Hindari merendam ikan dalam air diam karena dapat memindahkan bakteri dari satu bagian ke bagian lain. Gunakan air bersih bersuhu ruang atau dingin — air panas akan mulai memasak daging ikan.',
    temp: 'Air dingin bersih',
    duration: '30–60 detik per ekor',
    tip: 'Cuci tangan dengan sabun sebelum dan sesudah memegang ikan mentah untuk mencegah kontaminasi silang.',
  },
  {
    number: '03',
    title: 'Pembersihan Isi Perut',
    subtitle: 'Sumber utama bakteri dan enzim pencernaan',
    detail:
      'Isi perut ikan mengandung enzim pencernaan yang aktif dan bakteri dalam jumlah besar. Jika dibiarkan, enzim ini akan mulai mencerna daging ikan itu sendiri dari dalam — proses yang disebut autolisis. Buat sayatan di sepanjang perut ikan, keluarkan seluruh organ dalam, dan bersihkan rongga perut dari sisa darah dan membran hitam dengan sikat atau kain bersih.',
    temp: 'Lakukan sedingin mungkin',
    duration: 'Sesegera mungkin setelah dibeli',
    tip: 'Buang organ dalam ke dalam kantong tertutup sebelum membuangnya ke tempat sampah untuk mencegah bau.',
  },
  {
    number: '04',
    title: 'Pemisahan dari Bahan Lain',
    subtitle: 'Pencegahan kontaminasi silang di lemari pendingin',
    detail:
      'Ikan mentah tidak boleh bersentuhan langsung atau berada satu wadah dengan bahan makanan matang, produk susu, sayuran, atau daging lain. Simpan ikan dalam wadah kedap udara atau bungkus rapat dengan plastik wrapping, kemudian tempatkan di rak paling bawah kulkas agar air tetesan tidak mencemari makanan di bawahnya.',
    temp: '0 – 4 derajat C (kulkas)',
    duration: 'Maks. 1–2 hari',
    tip: 'Beri label tanggal pada wadah penyimpanan ikan agar Anda tahu kapan harus segera mengolahnya.',
  },
  {
    number: '05',
    title: 'Pemasakan yang Tepat',
    subtitle: 'Suhu minimal untuk membunuh patogen',
    detail:
      'Memasak ikan hingga suhu bagian dalam mencapai minimal 70 derajat C secara konsisten selama minimal 15 detik akan membunuh sebagian besar bakteri patogen termasuk Salmonella, Listeria, dan Vibrio. Gunakan termometer masak untuk akurasi, atau pastikan daging ikan sudah berwarna putih opak dan mudah terkelupas dengan garpu di bagian paling tebal.',
    temp: 'Min. 70 derajat C bagian dalam',
    duration: '15 detik pada suhu target',
    tip: 'Bagian tertebal ikan di dekat tulang belakang adalah yang paling lambat matang — periksa bagian ini terlebih dahulu.',
  },
  {
    number: '06',
    title: 'Penyimpanan Sisa Masakan',
    subtitle: 'Penanganan ikan yang sudah dimasak',
    detail:
      'Ikan yang sudah dimasak tidak boleh dibiarkan pada suhu ruang lebih dari 2 jam. Segera simpan dalam wadah kedap udara di dalam kulkas (0–4 derajat C) dan konsumsi dalam 1–2 hari. Untuk penyimpanan lebih lama, bekukan dalam freezer pada suhu -18 derajat C atau lebih rendah dan konsumsi dalam 1–3 bulan.',
    temp: '0–4 derajat C (kulkas)',
    duration: 'Konsumsi dalam 1–2 hari',
    tip: 'Panaskan kembali ikan matang hingga benar-benar panas di seluruh bagian sebelum dimakan, bukan hanya hangat.',
  },
];

const STORAGE_GUIDE = [
  { method: 'Es batu (mentah)', duration: '1–2 hari', temp: '0–4 derajat C', note: 'Ganti es setiap 8 jam' },
  { method: 'Lemari pendingin (mentah)', duration: '1–2 hari', temp: '0–4 derajat C', note: 'Wadah tertutup' },
  { method: 'Freezer (mentah)', duration: '2–6 bulan', temp: '-18 derajat C', note: 'Bungkus kedap udara' },
  { method: 'Kulkas (sudah dimasak)', duration: '1–2 hari', temp: '0–4 derajat C', note: 'Wadah tertutup' },
  { method: 'Freezer (sudah dimasak)', duration: '1–3 bulan', temp: '-18 derajat C', note: 'Pisahkan per porsi' },
];

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#162e52] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-200 border-t-white rounded-full animate-spin" />
    </div>
  );
}

export default function PengolahanIkanBlogPage() {
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
        router.push((uProfile.role ? paths[uProfile.role] : undefined) ?? '/dashboard/masyarakat');
        return;
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  if (loading) return <LoadingScreen 
  />;

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
          <span className="text-xs text-sky-200 font-semibold truncate">Pengolahan Ikan</span>
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
          alt="Cara Pengolahan Ikan yang Benar"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a1a2e]/92 via-[#0a1a2e]/45 to-transparent" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 md:px-12 w-full pb-14">
          <div className="mb-4">
            <span className="inline-block px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-white/15 border border-white/25 text-sky-200 rounded backdrop-blur-sm">
              Keamanan Pangan
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white leading-tight tracking-tight mb-4 max-w-2xl">
            Cara Pengolahan Ikan yang Benar
          </h1>
          <div className="flex items-center gap-4 text-xs text-white/55">
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <span>4 menit baca</span>
            </div>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span>6 langkah kritis</span>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span>Higienis dan Bergizi</span>
          </div>
        </div>
      </section>

      {/* ── Article Body ──────────────────────────────────────────── */}
      <article className="max-w-4xl mx-auto px-6 md:px-12 py-14">

        {/* Intro */}
        <div className="max-w-3xl mb-14">
          <div className="w-12 h-1 bg-[#162e52] rounded mb-6" />
          <p className="text-lg sm:text-xl text-zinc-700 leading-relaxed mb-5 font-light">
            Indonesia adalah negara dengan konsumsi ikan per kapita yang terus
            meningkat setiap tahun. Namun, cara pengolahan yang keliru masih menjadi
            penyebab utama keracunan makanan berbasis ikan di rumah tangga. Penanganan
            yang tidak tepat dapat menghilangkan nutrisi penting sekaligus menumbuhkan
            bakteri berbahaya.
          </p>
          <p className="text-base text-zinc-600 leading-relaxed">
            Enam langkah berikut adalah protokol pengolahan ikan yang higienis,
            berbasis panduan keamanan pangan internasional, dan dapat diterapkan
            langsung di dapur rumahan Anda tanpa peralatan khusus.
          </p>
        </div>

        {/* Section title */}
        <div className="flex items-center gap-4 mb-10">
          <div className="flex-1 h-px bg-zinc-100" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 px-2">
            6 Langkah Pengolahan
          </span>
          <div className="flex-1 h-px bg-zinc-100" />
        </div>

        {/* Steps */}
        <div className="space-y-6 mb-16">
          {STEPS.map((step, index) => (
            <div
              key={step.number}
              className="group relative flex gap-0 border border-zinc-200 rounded-2xl overflow-hidden hover:border-[#162e52]/40 hover:shadow-lg transition-all duration-300 bg-white"
            >
              {/* Step number sidebar */}
              <div className="flex-shrink-0 w-16 md:w-20 bg-[#162e52] flex flex-col items-center justify-center py-6 gap-2">
                <span className="text-2xl font-extrabold text-white leading-none">
                  {index + 1}
                </span>
                <div className="w-6 h-px bg-white/30" />
                <span className="text-[10px] text-sky-200 font-bold uppercase tracking-widest">
                  Langkah
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 p-5 md:p-6 min-w-0">
                <div className="mb-1">
                  <h3 className="font-extrabold text-[#162e52] text-base uppercase tracking-wide">
                    {step.title}
                  </h3>
                  <p className="text-xs text-zinc-400 font-medium mt-0.5">{step.subtitle}</p>
                </div>
                <p className="text-sm text-zinc-600 leading-relaxed my-4">{step.detail}</p>

                {/* Metadata row */}
                <div className="flex flex-wrap gap-3 mb-4">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg">
                    <svg className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-blue-500">Suhu / Kondisi</p>
                      <p className="text-xs font-semibold text-blue-800">{step.temp}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg">
                    <svg className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Durasi / Waktu</p>
                      <p className="text-xs font-semibold text-zinc-700">{step.duration}</p>
                    </div>
                  </div>
                </div>

                {/* Tip */}
                <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                  <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                  </svg>
                  <p className="text-xs text-amber-800 leading-relaxed">{step.tip}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Article image */}
        <figure className="rounded-2xl overflow-hidden mb-16 shadow-lg border border-zinc-100">
          <img
            src={articleImg.src}
            alt="Proses pengolahan ikan yang higienis"
            className="w-full object-cover max-h-72 md:max-h-80"
          />
          <figcaption className="px-5 py-3.5 bg-zinc-50 border-t border-zinc-100">
            <p className="text-xs text-zinc-500 italic">
              Penanganan ikan yang bersih dan sistematis di awal proses pengolahan
              merupakan fondasi utama keamanan pangan berbasis hasil laut.
            </p>
          </figcaption>
        </figure>

        {/* Storage Guide */}
        <div className="mb-16">
          <h2 className="text-xl font-extrabold text-[#162e52] uppercase tracking-tight mb-2">
            Panduan Penyimpanan Ikan
          </h2>
          <p className="text-sm text-zinc-500 mb-6 leading-relaxed">
            Durasi dan metode penyimpanan yang tepat sangat menentukan keamanan ikan
            saat dikonsumsi.
          </p>
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#162e52] text-white">
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider">Metode Penyimpanan</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider">Durasi Aman</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider">Suhu</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {STORAGE_GUIDE.map((row, i) => (
                  <tr key={i} className={`border-t border-zinc-100 ${i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/60'}`}>
                    <td className="px-5 py-3.5 text-xs font-semibold text-zinc-800">{row.method}</td>
                    <td className="px-5 py-3.5 text-xs text-[#162e52] font-semibold">{row.duration}</td>
                    <td className="px-5 py-3.5 text-xs text-zinc-600">{row.temp}</td>
                    <td className="px-5 py-3.5 text-xs text-zinc-500">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                Prinsip Dasar Keamanan Pangan Ikan
              </h3>
              <p className="text-sm text-zinc-700 leading-relaxed">
                Ingatlah tiga prinsip utama: <strong>simpan dingin</strong> untuk memperlambat bakteri, <strong>masak panas</strong> untuk membunuh patogen, dan <strong>jaga kebersihan</strong> untuk mencegah kontaminasi silang. Ketiga prinsip ini berlaku di setiap tahap pengolahan, dari pasar hingga meja makan.
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
              href="/dashboard/masyarakat/blog/kualitas-ikan"
              className="group flex gap-4 p-4 border border-zinc-200 rounded-2xl bg-white hover:border-[#162e52]/40 hover:shadow-md transition-all duration-300"
            >
              <div className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden">
                <img
                  src={relatedImg1.src}
                  alt="Kualitas Ikan"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#162e52]/50">Panduan Konsumen</span>
                <h4 className="text-sm font-bold text-zinc-900 mt-1 leading-snug group-hover:text-[#162e52] transition-colors line-clamp-2">
                  Cara Membedakan Kualitas Ikan
                </h4>
                <p className="text-xs text-zinc-400 mt-1.5">5 menit baca</p>
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
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#162e52]/50">Ekosistem Laut</span>
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
