'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthChange, getUserProfile } from '@/app/service/authentication';
import heroImg from '@/public/img/NelayanPemasaranIkan.webp';
import relatedImg1 from '@/public/img/NelayanPemeliharaanIkan.webp';
import relatedImg2 from '@/public/img/NelayanZonaTangkap.webp';

const CHANNELS = [
  {
    number: '01',
    title: 'Tempat Pelelangan Ikan (TPI)',
    detail:
      'TPI adalah saluran penjualan utama bagi nelayan tradisional. Sistem lelang di TPI memungkinkan harga ikan ditentukan secara kompetitif oleh pembeli, yang teoritis menguntungkan nelayan jika kualitas ikan terjaga. Daftarkan diri sebagai anggota resmi koperasi nelayan setempat untuk mendapatkan akses prioritas dan fasilitas pendinginan yang tersedia di TPI.',
    advantage: 'Harga kompetitif, pembayaran cepat, terorganisir',
    note: 'Datangi TPI sebelum pukul 06.00 untuk mendapat slot lelang terbaik dengan pembeli aktif paling banyak.',
  },
  {
    number: '02',
    title: 'Penjualan Langsung ke Pedagang Pengumpul',
    detail:
      'Pedagang pengumpul (bangkang atau bakul) adalah perantara yang membeli langsung dari nelayan dan mendistribusikan ke pasar tradisional atau pengolah ikan. Membangun hubungan jangka panjang dengan pedagang yang terpercaya dapat memberikan kepastian pembeli tetap, meski harga mungkin sedikit lebih rendah dari lelang TPI. Negosiasikan harga berdasarkan volume dan kualitas.',
    advantage: 'Kepastian pembeli, tidak perlu lelang, fleksibel',
    note: 'Catat data harga dari beberapa pedagang pengumpul dan bandingkan secara berkala untuk referensi negosiasi.',
  },
  {
    number: '03',
    title: 'Pasar Tradisional Lokal',
    detail:
      'Menjual langsung ke pasar tradisional menghilangkan satu lapisan perantara, berpotensi meningkatkan margin keuntungan. Namun, memerlukan waktu dan tenaga ekstra untuk berdagang sendiri atau menugaskan anggota keluarga. Pasar tradisional cocok untuk ikan-ikan dengan ukuran dan jenis yang diminati konsumen rumah tangga lokal.',
    advantage: 'Margin lebih tinggi, harga lebih stabil',
    note: 'Kemas ikan dengan rapi menggunakan wadah bersih dan tambahkan es untuk menjaga tampilan segar sepanjang hari berjualan.',
  },
  {
    number: '04',
    title: 'Restoran dan Hotel Lokal',
    detail:
      'Restoran seafood, hotel bintang, dan katering membutuhkan pasokan ikan segar dalam jumlah dan kualitas konsisten. Segmen ini biasanya bersedia membayar lebih tinggi untuk kualitas premium dan pengiriman terjadwal. Perkenalkan diri langsung ke bagian dapur atau manajer restoran, tawarkan sampel gratis, dan siapkan kapasitas untuk memenuhi pesanan rutin.',
    advantage: 'Harga premium, pembeli tetap, volume stabil',
    note: 'Pastikan Anda mampu memenuhi jadwal pengiriman secara konsisten sebelum berkomitmen dengan pembeli restoran.',
  },
  {
    number: '05',
    title: 'Platform Digital dan Media Sosial',
    detail:
      'Pemasaran digital membuka akses ke konsumen yang lebih luas tanpa batas geografis. Manfaatkan platform seperti WhatsApp Business untuk menerima pesanan langsung dari konsumen, atau gunakan media sosial seperti Instagram dan Facebook untuk memamerkan tangkapan segar harian. Bergabunglah dengan marketplace online yang memiliki fitur pengiriman khusus produk segar.',
    advantage: 'Jangkauan luas, pembeli lebih beragam, margin tinggi',
    note: 'Foto tangkapan yang menarik dengan pencahayaan baik dapat meningkatkan minat pembeli secara signifikan di media sosial.',
  },
  {
    number: '06',
    title: 'Koperasi dan Kelompok Nelayan',
    detail:
      'Bergabung dengan koperasi nelayan memberikan kekuatan tawar kolektif yang lebih besar. Koperasi dapat menegosiasikan harga lebih baik dengan pembeli besar, mengakses fasilitas penyimpanan bersama, dan mendistribusikan biaya operasional seperti es batu dan transportasi. Selain itu, koperasi sering kali memiliki akses ke program bantuan pemerintah dan kredit usaha.',
    advantage: 'Kekuatan negosiasi, akses modal, dukungan pemerintah',
    note: 'Aktif berpartisipasi dalam kegiatan koperasi untuk mendapatkan manfaat maksimal, termasuk akses ke program subsidi dan pelatihan.',
  },
];

const PRICE_FACTORS = [
  { factor: 'Kesegaran Ikan', impact: 'Sangat Tinggi', desc: 'Perbedaan harga bisa 2–3x antara ikan sangat segar dan kurang segar' },
  { factor: 'Ukuran Seragam', impact: 'Tinggi', desc: 'Ikan berukuran seragam lebih mudah dijual dan dihargai lebih konsisten' },
  { factor: 'Musim Tangkap', impact: 'Tinggi', desc: 'Di luar musim, harga naik signifikan karena suplai berkurang' },
  { factor: 'Jenis Ikan', impact: 'Tinggi', desc: 'Ikan premium (kakap, kerapu, tuna) memiliki margin lebih tinggi' },
  { factor: 'Kemasan', impact: 'Sedang', desc: 'Kemasan yang rapi dan higienis meningkatkan persepsi kualitas' },
  { factor: 'Waktu Penjualan', impact: 'Sedang', desc: 'Pagi hari (05.00–08.00) adalah waktu terbaik dengan harga tertinggi' },
];

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0c2d52] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-200 border-t-white rounded-full animate-spin" />
    </div>
  );
}

export default function PemasaranIkanBlogPage() {
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
          <span className="text-xs text-sky-200 font-semibold truncate">Pemasaran Ikan</span>
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
          alt="Pemasaran Ikan"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#061525]/92 via-[#061525]/45 to-transparent" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 md:px-12 w-full pb-14">
          <div className="mb-4">
            <span className="inline-block px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-white/15 border border-white/25 text-sky-200 rounded backdrop-blur-sm">
              Strategi Penjualan
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white leading-tight tracking-tight mb-4 max-w-2xl">
            Pemasaran Ikan
          </h1>
          <div className="flex items-center gap-4 text-xs text-white/55">
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <span>5 menit baca</span>
            </div>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span>6 saluran distribusi</span>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span>Panduan Penjualan</span>
          </div>
        </div>
      </section>

      {/* Article Body */}
      <article className="max-w-4xl mx-auto px-6 md:px-12 py-14">

        {/* Intro */}
        <div className="max-w-3xl mb-14">
          <div className="w-12 h-1 bg-[#0c2d52] rounded mb-6" />
          <p className="text-lg sm:text-xl text-zinc-700 leading-relaxed mb-5 font-light">
            Menangkap ikan dengan baik hanyalah setengah dari perjalanan. Setengah lainnya adalah memastikan ikan tersebut mencapai tangan pembeli dengan harga yang adil dan menguntungkan. Strategi pemasaran yang tepat dapat meningkatkan pendapatan nelayan tradisional hingga dua kali lipat dengan volume tangkapan yang sama.
          </p>
          <p className="text-base text-zinc-600 leading-relaxed">
            Panduan ini membahas 6 saluran distribusi utama yang dapat diakses oleh nelayan tradisional, beserta faktor-faktor yang menentukan harga jual ikan di pasar.
          </p>
        </div>

        {/* Section Divider */}
        <div className="flex items-center gap-4 mb-10">
          <div className="flex-1 h-px bg-zinc-100" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 px-2">
            6 Saluran Distribusi
          </span>
          <div className="flex-1 h-px bg-zinc-100" />
        </div>

        {/* Channels Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-16">
          {CHANNELS.map((ch) => (
            <div
              key={ch.number}
              className="p-6 border border-zinc-200 rounded-2xl hover:border-[#0c2d52]/40 hover:shadow-lg transition-all duration-300 bg-white group"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#0c2d52] text-white flex items-center justify-center font-extrabold text-sm shadow-sm">
                  {ch.number}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-[#0c2d52] text-sm mb-2 uppercase tracking-wide">
                    {ch.title}
                  </h3>
                  <p className="text-xs text-zinc-600 leading-relaxed mb-4">
                    {ch.detail}
                  </p>
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-xl bg-green-50 border border-green-100">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-green-700 mb-1">Keunggulan</p>
                      <p className="text-xs text-green-900 leading-snug">{ch.advantage}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 mb-1">Tips Praktis</p>
                      <p className="text-xs text-amber-900 leading-snug">{ch.note}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Price Factors Table */}
        <div className="mb-16">
          <h2 className="text-xl font-extrabold text-[#0c2d52] uppercase tracking-tight mb-2">
            Faktor Penentu Harga Jual
          </h2>
          <p className="text-sm text-zinc-500 mb-6 leading-relaxed">
            Pahami faktor-faktor ini untuk memaksimalkan harga jual hasil tangkapan Anda.
          </p>
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0c2d52] text-white">
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider">Faktor</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider">Pengaruh</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {PRICE_FACTORS.map((row, i) => (
                  <tr
                    key={row.factor}
                    className={`border-t border-zinc-100 ${i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/60'}`}
                  >
                    <td className="px-5 py-3.5 text-xs font-semibold text-zinc-800">{row.factor}</td>
                    <td className="px-5 py-3.5 text-xs">
                      <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        row.impact === 'Sangat Tinggi'
                          ? 'bg-sky-100 text-sky-700'
                          : row.impact === 'Tinggi'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-zinc-100 text-zinc-600'
                      }`}>
                        {row.impact}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-zinc-600">{row.desc}</td>
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
                Strategi Diversifikasi
              </h3>
              <p className="text-sm text-zinc-700 leading-relaxed">
                Jangan bergantung pada satu saluran distribusi saja. Nelayan yang sukses biasanya mengombinasikan dua hingga tiga saluran sekaligus — misalnya TPI untuk volume besar, pedagang pengumpul untuk ikan berukuran sedang, dan penjualan langsung ke restoran untuk ikan premium — guna memaksimalkan pendapatan total dari setiap tangkapan.
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
              href="/dashboard/nelayan/blog/edukasi-pemeliharaan-ikan"
              className="group flex gap-4 p-4 border border-zinc-200 rounded-2xl bg-white hover:border-[#0c2d52]/40 hover:shadow-md transition-all duration-300"
            >
              <div className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden">
                <img
                  src={relatedImg1.src}
                  alt="Edukasi Pemeliharaan Ikan"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0c2d52]/50">
                  Teknik Budidaya
                </span>
                <h4 className="text-sm font-bold text-zinc-900 mt-1 leading-snug group-hover:text-[#0c2d52] transition-colors line-clamp-2">
                  Edukasi Pemeliharaan Ikan
                </h4>
                <p className="text-xs text-zinc-400 mt-1.5">6 menit baca</p>
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
