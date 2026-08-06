'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';

interface Feature {
  title: string;
  tagline: string;
  description: string;
  details: string[];
  accentColor: string;
  imageSrc: string;
  rotate: number;
  stackOrder: number;
}

const featuresList: Feature[] = [
  {
    title: 'Cerdas Memantau',
    tagline: 'Sistem Pemantauan Kapal',
    description:
      'Pantau posisi kapal secara real-time dan petakan rute pelayaran menggunakan data AIS terintegrasi untuk meningkatkan efisiensi operasional laut.',
    details: [
      'Pelacakan posisi GPS real-time 24/7',
      'Integrasi data AIS internasional',
      'Pemetaan rute & jejak historis pelayaran',
      'Notifikasi masuk/keluar zona terlarang',
      'Dashboard armada terpusat',
    ],
    accentColor: '#0ea5e9',
    imageSrc: '/img/Peneliti 1.png',
    rotate: -8,
    stackOrder: 2,
  },
  {
    title: 'Aman Berlayar',
    tagline: 'Navigasi & Sinyal Keselamatan',
    description:
      'Akses peta navigasi aman serta sistem tanggap darurat (SOS) cepat ke stasiun radio pantai terdekat untuk meminimalisir risiko kecelakaan.',
    details: [
      'Peta navigasi laut terperinci & terkini',
      'Tombol SOS satu sentuh ke radio pantai',
      'Peringatan cuaca & gelombang ekstrem',
      'Zona bahaya & terumbu karang terintegrasi',
      'Riwayat koordinat kecelakaan maritim',
    ],
    accentColor: '#10b981',
    imageSrc: '/img/masyarakat 1.png',
    rotate: 6,
    stackOrder: 1,
  },
  {
    title: 'Mutu Terjaga',
    tagline: 'Log Tangkapan & Suhu Storage',
    description:
      'Catat hasil tangkapan digital secara langsung dan pantau log suhu penyimpanan ikan untuk memastikan kualitas tangkapan tetap optimal sampai di dermaga.',
    details: [
      'Pencatatan log tangkapan digital real-time',
      'Pemantauan suhu penyimpanan ikan otomatis',
      'Peringatan suhu kritis & anomali storage',
      'Laporan mutu tangkapan untuk ekspor',
      'Integrasi data ke sistem logistik pelabuhan',
    ],
    accentColor: '#f59e0b',
    imageSrc: '/img/nelayan 1.png',
    rotate: 2,
    stackOrder: 3,
  },
];

/** Absolute position for each card in the stack */
const POSITIONS: React.CSSProperties[] = [
  { top: 0,   left: '50%', marginLeft: '-130px' },   // top-center
  { top: 160, left: 8 },                              // bottom-left
  { top: 160, right: 8 },                             // bottom-right
];

function PolaroidCard({ item, index }: { item: Feature; index: number }) {
  const [hovered, setHovered] = useState(false);

  const CARD_W = 300;
  const IMG_H  = 300; // display height – keeps natural landscape ratio (~4:3)
  const BACK_H = 370; // portrait description card height
  const BOX_H  = BACK_H; // flip container uses the taller value

  return (
    <motion.div
      className="absolute cursor-pointer"
      style={{
        ...POSITIONS[index],
        width: CARD_W,
        zIndex: hovered ? 20 : item.stackOrder,
        perspective: 1200,
      }}
      animate={
        hovered
          ? { rotate: 0, scale: 1.05, y: -20 }
          : { rotate: item.rotate, scale: 1, y: 0 }
      }
      transition={{ type: 'spring', stiffness: 280, damping: 24 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
    >
      {/* ── Flip container ── */}
      <motion.div
        style={{
          position: 'relative',
          width: CARD_W,
          height: BOX_H,
          transformStyle: 'preserve-3d',
        }}
        animate={{ rotateY: hovered ? 180 : 0 }}
        transition={{ duration: 0.65, ease: [0.4, 0.2, 0.2, 1] }}
      >
        {/* ── FRONT: bare image, no card frame ── */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: CARD_W,
            height: IMG_H,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            overflow: 'hidden',
          }}
        >
          <Image
            src={item.imageSrc}
            alt={item.tagline}
            width={CARD_W}
            height={IMG_H}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>

        {/* ── BACK: tall portrait description card ── */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: CARD_W,
            height: BACK_H,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
          className="flex flex-col overflow-hidden rounded-md"
        >
          {/* Container with #c9b08e background */}
          <div className="flex flex-1 flex-col overflow-hidden" style={{ background: '#c9b08e' }}>
            {/* Accent bar */}
            <div className="h-1 w-full shrink-0" style={{ background: item.accentColor }} />

            <div className="flex flex-1 flex-col p-5 overflow-hidden">
              {/* Number */}
              <span
                className="mb-1 block text-[9px] font-black uppercase tracking-[0.2em]"
                style={{ color: item.accentColor }}
              >
                0{index + 1}
              </span>

              {/* Title */}
              <h3 className="mb-3 text-[13px] font-extrabold uppercase leading-tight tracking-wider text-stone-800">
                {item.tagline}
              </h3>

              {/* Divider */}
              <div
                className="mb-4 h-[1.5px] w-10 rounded opacity-60"
                style={{ background: item.accentColor }}
              />

              {/* Description */}
              <p className="mb-5 text-[10.5px] leading-relaxed text-stone-700">
                {item.description}
              </p>

              {/* Detail list */}
              <ul className="flex flex-col gap-3">
                {item.details.map((d, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[10px] leading-snug text-stone-600">
                    <span
                      className="mt-[3px] h-[5px] w-[5px] shrink-0 rounded-full"
                      style={{ background: item.accentColor }}
                    />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Features() {
  return (
    <section id="feature" className="relative overflow-hidden bg-white py-16 lg:py-24 pb-24 lg:pb-32">
      <div className="pointer-events-none absolute inset-0" />

      {/*
        Layout:
        • lg+  : flex-row  — heading left, polaroid stack right (original layout)
        • <lg  : flex-col  — heading on top, cards in a horizontal scrollable row below
      */}
      <div className="relative mx-auto flex max-w-[1200px] flex-col items-center gap-10 px-6
                      lg:flex-row lg:items-center lg:gap-20 lg:px-12">

        {/* ── Heading ── */}
        <div className="w-full shrink-0 text-center lg:w-[360px] lg:text-left">
          <span className="mb-3 block text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">
            Fitur Unggulan
          </span>
          <h2 className="mb-4 text-[clamp(1.5rem,2.5vw,2rem)] font-extrabold uppercase leading-tight tracking-tight text-gray-900">
            Solusi Digital Navigasi &amp; Log Hasil Laut
          </h2>
          <p className="mb-5 text-sm leading-relaxed text-gray-500">
            Menghubungkan teknologi pelacakan satelit dengan pencatatan komoditas tangkapan
            guna menjaga keamanan pelayaran dan mutu logistik ikan.
          </p>
          <p className="flex items-center justify-center gap-1.5 text-[11px] italic text-gray-400 lg:justify-start">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
            </svg>
            Arahkan kursor ke foto untuk melihat detail fitur
          </p>
        </div>

        {/*
          ── Card area ──
          lg+  : fixed-height container with absolute-positioned stacked cards (original)
          <lg  : horizontal flex row, each card is inline (not absolute) so they line up
        */}
        <div className="w-full min-w-0 flex-1">

          {/* Mobile / tablet — horizontal scrollable row */}
          <div className="flex gap-6 overflow-x-auto pb-4 lg:hidden"
               style={{ scrollSnapType: 'x mandatory' }}>
            {featuresList.map((item, i) => (
              <div key={i} style={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
                <PolaroidCard item={item} index={i} />
              </div>
            ))}
          </div>

          {/* Desktop — original stacked absolute layout */}
          <div className="relative hidden lg:block" style={{ height: 600 }}>
            {featuresList.map((item, i) => (
              <PolaroidCard key={i} item={item} index={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
