import React from 'react';

export default function AboutUs() {
  return (
    <section id="about-us" className="py-24 bg-white border-b border-zinc-150">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          {/* Column 1: Core System Specifications (Table style) */}
          <div className="border border-zinc-200 bg-white p-8">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6">
              Parameter Sistem & Kinerja
            </h3>
            
            <div className="divide-y divide-zinc-200 text-xs text-zinc-600">
              <div className="py-3.5 flex justify-between">
                <span className="font-semibold text-zinc-900 uppercase tracking-wider">Frekuensi Pemantauan</span>
                <span>Setiap 5 Detik</span>
              </div>
              <div className="py-3.5 flex justify-between">
                <span className="font-semibold text-zinc-900 uppercase tracking-wider">Akurasi Rute Navigasi</span>
                <span>Hingga ±2 Meter</span>
              </div>
              <div className="py-3.5 flex justify-between">
                <span className="font-semibold text-zinc-900 uppercase tracking-wider">Respon Sinyal SOS</span>
                <span>Real-time (&lt; 1 Detik)</span>
              </div>
              <div className="py-3.5 flex justify-between">
                <span className="font-semibold text-zinc-900 uppercase tracking-wider">Kapasitas Kapal Terhubung</span>
                <span>Maks. 50,000 Unit</span>
              </div>
              <div className="py-3.5 flex justify-between">
                <span className="font-semibold text-zinc-900 uppercase tracking-wider">Sertifikasi Protokol Keamanan</span>
                <span>AES-256 Encrypted</span>
              </div>
              <div className="py-3.5 flex justify-between">
                <span className="font-semibold text-zinc-900 uppercase tracking-wider">Uptime Sistem Operasional</span>
                <span>99.98% Radar Uptime</span>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-zinc-200 text-center">
              <div>
                <span className="block text-xl font-bold text-zinc-900">5,280+</span>
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider block mt-1">Armada Aktif</span>
              </div>
              <div>
                <span className="block text-xl font-bold text-zinc-900">24 Jam</span>
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider block mt-1">Siaga SOS</span>
              </div>
              <div>
                <span className="block text-xl font-bold text-zinc-900">12 Bandara</span>
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider block mt-1">Dermaga Utama</span>
              </div>
            </div>
          </div>

          {/* Column 2: Text Narrative */}
          <div className="flex flex-col justify-center">
            <span className="text-zinc-400 text-xs font-semibold uppercase tracking-widest">
              Tentang Kami
            </span>
            <h2 className="mt-2 text-2xl md:text-3xl font-bold tracking-tight text-zinc-900 uppercase leading-tight">
              Membangun Kedaulatan & Keamanan Bahari Indonesia
            </h2>
            <div className="mt-4 h-0.5 w-16 bg-zinc-900" />
            
            <p className="mt-6 text-sm text-zinc-500 leading-relaxed">
              Oceanagara adalah platform navigasi maritim digital terpadu yang dirancang untuk memperkuat keselamatan berlayar dan stabilitas rantai dingin logistik ikan bagi nelayan Indonesia. 
            </p>
            <p className="mt-4 text-sm text-zinc-500 leading-relaxed">
              Kami menyatukan telemetry satelit radar dengan instrumen pelacakan cold chain untuk menjamin bahwa ikan hasil tangkapan nelayan sampai di pelabuhan dalam kondisi terbaik, sekaligus memastikan setiap pelayaran terpantau penuh oleh otoritas laut.
            </p>

            <div className="mt-8 space-y-3.5">
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4 text-zinc-800 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-xs font-semibold text-zinc-700 uppercase tracking-wide">
                  Pemantauan Zona Navigasi & Karang Dangkal Terintegrasi
                </span>
              </div>
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4 text-zinc-800 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-xs font-semibold text-zinc-700 uppercase tracking-wide">
                  Sistem Alarm SOS Instan Langsung ke Basarnas & Syahbandar
                </span>
              </div>
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4 text-zinc-800 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-xs font-semibold text-zinc-700 uppercase tracking-wide">
                  Pencatatan Rantai Dingin Digital Berbasis Sensor Suhu Kapal
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
