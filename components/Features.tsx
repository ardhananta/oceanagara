import React from 'react';

export default function Features() {
  const featuresList = [
    {
      title: 'Cerdas Memantau',
      tagline: 'Sistem Pemantauan Kapal',
      description:
        'Pantau posisi kapal secara real-time dan petakan rute pelayaran menggunakan data AIS terintegrasi untuk meningkatkan efisiensi operasional laut.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      ),
    },
    {
      title: 'Aman Berlayar',
      tagline: 'Navigasi & Sinyal Keselamatan',
      description:
        'Akses peta navigasi aman serta sistem tanggap darurat (SOS) cepat ke stasiun radio pantai terdekat untuk meminimalisir risiko kecelakaan.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      title: 'Mutu Terjaga',
      tagline: 'Log Tangkapan & Suhu Storage',
      description:
        'Catat hasil tangkapan digital secara langsung dan pantau log suhu penyimpanan ikan untuk memastikan kualitas tangkapan tetap optimal sampai di dermaga.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      ),
    },
  ];

  return (
    <section id="feature" className="py-24 bg-white border-b border-zinc-100">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        {/* Section Header */}
        <div className="max-w-xl mb-16">
          <span className="text-zinc-400 text-xs font-semibold uppercase tracking-widest">
            Fitur
          </span>
          <h2 className="mt-2 text-2xl md:text-3xl font-bold tracking-tight text-zinc-900 uppercase">
            Solusi Digital Navigasi & Log Hasil Laut
          </h2>
          <p className="mt-4 text-sm text-zinc-500 leading-relaxed">
            Menghubungkan teknologi pelacakan satelit dengan pencatatan komoditas tangkapan guna menjaga keamanan pelayaran dan mutu logistik ikan.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {featuresList.map((item, index) => (
            <div
              key={index}
              className="p-8 border border-zinc-200 bg-white flex flex-col justify-between"
            >
              <div>
                {/* Icon */}
                <div className="w-10 h-10 border border-zinc-200 text-zinc-700 flex items-center justify-center mb-6">
                  {item.icon}
                </div>

                {/* Title */}
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
                  {item.title}
                </span>

                {/* Subtitle */}
                <h3 className="mt-1.5 text-base font-bold text-zinc-900 uppercase tracking-tight">
                  {item.tagline}
                </h3>

                {/* Description */}
                <p className="mt-3.5 text-xs text-zinc-500 leading-relaxed">
                  {item.description}
                </p>
              </div>

              {/* Action Button/Link */}
              <div className="mt-8 pt-4 border-t border-zinc-150 flex items-center justify-between text-xs font-bold text-zinc-800 hover:text-zinc-950 transition-colors cursor-pointer uppercase tracking-wider">
                <span>Selengkapnya</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
