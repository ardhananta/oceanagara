'use client';

const STEPS = [
  {
    label: 'Memeriksa foto ikan',
    desc: 'Mata, insang, sisik & lendir',
  },
  {
    label: 'Menilai detail fisik',
    desc: 'Tekstur, rigor & tanda pembusukan',
  },
  {
    label: 'Menghitung skor kesegaran',
    desc: 'Kesimpulan & saran penanganan',
  },
];

export default function ScanLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative w-14 h-14 flex-shrink-0">
          <div className="absolute inset-0 rounded-full border-2 border-sky-400/30" />
          <div className="absolute inset-0 rounded-full border-2 border-t-sky-300 border-r-sky-300 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-sky-200">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
            </svg>
          </div>
        </div>
        <div>
          <p className="text-xs font-extrabold text-white uppercase tracking-wider">
            Sardine sedang memindai…
          </p>
          <p className="text-[10px] text-sky-200/70 font-medium">
            Analisis model vision Groq — butuh beberapa detik
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {STEPS.map((step, i) => (
          <div key={step.label} className="flex items-center gap-3">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0 transition-colors ${
                i === 0
                  ? 'bg-sky-400 text-sky-950 animate-pulse'
                  : 'bg-white/10 text-sky-200/50'
              }`}
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className={`text-[11px] font-bold ${i === 0 ? 'text-white' : 'text-sky-200/50'}`}>
                {step.label}
              </p>
              <p className="text-[9px] text-sky-200/40 font-medium">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-sky-500 to-sky-300 animate-[scanbar_1.2s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}