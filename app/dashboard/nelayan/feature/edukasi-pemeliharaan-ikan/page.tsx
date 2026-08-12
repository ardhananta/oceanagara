'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthChange, getUserProfile } from '@/app/service/authentication';
import heroImg from '@/public/img/NelayanPemeliharaanIkan.webp';
import relatedImg1 from '@/public/img/NelayanPemasaranIkan.webp';
import relatedImg2 from '@/public/img/NelayanZonaTangkap.webp';

const TECHNIQUES = [
  {
    number: '01',
    title: 'Penanganan Pertama di Atas Kapal',
    detail:
      'Segera setelah ikan ditangkap, lakukan penanganan cepat untuk mencegah proses pembusukan. Ikan yang mengalami stres sebelum mati akan menghabiskan cadangan energi tubuhnya, sehingga proses rigor mortis berlangsung lebih cepat dan kualitas daging menurun drastis. Matikan ikan secara cepat dengan cara memotong bagian belakang kepala (ike jime) atau dengan es batu langsung.',
    tip: 'Gunakan metode ike jime — tusukan ke otak ikan — untuk mematikan ikan dengan cepat dan menjaga kualitas daging lebih lama.',
    indicator: 'Waktu ideal: dalam 5 menit setelah tangkapan',
  },
  {
    number: '02',
    title: 'Pendinginan dengan Es Batu',
    detail:
      'Es batu adalah metode paling efektif dan terjangkau untuk menjaga kesegaran ikan di atas kapal. Suhu ideal penyimpanan ikan adalah 0–4 derajat Celsius. Gunakan perbandingan es dan ikan sebesar 1:1 untuk penyimpanan jangka pendek (1–2 hari) dan 2:1 untuk penyimpanan lebih lama. Susun ikan berlapis dengan es, pastikan seluruh permukaan ikan bersentuhan dengan es.',
    tip: 'Tambahkan garam pada lapisan es paling bawah untuk menurunkan titik leleh es dan memperpanjang efek pendinginan.',
    indicator: 'Target suhu: 0 – 4 derajat C',
  },
  {
    number: '03',
    title: 'Penyimpanan dalam Palka Berinsulasi',
    detail:
      'Palka berinsulasi yang baik dapat mempertahankan suhu dingin hingga 3–5 hari lebih lama dibandingkan palka biasa. Pastikan palka dibersihkan secara menyeluruh sebelum digunakan, bebas dari sisa darah atau lendir tangkapan sebelumnya yang dapat menjadi sumber bakteri. Lapisi dasar palka dengan es terlebih dahulu sebelum menambahkan ikan.',
    tip: 'Bersihkan palka dengan larutan klorin (1:100) setiap sebelum dan sesudah melaut untuk mencegah kontaminasi silang.',
    indicator: 'Daya tahan es: 3–7 hari tergantung insulasi',
  },
  {
    number: '04',
    title: 'Pemisahan Berdasarkan Jenis Ikan',
    detail:
      'Tidak semua ikan memiliki komposisi kimia yang sama. Beberapa jenis ikan seperti ikan lemak tinggi (tuna, makarel) lebih cepat teroksidasi dibandingkan ikan putih. Pisahkan ikan berdasarkan jenis dan ukuran untuk mencegah tekanan mekanis dari ikan lebih besar yang dapat merusak daging ikan yang lebih kecil dan lembut.',
    tip: 'Pisahkan ikan ber-sisik tajam seperti kakap atau kerapu dari ikan bertubuh lembut untuk menghindari kerusakan fisik.',
    indicator: 'Pisahkan minimal 3 kelompok: ikan besar, sedang, kecil',
  },
  {
    number: '05',
    title: 'Pembersihan Insang dan Isi Perut',
    detail:
      'Insang dan organ dalam ikan mengandung enzim pencernaan aktif dan jumlah bakteri tertinggi dibandingkan bagian tubuh lainnya. Untuk penyimpanan lebih dari 1 hari, keluarkan isi perut dan bersihkan insang, terutama untuk ikan ukuran besar. Proses ini disebut gutting dan dapat memperpanjang masa simpan ikan secara signifikan.',
    tip: 'Cuci bagian dalam rongga perut dengan air laut bersih (bukan air tawar) untuk menjaga keseimbangan osmotik jaringan ikan.',
    indicator: 'Wajib untuk ikan di atas 2 kg',
  },
  {
    number: '06',
    title: 'Monitoring Suhu dan Kualitas',
    detail:
      'Pemantauan berkala sangat penting dalam perjalanan panjang. Periksa kondisi es setiap 6–8 jam dan tambahkan es jika diperlukan. Perhatikan perubahan warna daging, aroma yang keluar dari palka, dan tekstur sisik ikan. Deteksi dini penurunan kualitas memungkinkan tindakan segera sebelum kerusakan meluas ke seluruh muatan.',
    tip: 'Gunakan termometer palka sederhana yang ditempel di dinding bagian dalam untuk memantau suhu tanpa harus membuka tutup palka.',
    indicator: 'Periksa setiap 6–8 jam',
  },
];

const QUICK_TABLE = [
  { method: 'Es Batu (1:1)', duration: '1–2 hari', condition: 'Perjalanan pendek' },
  { method: 'Es Batu (2:1)', duration: '3–5 hari', condition: 'Perjalanan menengah' },
  { method: 'Palka Berinsulasi + Es', duration: '5–7 hari', condition: 'Perjalanan jauh' },
  { method: 'Air Laut Dingin (RSW)', duration: '7–10 hari', condition: 'Kapal industri' },
  { method: 'Pembekuan (-18 C)', duration: 'Hingga 3 bulan', condition: 'Penyimpanan jangka panjang' },
];

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0c2d52] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-200 border-t-white rounded-full animate-spin" />
    </div>
  );
}

export default function EdukasiPemeliharaanIkanBlogPage() {
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
      if (uProfile.role !== 'nelayan') {
        const paths: Record<string, string> = {
          masyarakat: '/dashboard/masyarakat',
          'nelayan-modern': '/dashboard/peneliti',
          peneliti: '/dashboard/peneliti',
        };
        router.push(paths[uProfile.role ?? ''] || '/dashboard/nelayan');
        return;
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-[#0c3060] selection:text-white">

      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-[#0c2d52] border-b border-white/10 px-6 md:px-12 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2 text-white min-w-0">
          <Link
            href="/"
            className="font-extrabold tracking-widest text-sm text-white hover:text-sky-200 transition-colors flex-shrink-0"
          >
            OCEANAGARA
          </Link>
          <span className="text-white/30 flex-shrink-0">/</span>
          <Link
            href="/dashboard/nelayan"
            className="text-xs text-white/60 hover:text-white transition-colors flex-shrink-0 hidden sm:inline"
          >
            Nelayan
          </Link>
          <span className="text-white/30 flex-shrink-0 hidden sm:inline">/</span>
          <span className="text-xs text-sky-200 font-semibold truncate">Pemeliharaan Ikan</span>
        </div>
        <Link
          href="/dashboard/nelayan"
          className="flex-shrink-0 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-4 py-2 border border-white/30 text-white hover:bg-white hover:text-[#0c2d52] rounded-lg transition-all duration-200"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          <span className="hidden sm:inline">Kembali</span>
        </Link>
      </header>

      {/* Hero Section */}
      <section className="relative h-[62vh] min-h-[420px] flex items-end overflow-hidden">
        <img
          src={heroImg.src}
          alt="Edukasi Pemeliharaan Ikan"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#061525]/92 via-[#061525]/45 to-transparent" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 md:px-12 w-full pb-14">
          <div className="mb-4">
            <span className="inline-block px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-white/15 border border-white/25 text-sky-200 rounded backdrop-blur-sm">
              Teknik Budidaya
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white leading-tight tracking-tight mb-4 max-w-2xl">
            Edukasi Pemeliharaan Ikan
          </h1>
          <div className="flex items-center gap-4 text-xs text-white/55">
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <span>6 menit baca</span>
            </div>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span>6 teknik utama</span>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span>Panduan Nelayan</span>
          </div>
        </div>
      </section>

      {/* Article Body */}
      <article className="max-w-4xl mx-auto px-6 md:px-12 py-14">

        {/* Intro */}
        <div className="max-w-3xl mb-14">
          <div className="w-12 h-1 bg-[#0c2d52] rounded mb-6" />
          <p className="text-lg sm:text-xl text-zinc-700 leading-relaxed mb-5 font-light">
            Menjaga kualitas ikan sejak saat pertama ditangkap adalah kunci utama mendapatkan harga jual terbaik dan mengurangi kerugian akibat kerusakan muatan. Setiap jam yang berlalu tanpa penanganan yang tepat berpotensi menurunkan nilai jual ikan hingga 30–50 persen.
          </p>
          <p className="text-base text-zinc-600 leading-relaxed">
            Panduan ini menyajikan 6 teknik pemeliharaan ikan yang telah terbukti efektif bagi nelayan tradisional — mulai dari saat ikan diangkat dari laut hingga tiba di Tempat Pelelangan Ikan dengan kondisi prima.
          </p>
        </div>

        {/* Section Divider */}
        <div className="flex items-center gap-4 mb-10">
          <div className="flex-1 h-px bg-zinc-100" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 px-2">
            6 Teknik Utama
          </span>
          <div className="flex-1 h-px bg-zinc-100" />
        </div>

        {/* Techniques Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-16">
          {TECHNIQUES.map((tech) => (
            <div
              key={tech.number}
              className="p-6 border border-zinc-200 rounded-2xl hover:border-[#0c2d52]/40 hover:shadow-lg transition-all duration-300 bg-white group"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#0c2d52] text-white flex items-center justify-center font-extrabold text-sm shadow-sm">
                  {tech.number}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-[#0c2d52] text-sm mb-2 uppercase tracking-wide">
                    {tech.title}
                  </h3>
                  <p className="text-xs text-zinc-600 leading-relaxed mb-4">
                    {tech.detail}
                  </p>
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-100">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-sky-700 mb-1">Catatan Penting</p>
                      <p className="text-xs text-sky-900 leading-snug">{tech.tip}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-50 border border-zinc-100">
                      <p className="text-[10px] text-zinc-500 italic">{tech.indicator}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Reference Table */}
        <div className="mb-16">
          <h2 className="text-xl font-extrabold text-[#0c2d52] uppercase tracking-tight mb-2">
            Tabel Metode Penyimpanan
          </h2>
          <p className="text-sm text-zinc-500 mb-6 leading-relaxed">
            Pilih metode yang sesuai dengan durasi pelayaran dan jenis kapal Anda.
          </p>
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0c2d52] text-white">
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider">Metode</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider">Daya Tahan</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider">Kondisi Ideal</th>
                </tr>
              </thead>
              <tbody>
                {QUICK_TABLE.map((row, i) => (
                  <tr
                    key={row.method}
                    className={`border-t border-zinc-100 ${i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/60'}`}
                  >
                    <td className="px-5 py-3.5 text-xs font-semibold text-zinc-800">{row.method}</td>
                    <td className="px-5 py-3.5 text-xs text-sky-700 font-medium">{row.duration}</td>
                    <td className="px-5 py-3.5 text-xs text-zinc-600">{row.condition}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Callout */}
        <div className="p-6 rounded-2xl bg-[#0c2d52]/5 border border-[#0c2d52]/15 mb-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#0c2d52] text-white flex items-center justify-center mt-0.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0c2d52] uppercase tracking-wide mb-1.5">
                Ingat Selalu
              </h3>
              <p className="text-sm text-zinc-700 leading-relaxed">
                Setiap rupiah yang diinvestasikan dalam es batu dan penanganan yang benar akan menghasilkan keuntungan berlipat dari harga jual yang lebih tinggi. Ikan dengan kualitas prima selalu mendapat prioritas harga terbaik di Tempat Pelelangan Ikan.
              </p>
            </div>
          </div>
        </div>
      </article>

      {/* Related Articles */}
      <section className="border-t border-zinc-100 bg-zinc-50/50 py-14 px-6 md:px-12">
        <div className="max-w-4xl mx-auto">
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-8">
            Baca Juga
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
            <Link
              href="/dashboard/nelayan/blog/pemasaran-ikan"
              className="group flex gap-4 p-4 border border-zinc-200 rounded-2xl bg-white hover:border-[#0c2d52]/40 hover:shadow-md transition-all duration-300"
            >
              <div className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden">
                <img
                  src={relatedImg1.src}
                  alt="Pemasaran Ikan"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0c2d52]/50">
                  Strategi Penjualan
                </span>
                <h4 className="text-sm font-bold text-zinc-900 mt-1 leading-snug group-hover:text-[#0c2d52] transition-colors line-clamp-2">
                  Pemasaran Ikan
                </h4>
                <p className="text-xs text-zinc-400 mt-1.5">5 menit baca</p>
              </div>
            </Link>

            <Link
              href="/dashboard/nelayan/blog/zona-tangkap-ikan-tradisional"
              className="group flex gap-4 p-4 border border-zinc-200 rounded-2xl bg-white hover:border-[#0c2d52]/40 hover:shadow-md transition-all duration-300"
            >
              <div className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden">
                <img
                  src={relatedImg2.src}
                  alt="Zona Tangkap Ikan Tradisional"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0c2d52]/50">
                  Peta Wilayah
                </span>
                <h4 className="text-sm font-bold text-zinc-900 mt-1 leading-snug group-hover:text-[#0c2d52] transition-colors line-clamp-2">
                  Zona Tangkap Ikan Tradisional
                </h4>
                <p className="text-xs text-zinc-400 mt-1.5">4 menit baca</p>
              </div>
            </Link>
          </div>

          <div className="text-center">
            <Link
              href="/dashboard/nelayan"
              className="inline-flex items-center gap-2.5 px-7 py-3 bg-[#0c2d52] text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-[#1a4a7a] transition-all duration-200 shadow-md"
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
