'use client';

interface LoadingAnalysisProps {
  steps: { label: string; done: boolean; active: boolean }[];
  locationName?: string;
}

export default function LoadingAnalysis({ steps, locationName }: LoadingAnalysisProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center max-w-lg mx-auto">
      {/* Animated Ocean Spinner */}
      <div className="relative w-24 h-24 mb-8">
        <div className="absolute inset-0 rounded-full border-4 border-[#162e52]/15" />
        <div className="absolute inset-0 rounded-full border-4 border-t-[#162e52] border-r-[#162e52] border-b-transparent border-l-transparent animate-spin" />
        <div
          className="absolute inset-3 rounded-full border-4 border-b-sky-500 border-l-sky-500 border-t-transparent border-r-transparent animate-spin"
          style={{ animationDirection: 'reverse', animationDuration: '1.4s' }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <svg className="w-8 h-8 text-[#162e52]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
          </svg>
        </div>
      </div>

      <h2 className="text-2xl font-extrabold text-[#162e52] mb-2 tracking-tight">
        Mengolah &amp; Menganalisis Data
      </h2>
      <p className="text-xs text-zinc-500 mb-8 max-w-sm">
        {locationName ? `Area target: ${locationName}` : 'Dua Agentic AI (Aruna & Triton) sedang melakukan penarikan data dan permodelan lokasi pencemaran.'}
      </p>

      {/* Steps List */}
      <div className="w-full space-y-3">
        {steps.map((step, i) => (
          <div
            key={i}
            className={`flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border transition-all duration-300 ${
              step.done
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900 shadow-sm'
                : step.active
                ? 'bg-white border-[#162e52] text-[#162e52] shadow-md ring-2 ring-[#162e52]/10'
                : 'bg-zinc-50 border-zinc-200 text-zinc-400 opacity-60'
            }`}
          >
            <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
              {step.done ? (
                <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : step.active ? (
                <div className="w-4 h-4 border-2 border-[#162e52] border-t-transparent rounded-full animate-spin" />
              ) : (
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-300" />
              )}
            </div>
            <span className="text-xs font-semibold text-left flex-1">{step.label}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-8">
        Integrasi Groq AI · BMKG · GFW
      </p>
    </div>
  );
}
