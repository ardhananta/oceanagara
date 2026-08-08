'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthChange, getUserProfile } from '@/app/service/authentication';
import heroImg from '@/public/img/MasyarakatAirLaut.png';
import articleImg from '@/public/img/ocean_water_quality.png';
import relatedImg1 from '@/public/img/MasyarakatKualitasIkan.png';
import relatedImg2 from '@/public/img/MasyarakatPengolahanIkan.png';

const PARAMETERS = [
  {
    number: '01',
    title: 'Kejernihan dan Warna Air',
    unit: 'Visibilitas minimal 10 meter',
    valueRange: 'Biru jernih, tanpa lapisan minyak atau buih berlebih',
    detail:
      'Kejernihan air laut dipengaruhi oleh kandungan partikel tersuspensi, fitoplankton, dan material organik terlarut. Air yang jernih dengan visibilitas tinggi mengindikasikan rendahnya tingkat polusi dan sedimentasi. Warna air yang berubah menjadi hijau pekat, cokelat, atau berbusa bisa menandakan blooming alga berbahaya (HAB) atau masuknya limbah organik dalam jumlah besar.',
    indicators: ['Air berwarna biru atau biru-hijau alami', 'Tidak ada lapisan minyak di permukaan', 'Visibilitas bawah air minimal 10 meter', 'Tidak ada buih putih berlebihan'],
    warning: 'Warna cokelat atau merah dapat menandakan red tide — fenomena berbahaya bagi biota laut dan manusia.',
  },
  {
    number: '02',
    title: 'Salinitas (Kadar Garam)',
    unit: 'PSU (Practical Salinity Unit)',
    valueRange: '30 – 35 PSU untuk laut tropis',
    detail:
      'Salinitas adalah ukuran konsentrasi garam terlarut dalam air laut. Nilai normal laut tropis Indonesia berkisar antara 30–35 PSU. Penurunan salinitas di bawah 28 PSU (hiposalinitas) biasanya disebabkan oleh masukan air tawar berlebih seperti limpasan hujan atau sungai, yang dapat memengaruhi tekanan osmotik organisme laut. Salinitas tinggi di atas 40 PSU (hipersalinitas) ditemukan di area dengan penguapan tinggi.',
    indicators: ['Nilai normal 30–35 PSU', 'Stabil sepanjang musim', 'Penyimpangan pada musim hujan atau kemarau ekstrem', 'Bisa diukur dengan refraktometer atau salinometer'],
    warning: 'Perubahan salinitas mendadak dapat menyebabkan kematian massal biota laut yang sensitif.',
  },
  {
    number: '03',
    title: 'Derajat Keasaman (pH)',
    unit: 'Skala 0–14 (pH)',
    valueRange: '7.8 – 8.3 (sedikit basa) optimal',
    detail:
      'Air laut secara alami bersifat sedikit basa dengan pH 7.8–8.3. Nilai ini penting untuk proses kalsifikasi biota seperti karang, moluska, dan krustasea. Penyerapan karbon dioksida (CO2) berlebih dari atmosfer menyebabkan pengasaman laut — penurunan pH yang mengancam kemampuan karang membentuk rangka kalsium karbonat. Ini merupakan dampak nyata perubahan iklim pada ekosistem pesisir.',
    indicators: ['pH 7.8–8.3 adalah rentang sehat', 'Di bawah 7.8 berpotensi merusak karang', 'Pengasaman terkait emisi CO2 global', 'Dapat diukur dengan pH meter digital'],
    warning: 'Penurunan pH sebesar 0.1 unit setara dengan peningkatan keasaman 26% — jauh lebih signifikan dari yang terlihat.',
  },
  {
    number: '04',
    title: 'Oksigen Terlarut (DO)',
    unit: 'mg/L (miligram per liter)',
    valueRange: 'Minimal 6 mg/L untuk kehidupan biota',
    detail:
      'Dissolved Oxygen (DO) adalah oksigen yang larut dalam air dan tersedia bagi organisme laut untuk bernapas. Nilai DO minimal 6 mg/L diperlukan agar mayoritas ikan dan biota bentik dapat bertahan hidup. Eutrofikasi — kelebihan nutrisi dari limbah pertanian dan rumah tangga — menyebabkan pertumbuhan alga masif, lalu kematian alga, kemudian dekomposisi yang menguras oksigen hingga terjadi "zona mati" (dead zone) di mana hampir tidak ada kehidupan.',
    indicators: ['Nilai normal: 6–8 mg/L', 'Di bawah 4 mg/L: stres pada ikan', 'Di bawah 2 mg/L: kondisi kritis, kematian massal', 'Lebih tinggi di perairan yang banyak fitoplankton aktif'],
    warning: 'Dead zone hipoksik terbesar di dunia mencakup ribuan kilometer persegi dan terus meluas akibat polusi nutrisi.',
  },
  {
    number: '05',
    title: 'Biota Indikator Ekosistem',
    unit: 'Keragaman spesies (indeks biodiversitas)',
    valueRange: 'Karang hidup, lamun, ikan beragam',
    detail:
      'Kehadiran dan keragaman spesies tertentu merupakan bioindikator alami kesehatan ekosistem laut. Terumbu karang yang hidup dan berwarna-warni, padang lamun yang subur, serta keragaman ikan karang yang tinggi menandakan kondisi perairan yang sehat. Sebaliknya, dominasi alga cokelat atau karang mati berwarna putih (bleaching) mengindikasikan tekanan ekosistem yang serius.',
    indicators: ['Terumbu karang berwarna dengan tutupan tinggi', 'Padang lamun lebat dan sehat', 'Keragaman ikan karang tinggi', 'Tidak ada dominasi satu spesies invasif'],
    warning: 'Pemutihan karang (coral bleaching) terjadi ketika suhu naik 1-2 derajat di atas rata-rata selama beberapa minggu.',
  },
];

const THREATS = [
  {
    title: 'Pencemaran Plastik',
    desc: 'Mikroplastik tertelan biota laut, masuk rantai makanan, dan akhirnya dapat dikonsumsi manusia melalui seafood.',
  },
  {
    title: 'Limpasan Pertanian',
    desc: 'Pupuk nitrogen dan fosfor dari lahan pertanian memicu eutrofikasi yang mengurangi oksigen terlarut secara drastis.',
  },
  {
    title: 'Limbah Industri',
    desc: 'Logam berat seperti merkuri, timbal, dan kadmium terakumulasi dalam jaringan ikan dan berbahaya bila dikonsumsi.',
  },
  {
    title: 'Pengasaman Laut',
    desc: 'Penyerapan CO2 dari emisi fosil menurunkan pH laut, mengancam karang, moluska, dan ekosistem pesisir secara keseluruhan.',
  },
];

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#162e52] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-200 border-t-white rounded-full animate-spin" />
    </div>
  );
}

export default function KondisiAirLautBlogPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeParam, setActiveParam] = useState<number | null>(null);

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
          <span className="text-xs text-sky-200 font-semibold truncate">Kondisi Air Laut</span>
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
          alt="Edukasi Kondisi Air Laut"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#06111e]/93 via-[#06111e]/45 to-transparent" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 md:px-12 w-full pb-14">
          <div className="mb-4">
            <span className="inline-block px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-white/15 border border-white/25 text-sky-200 rounded backdrop-blur-sm">
              Ekosistem Laut
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white leading-tight tracking-tight mb-4 max-w-2xl">
            Edukasi Kondisi Air Laut
          </h1>
          <div className="flex items-center gap-4 text-xs text-white/55">
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <span>6 menit baca</span>
            </div>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span>5 parameter kunci</span>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span>Sains Kelautan</span>
          </div>
        </div>
      </section>

      {/* ── Article Body ──────────────────────────────────────────── */}
      <article className="max-w-4xl mx-auto px-6 md:px-12 py-14">

        {/* Intro */}
        <div className="max-w-3xl mb-14">
          <div className="w-12 h-1 bg-[#162e52] rounded mb-6" />
          <p className="text-lg sm:text-xl text-zinc-700 leading-relaxed mb-5 font-light">
            Laut menutupi lebih dari 70 persen permukaan bumi dan menjadi sumber
            kehidupan bagi lebih dari 3 miliar manusia. Namun, kondisi air laut yang
            terus berubah — akibat perubahan iklim, polusi, dan aktivitas manusia —
            mengancam ekosistem yang menjadi basis ketahanan pangan dan mata
            pencaharian jutaan nelayan Indonesia.
          </p>
          <p className="text-base text-zinc-600 leading-relaxed">
            Memahami parameter kualitas air laut bukan hanya untuk para ilmuwan.
            Sebagai masyarakat pesisir atau konsumen hasil laut, pemahaman ini
            membantu kita membuat keputusan yang lebih bijak tentang lingkungan dan
            pola konsumsi. Berikut adalah 5 parameter kunci yang menentukan kesehatan
            ekosistem laut kita.
          </p>
        </div>

        {/* Section title */}
        <div className="flex items-center gap-4 mb-10">
          <div className="flex-1 h-px bg-zinc-100" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 px-2">
            5 Parameter Kualitas Air Laut
          </span>
          <div className="flex-1 h-px bg-zinc-100" />
        </div>

        {/* Parameters */}
        <div className="space-y-5 mb-16">
          {PARAMETERS.map((param, index) => (
            <div
              key={param.number}
              className="border border-zinc-200 rounded-2xl overflow-hidden hover:border-[#162e52]/40 hover:shadow-lg transition-all duration-300 bg-white"
            >
              {/* Header — always visible */}
              <button
                onClick={() => setActiveParam(activeParam === index ? null : index)}
                className="w-full flex items-center gap-5 p-5 md:p-6 text-left group"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#162e52] text-white flex items-center justify-center font-extrabold text-sm shadow-sm">
                  {param.number}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-extrabold text-[#162e52] text-sm uppercase tracking-wide">
                    {param.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5">
                    <span className="text-xs font-semibold text-sky-700 bg-sky-50 border border-sky-100 px-2.5 py-0.5 rounded-full">
                      {param.valueRange}
                    </span>
                    <span className="text-xs text-zinc-400">{param.unit}</span>
                  </div>
                </div>
                <div className={`flex-shrink-0 w-8 h-8 rounded-lg border border-zinc-200 flex items-center justify-center transition-all duration-200 ${activeParam === index ? 'bg-[#162e52] border-[#162e52]' : 'bg-white group-hover:border-zinc-400'}`}>
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${activeParam === index ? 'rotate-180 text-white' : 'text-zinc-500'}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </button>

              {/* Expandable content */}
              {activeParam === index && (
                <div className="border-t border-zinc-100 px-5 md:px-6 pb-6 pt-5 space-y-5">
                  <p className="text-sm text-zinc-600 leading-relaxed">{param.detail}</p>

                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-3">Indikator Kesehatan</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {param.indicators.map((ind, i) => (
                        <div key={i} className="flex items-start gap-2.5 p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                          <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[#162e52] mt-1.5" />
                          <p className="text-xs text-zinc-700 leading-relaxed">{ind}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-3.5 bg-amber-50 border border-amber-100 rounded-xl">
                    <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                    </svg>
                    <p className="text-xs text-amber-800 leading-relaxed">{param.warning}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Instruction for accordion */}
        <p className="text-xs text-zinc-400 text-center -mt-10 mb-16">
          Klik pada setiap parameter untuk melihat penjelasan lengkap dan indikator kesehatan.
        </p>

        {/* Article image */}
        <figure className="rounded-2xl overflow-hidden mb-16 shadow-lg border border-zinc-100">
          <img
            src={articleImg.src}
            alt="Kondisi dan kualitas air laut yang sehat"
            className="w-full object-cover max-h-72 md:max-h-80"
          />
          <figcaption className="px-5 py-3.5 bg-zinc-50 border-t border-zinc-100">
            <p className="text-xs text-zinc-500 italic">
              Perairan laut yang sehat dicirikan dengan kejernihan tinggi, kehidupan
              biota yang beragam, dan parameter fisika-kimia yang berada dalam rentang
              optimal untuk keseimbangan ekosistem.
            </p>
          </figcaption>
        </figure>

        {/* Threats section */}
        <div className="mb-16">
          <h2 className="text-xl font-extrabold text-[#162e52] uppercase tracking-tight mb-2">
            Ancaman Terhadap Kualitas Air Laut
          </h2>
          <p className="text-sm text-zinc-500 mb-6 leading-relaxed">
            Memahami ancaman ini adalah langkah pertama untuk menjadi konsumen dan
            warga negara yang lebih bertanggung jawab terhadap ekosistem laut.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {THREATS.map((threat, i) => (
              <div
                key={i}
                className="p-5 border border-zinc-200 rounded-2xl bg-white hover:border-red-200 hover:shadow-md transition-all duration-300"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-900 mb-1.5">{threat.title}</h4>
                    <p className="text-xs text-zinc-600 leading-relaxed">{threat.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action callout */}
        <div className="p-6 rounded-2xl bg-[#162e52]/5 border border-[#162e52]/15 mb-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#162e52] text-white flex items-center justify-center mt-0.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 3.741-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#162e52] uppercase tracking-wide mb-1.5">
                Apa yang Bisa Dilakukan Masyarakat
              </h3>
              <p className="text-sm text-zinc-700 leading-relaxed">
                Kurangi penggunaan plastik sekali pakai, hindari membuang sampah ke perairan, pilih produk ramah lingkungan, dan dukung program pemulihan terumbu karang di daerah Anda. Setiap tindakan kecil, bila dilakukan secara kolektif, memberikan dampak nyata bagi kesehatan ekosistem laut untuk generasi mendatang.
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
              href="/dashboard/masyarakat/blog/pengolahan-ikan"
              className="group flex gap-4 p-4 border border-zinc-200 rounded-2xl bg-white hover:border-[#162e52]/40 hover:shadow-md transition-all duration-300"
            >
              <div className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden">
                <img
                  src={relatedImg2.src}
                  alt="Pengolahan Ikan"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#162e52]/50">Keamanan Pangan</span>
                <h4 className="text-sm font-bold text-zinc-900 mt-1 leading-snug group-hover:text-[#162e52] transition-colors line-clamp-2">
                  Cara Pengolahan Ikan yang Benar
                </h4>
                <p className="text-xs text-zinc-400 mt-1.5">4 menit baca</p>
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
