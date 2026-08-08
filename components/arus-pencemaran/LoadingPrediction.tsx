'use client';

interface LoadingPredictionProps {
  regionName: string;
}

const STEPS = [
  'Mengambil data arus laut BMKG INAWAVES…',
  'Menjalankan simulasi drift Lagrangian (arus per segmen)…',
  'Menganalisis arah gerak, tujuan akhir, dan estimasi waktu tiba…',
];

export default function LoadingPrediction({ regionName }: LoadingPredictionProps) {
  return (
    <div className="flex items-center justify-center min-h-[420px]">
      <div className="w-full max-w-lg bg-white border rounded-2xl shadow-sm p-8 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#162e52] flex items-center justify-center mb-4 rotate-3">
          <svg className="w-7 h-7 text-sky-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3 19.5l1.8-6h14.4l1.8 6H3Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v9M9 7.5h6" />
          </svg>
        </div>

        <h3 className="text-base font-bold text-[#162e52] mb-1">Memproses Prediksi Penyebaran Limbah</h3>
        <p className="text-xs text-zinc-500 mb-6">
          Wilayah: <span className="font-semibold text-zinc-700">{regionName}</span>
        </p>

        <div className="space-y-3 text-left">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold border-2 transition-colors ${
                  i === 0 ? 'border-sky-500 text-sky-600' : 'border-zinc-200 text-zinc-300'
                }`}
              >
                {i + 1}
              </div>
              <span className={`text-xs ${i === 0 ? 'font-semibold text-zinc-800' : 'text-zinc-400'}`}>
                {label}
              </span>
              {i === 0 && (
                <div className="ml-auto w-4 h-4 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
              )}
            </div>
          ))}
        </div>

        <p className="text-[10px] text-zinc-400 mt-6 leading-relaxed">
          Simulasi menghitung pergerakan limbah per 6 jam berdasarkan vektor arus BMKG,
          hingga mencapai pesisir atau batas waktu 120 jam.
        </p>
      </div>
    </div>
  );
}
