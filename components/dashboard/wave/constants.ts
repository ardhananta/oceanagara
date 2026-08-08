import type { WaveRegionPoint } from './types';

/** Auto-refresh interval for BMKG telemetry data (1 minute) */
export const AUTO_REFRESH_MS = 60 * 1000;

/** Long-period swell threshold: waves ≥ 12s are hazardous for small vessels & coast */
export const LONG_PERIOD_SWELL_S = 12;

/** Minimum wave height (m) to consider a swell alert */
export const SWELL_DANGER_MIN_HEIGHT_M = 1.25;

/** Wave-height stroke thresholds matching BMKG web scale */
export const WAVE_HEIGHT_ALERT_M = 2.5;
export const WAVE_HEIGHT_MODERATE_M = 1.25;

/** Wind-speed stroke thresholds (knots) */
export const WIND_STORM_KT = 30;
export const WIND_STRONG_KT = 20;
export const WIND_MODERATE_KT = 10;

export const CARDINALS = [
  { abbr: 'U', full: 'Utara (N)' },
  { abbr: 'TL', full: 'Timur Laut (NE)' },
  { abbr: 'T', full: 'Timur (E)' },
  { abbr: 'TG', full: 'Tenggara (SE)' },
  { abbr: 'S', full: 'Selatan (S)' },
  { abbr: 'BD', full: 'Barat Daya (SW)' },
  { abbr: 'B', full: 'Barat (W)' },
  { abbr: 'BL', full: 'Barat Laut (NW)' },
] as const;

export const INDONESIA_MARINE_REGIONS: Omit<WaveRegionPoint, 'data' | 'loading'>[] = [
  { id: 'semarang', name: 'Laut Jawa (Semarang - Jepara)', lat: -6.6, lon: 110.5, baseRadiusKm: 80 },
  { id: 'jakarta', name: 'Teluk Jakarta & Kep. Seribu', lat: -5.8, lon: 106.7, baseRadiusKm: 60 },
  { id: 'surabaya', name: 'Selat Madura & Surabaya', lat: -7.1, lon: 112.7, baseRadiusKm: 50 },
  { id: 'malaka', name: 'Selat Malaka (Riau - Medan)', lat: 2.5, lon: 101.5, baseRadiusKm: 100 },
  { id: 'makassar', name: 'Selat Makassar (Sulsel - Kaltim)', lat: -3.0, lon: 118.5, baseRadiusKm: 110 },
  { id: 'bali', name: 'Selat Bali & Selat Lombok', lat: -8.6, lon: 115.3, baseRadiusKm: 65 },
  { id: 'banda', name: 'Perairan Laut Banda', lat: -5.2, lon: 128.5, baseRadiusKm: 120 },
  { id: 'natuna', name: 'Perairan Laut Natuna Utara', lat: 4.0, lon: 108.0, baseRadiusKm: 130 },
  { id: 'arafura', name: 'Perairan Laut Arafura', lat: -7.5, lon: 136.0, baseRadiusKm: 125 },
  { id: 'halmahera', name: 'Laut Halmahera & Maluku', lat: 0.8, lon: 128.2, baseRadiusKm: 105 },
];
