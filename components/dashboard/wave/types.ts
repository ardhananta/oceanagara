import type { BmkgWeatherData } from '@/app/types/maritime';

export type { BmkgWeatherData };

export interface WaveRegionPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  baseRadiusKm: number;
  data?: BmkgWeatherData;
  loading?: boolean;
}

export interface WindFieldGrid {
  lo1: number; la1: number; lo2: number; la2: number;
  nx: number; ny: number; dx: number; dy: number;
  uData: number[]; vData: number[];
}

export interface WindFieldMeta {
  source: 'bmkg-inawaves' | 'synthetic' | 'unknown';
  baserun: string;
}

export interface TrendPoint {
  x: number;
  y: number;
  value: number;
}

export interface TrendPeriodPoint {
  x: number;
  y: number;
  long: boolean;
}
