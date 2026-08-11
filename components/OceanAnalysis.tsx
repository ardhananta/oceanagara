'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView as useFramerInView } from 'framer-motion';

// ─── Shared Viewport Hook ─────────────────────────────────────────────────────

function useSectionInView(threshold = 0.12) {
  const ref = useRef<HTMLElement>(null);
  const inView = useFramerInView(ref as React.RefObject<Element>, {
    once: true,
    amount: threshold,
  });
  return { ref, inView };
}

// ─── NRT Timestamp Badge ──────────────────────────────────────────────────────

function NrtBadge() {
  const [ts, setTs] = useState('');

  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta',
        timeZoneName: 'short',
      });
    setTs(fmt());
    const id = setInterval(() => setTs(fmt()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="inline-flex items-center gap-2 px-3 py-1.5 border border-[#162e52]/20 bg-[#162e52]/5 rounded-full"
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#162e52] opacity-50" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#162e52]" />
      </span>
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#162e52]">
        NRT &mdash; {ts || 'Memuat...'}
      </span>
    </motion.div>
  );
}

// ─── Water Quality Line Chart (stroke-dashoffset draw animation) ──────────────
// Indicative NRT trend data — NOT factual measurements.

const WQ_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt'];
const WQ_VALUES = [72, 68, 65, 63, 60, 57, 54, 52];

function WaterQualityChart({ animate }: { animate: boolean }) {
  const polyRef = useRef<SVGPolylineElement>(null);
  const [pathLen, setPathLen] = useState(0);
  const [dotProgress, setDotProgress] = useState(0); // 0..1
  const rafRef = useRef<number>(0);

  const W = 480;
  const H = 150;
  const PAD = { top: 18, right: 20, bottom: 30, left: 38 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const MIN_V = 38;
  const MAX_V = 86;

  const toX = (i: number) => PAD.left + (i / (WQ_VALUES.length - 1)) * chartW;
  const toY = (v: number) => PAD.top + chartH - ((v - MIN_V) / (MAX_V - MIN_V)) * chartH;

  const polyPoints = WQ_VALUES.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  const areaPoints = [
    `${toX(0)},${PAD.top + chartH}`,
    ...WQ_VALUES.map((v, i) => `${toX(i)},${toY(v)}`),
    `${toX(WQ_VALUES.length - 1)},${PAD.top + chartH}`,
  ].join(' ');

  // Measure polyline length after mount
  useEffect(() => {
    if (polyRef.current) {
      setPathLen(polyRef.current.getTotalLength());
    }
  }, []);

  // rAF-driven dot/line progress
  useEffect(() => {
    if (!animate || pathLen === 0) return;
    const duration = 1500;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      // easeInOutCubic
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      setDotProgress(ease);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate, pathLen]);

  const dashOffset = pathLen * (1 - dotProgress);
  const gridLines = [50, 60, 70, 80];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ overflow: 'visible', display: 'block' }}
      aria-label="Grafik penurunan indeks kualitas air laut"
    >
      <defs>
        <linearGradient id="wqAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#162e52" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#162e52" stopOpacity="0.01" />
        </linearGradient>
        <linearGradient id="wqLineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#162e52" />
        </linearGradient>
        <clipPath id="wqAreaClip">
          <rect x={PAD.left} y={PAD.top} width={chartW * dotProgress} height={chartH + 4} />
        </clipPath>
      </defs>

      {/* Grid lines */}
      {gridLines.map((g) => (
        <g key={g}>
          <line
            x1={PAD.left} y1={toY(g)}
            x2={PAD.left + chartW} y2={toY(g)}
            stroke="#e4e4e7" strokeWidth="1" strokeDasharray="4 4"
          />
          <text x={PAD.left - 7} y={toY(g) + 4} textAnchor="end" fontSize="9" fill="#a1a1aa" fontFamily="inherit">
            {g}
          </text>
        </g>
      ))}

      {/* X-axis labels */}
      {WQ_MONTHS.map((m, i) => (
        <text key={m} x={toX(i)} y={H - 5} textAnchor="middle" fontSize="9" fill="#a1a1aa" fontFamily="inherit">
          {m}
        </text>
      ))}

      {/* Threshold line */}
      <line
        x1={PAD.left} y1={toY(60)}
        x2={PAD.left + chartW} y2={toY(60)}
        stroke="#ef4444" strokeWidth="1" strokeDasharray="6 3" opacity="0.4"
      />
      <text x={PAD.left + chartW + 4} y={toY(60) + 4} fontSize="8" fill="#ef4444" opacity="0.7" fontFamily="inherit">
        min
      </text>

      {/* Area fill — clipped by progress */}
      <polygon
        points={areaPoints}
        fill="url(#wqAreaGrad)"
        clipPath="url(#wqAreaClip)"
      />

      {/* Line — stroke-dashoffset draw */}
      <polyline
        ref={polyRef}
        points={polyPoints}
        fill="none"
        stroke="url(#wqLineGrad)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray={pathLen || 9999}
        strokeDashoffset={pathLen > 0 ? dashOffset : pathLen}
        style={{ transition: 'none' }}
      />

      {/* Animated dots — appear as line passes */}
      {WQ_VALUES.map((v, i) => {
        const dotT = i / (WQ_VALUES.length - 1);
        const visible = dotProgress >= dotT;
        return (
          <circle
            key={i}
            cx={toX(i)}
            cy={toY(v)}
            r={visible ? 3.5 : 0}
            fill="white"
            stroke="#162e52"
            strokeWidth="2"
            style={{ transition: visible ? 'r 0.25s cubic-bezier(0.34,1.56,0.64,1)' : 'none' }}
          />
        );
      })}

      {/* Latest value callout */}
      {dotProgress > 0.95 && (
        <>
          <rect
            x={toX(WQ_VALUES.length - 1) - 21}
            y={toY(WQ_VALUES[WQ_VALUES.length - 1]) - 25}
            width={42}
            height={18}
            rx="4"
            fill="#162e52"
            style={{ animation: 'fadeIn 0.35s ease forwards' }}
          />
          <text
            x={toX(WQ_VALUES.length - 1)}
            y={toY(WQ_VALUES[WQ_VALUES.length - 1]) - 12}
            textAnchor="middle"
            fontSize="9.5"
            fontWeight="700"
            fill="white"
            fontFamily="inherit"
          >
            {WQ_VALUES[WQ_VALUES.length - 1]}
          </text>
        </>
      )}
    </svg>
  );
}

// ─── Ecosystem Diversity Radar (rAF vertex interpolation) ─────────────────────
// Indicative only — NOT real species count data.

const ECO_ITEMS = [
  { label: 'Terumbu Karang', pct: 48 },
  { label: 'Mangrove', pct: 61 },
  { label: 'Padang Lamun', pct: 55 },
  { label: 'Biota Pelagik', pct: 70 },
  { label: 'Ikan Demersal', pct: 59 },
];

function EcoDiversityChart({ animate }: { animate: boolean }) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number>(0);
  const CX = 100; const CY = 100; const R_MAX = 68;
  const angle = (i: number) => -Math.PI / 2 + i * (2 * Math.PI) / ECO_ITEMS.length;

  const pt = (pct: number, i: number) => ({
    x: CX + (pct / 100) * R_MAX * Math.cos(angle(i)),
    y: CY + (pct / 100) * R_MAX * Math.sin(angle(i)),
  });

  const outer = (i: number) => ({
    x: CX + R_MAX * Math.cos(angle(i)),
    y: CY + R_MAX * Math.sin(angle(i)),
  });

  useEffect(() => {
    if (!animate) return;
    const duration = 1300;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setProgress(ease);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate]);

  const dataPath =
    ECO_ITEMS.map((it, i) => {
      const p = pt(it.pct * progress, i);
      return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    }).join(' ') + ' Z';

  const gridLevels = [0.25, 0.5, 0.75, 1];

  return (
    <div className="flex flex-col items-center gap-5">
      <svg
        viewBox="0 0 200 200"
        width="100%"
        style={{ maxWidth: 210, display: 'block' }}
        aria-label="Diagram kondisi keanekaragaman ekosistem laut"
      >
        <defs>
          <radialGradient id="ecoFill" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#162e52" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.08" />
          </radialGradient>
        </defs>

        {/* Grid rings */}
        {gridLevels.map((lvl) => (
          <polygon
            key={lvl}
            points={ECO_ITEMS.map((_, i) => {
              const p = outer(i);
              return `${(CX + (p.x - CX) * lvl).toFixed(2)},${(CY + (p.y - CY) * lvl).toFixed(2)}`;
            }).join(' ')}
            fill="none"
            stroke="#e4e4e7"
            strokeWidth={lvl === 1 ? '1.2' : '0.8'}
          />
        ))}

        {/* Axis lines */}
        {ECO_ITEMS.map((_, i) => {
          const o = outer(i);
          return <line key={i} x1={CX} y1={CY} x2={o.x.toFixed(2)} y2={o.y.toFixed(2)} stroke="#e4e4e7" strokeWidth="1" />;
        })}

        {/* Data area */}
        <path
          d={dataPath}
          fill="url(#ecoFill)"
          stroke="#162e52"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />

        {/* Dots */}
        {ECO_ITEMS.map((it, i) => {
          const p = pt(it.pct * progress, i);
          return (
            <circle
              key={i}
              cx={p.x.toFixed(2)}
              cy={p.y.toFixed(2)}
              r={progress > 0.05 ? '3.5' : '0'}
              fill="white"
              stroke="#162e52"
              strokeWidth="2"
            />
          );
        })}

        {/* Labels */}
        {ECO_ITEMS.map((it, i) => {
          const o = outer(i);
          const lx = CX + (o.x - CX) * 1.22;
          const ly = CY + (o.y - CY) * 1.22;
          const anchor = lx < CX - 3 ? 'end' : lx > CX + 3 ? 'start' : 'middle';
          return (
            <text
              key={i}
              x={lx.toFixed(2)}
              y={ly.toFixed(2)}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize="7.5"
              fill="#52525b"
              fontFamily="inherit"
              fontWeight="600"
            >
              {it.label}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-5 gap-y-2 w-full max-w-[210px]">
        {ECO_ITEMS.map((it) => (
          <motion.div
            key={it.label}
            initial={{ opacity: 0, x: -6 }}
            animate={animate ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="flex items-center gap-1.5"
          >
            <span className="inline-block h-1.5 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: '#162e52' }} />
            <span className="text-[9px] text-zinc-500 font-medium truncate flex-1">{it.label}</span>
            <span className="text-[9px] font-bold text-zinc-700 ml-auto tabular-nums">{it.pct}%</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Pollution Impact Bar Chart (framer-motion + shimmer) ─────────────────────

const POLLUTION_DATA = [
  { label: 'Plastik Mikro', value: 78, color: '#162e52' },
  { label: 'Limbah Organik', value: 61, color: '#1e4a8a' },
  { label: 'Logam Berat', value: 44, color: '#3b6bbd' },
  { label: 'Hidrokarbon', value: 35, color: '#6b93cf' },
];

function PollutionBar({
  item,
  animate,
  index,
}: {
  item: (typeof POLLUTION_DATA)[0];
  animate: boolean;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={animate ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.45, delay: index * 0.12, ease: 'easeOut' }}
    >
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
          {item.label}
        </span>
        <motion.span
          className="text-[10px] font-bold tabular-nums"
          style={{ color: item.color }}
          initial={{ opacity: 0 }}
          animate={animate ? { opacity: 1 } : {}}
          transition={{ delay: index * 0.12 + 0.6, duration: 0.3 }}
        >
          {item.value}%
        </motion.span>
      </div>
      <div className="relative h-2.5 w-full bg-zinc-100 rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ backgroundColor: item.color }}
          initial={{ width: '0%' }}
          animate={animate ? { width: `${item.value}%` } : {}}
          transition={{
            duration: 1.1,
            delay: index * 0.14 + 0.1,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        />
        {/* Shimmer overlay */}
        {animate && (
          <motion.div
            className="absolute inset-y-0 left-0 w-12 rounded-full"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
            }}
            initial={{ x: -48, opacity: 0 }}
            animate={{ x: `${item.value * 4.28}px`, opacity: [0, 1, 0] }}
            transition={{
              duration: 0.7,
              delay: index * 0.14 + 0.7,
              ease: 'easeOut',
            }}
          />
        )}
      </div>
    </motion.div>
  );
}

function PollutionBarChart({ animate }: { animate: boolean }) {
  return (
    <div className="space-y-4">
      {POLLUTION_DATA.map((d, i) => (
        <PollutionBar key={d.label} item={d} animate={animate} index={i} />
      ))}
      <motion.p
        initial={{ opacity: 0 }}
        animate={animate ? { opacity: 1 } : {}}
        transition={{ delay: 0.9, duration: 0.5 }}
        className="text-[9px] text-zinc-400 leading-relaxed pt-1"
      >
        Indeks kontribusi pencemaran terhadap penurunan kualitas air. Data bersifat indikatif berbasis pola pemantauan.
      </motion.p>
    </div>
  );
}

// ─── NRT Parameter Tiles ──────────────────────────────────────────────────────

const NRT_PARAMS = [
  {
    label: 'Indeks Kualitas Air',
    value: '52',
    unit: '/ 100',
    delta: '-3.1',
    trend: 'down' as const,
    note: 'Di bawah ambang aman (60)',
  },
  {
    label: 'Suhu Permukaan Laut',
    value: '29.4',
    unit: '\u00b0C',
    delta: '+0.8',
    trend: 'up' as const,
    note: 'Anomali positif vs rata-rata 5 thn',
  },
  {
    label: 'pH Air Laut',
    value: '7.91',
    unit: '',
    delta: '-0.04',
    trend: 'down' as const,
    note: 'Asidifikasi laut terdeteksi',
  },
  {
    label: 'Oksigen Terlarut',
    value: '5.6',
    unit: 'mg/L',
    delta: '-0.3',
    trend: 'down' as const,
    note: 'Mendekati zona hipoksia',
  },
];

// Animated count-up hook
function useCountUp(target: number, active: boolean, duration = 1000) {
  const [val, setVal] = useState(0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setVal(parseFloat((from + (target - from) * ease).toFixed(2)));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, target, duration]);
  return val;
}

function NrtTile({
  param,
  animate,
  delay,
}: {
  param: (typeof NRT_PARAMS)[0];
  animate: boolean;
  delay: number;
}) {
  const isDown = param.trend === 'down';
  const numericTarget = parseFloat(param.value);
  const displayCount = useCountUp(numericTarget, animate, 1200 + delay);
  const displayValue = isNaN(numericTarget)
    ? param.value
    : displayCount.toFixed(param.value.includes('.') ? (param.value.split('.')[1]?.length ?? 0) : 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={animate ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ duration: 0.5, delay: delay / 1000, ease: [0.34, 1.1, 0.64, 1] }}
      whileHover={{ y: -3, boxShadow: '0 6px 20px rgba(22,46,82,0.08)' }}
      className="border border-zinc-200 bg-white p-4 flex flex-col gap-1 cursor-default transition-colors duration-200 hover:border-[#162e52]/30"
    >
      <span className="text-[9px] uppercase tracking-[0.18em] font-bold text-zinc-400 leading-tight">
        {param.label}
      </span>
      <div className="flex items-end gap-1.5 mt-1">
        <span className="text-2xl font-black text-zinc-900 leading-none tabular-nums">
          {displayValue}
        </span>
        {param.unit && (
          <span className="text-xs text-zinc-400 font-medium mb-0.5">{param.unit}</span>
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
        <span
          className="text-[10px] font-bold tabular-nums"
          style={{ color: isDown ? '#b91c1c' : '#d97706' }}
        >
          {param.delta}
        </span>
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none"
          style={{ color: isDown ? '#b91c1c' : '#d97706', flexShrink: 0 }}
        >
          {isDown ? (
            <path d="M5 2v6M2.5 5.5L5 8l2.5-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="M5 8V2M2.5 4.5L5 2l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
        <span className="text-[9px] text-zinc-400 leading-tight">{param.note}</span>
      </div>
    </motion.div>
  );
}

// ─── Chart Card Wrapper ────────────────────────────────────────────────────────

function ChartCard({
  children,
  animate,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  animate: boolean;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={animate ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`border border-zinc-200 bg-white p-5 ${className}`}
    >
      {children}
    </motion.div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

export default function OceanAnalysis() {
  const { ref, inView } = useSectionInView(0.08);

  return (
    <section
      id="ocean-analysis"
      ref={ref as React.RefObject<HTMLElement>}
      className="relative bg-white border-t border-zinc-100 py-16 lg:py-24 overflow-hidden"
    >
      <div className="relative max-w-[1200px] mx-auto px-6 lg:px-12">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-10 lg:mb-14 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          >
            <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400">
              Data Kelautan
            </span>
            <h2 className="text-[clamp(1.4rem,2.5vw,2rem)] font-extrabold uppercase leading-tight tracking-tight text-zinc-900">
              Analisis Kondisi Laut
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">
              Visualisasi kondisi terkini perairan Indonesia berdasarkan indikator pemantauan laut.
              Data bersifat indikatif dan diperbarui secara near real-time.
            </p>
          </motion.div>
          <div className="shrink-0">
            <NrtBadge />
          </div>
        </div>

        {/* ── NRT Tiles ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          {NRT_PARAMS.map((p, i) => (
            <NrtTile key={p.label} param={p} animate={inView} delay={i * 100} />
          ))}
        </div>

        {/* ── Charts Grid ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

          {/* Chart 1: Water Quality Line — xl spans 2 cols */}
          <ChartCard animate={inView} delay={0.15} className="xl:col-span-2">
            <div className="flex items-start justify-between mb-4 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-zinc-400">
                  Indeks Kualitas Air Laut
                </p>
                <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                  Tren 8 bulan terakhir &mdash; penurunan bertahap terdeteksi
                </p>
              </div>
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={inView ? { opacity: 1, scale: 1 } : {}}
                transition={{ delay: 0.5, duration: 0.35, ease: [0.34, 1.2, 0.64, 1] }}
                className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded-full"
              >
                Menurun
              </motion.span>
            </div>
            <WaterQualityChart animate={inView} />
            <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-6 rounded" style={{ background: 'linear-gradient(90deg,#60a5fa,#162e52)' }} />
                <span className="text-[9px] text-zinc-400">Indeks WQI</span>
              </div>
              <span className="text-[9px] text-zinc-300">|</span>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 rounded" style={{ background: '#ef4444', opacity: 0.5 }} />
                <span className="text-[9px] text-zinc-400">Ambang aman (60)</span>
              </div>
            </div>
          </ChartCard>

          {/* Chart 2: Ecosystem Diversity Radar */}
          <ChartCard animate={inView} delay={0.25}>
            <div className="mb-4">
              <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-zinc-400">
                Kondisi Ekosistem Laut
              </p>
              <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                Persentase kondisi aktif terhadap potensi baseline
              </p>
            </div>
            <EcoDiversityChart animate={inView} />
          </ChartCard>

          {/* Chart 3: Pollution Impact — full width */}
          <ChartCard animate={inView} delay={0.3} className="md:col-span-2 xl:col-span-3">
            <div className="flex items-start justify-between mb-5 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-zinc-400">
                  Dampak Pencemaran Terhadap Ekosistem
                </p>
                <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                  Kontribusi jenis pencemar terhadap degradasi ekosistem laut &mdash; data indikatif
                </p>
              </div>
              <motion.span
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: 1 } : {}}
                transition={{ delay: 0.5 }}
                className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 bg-[#162e52]/5 text-[#162e52] border border-[#162e52]/15 rounded-full"
              >
                Indikatif
              </motion.span>
            </div>
            <div className="max-w-2xl">
              <PollutionBarChart animate={inView} />
            </div>
          </ChartCard>

        </div>

        {/* ── Disclaimer ───────────────────────────────────────────────────── */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.9, duration: 0.6 }}
          className="mt-6 text-[10px] text-zinc-400 leading-relaxed"
        >
          Catatan: Seluruh data pada section ini bersifat indikatif dan merupakan ilustrasi tren pemantauan.
          Nilai tidak mewakili pengukuran faktual resmi dari lembaga tertentu. Pembaruan near real-time
          mencerminkan frekuensi sinkronisasi sistem, bukan sampling langsung.
        </motion.p>

      </div>
    </section>
  );
}
