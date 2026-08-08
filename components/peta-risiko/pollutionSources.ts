/**
 * Known industrial pollution sources in Indonesia (public knowledge):
 * oil refineries, coal power plants, industrial estates, and metal smelters.
 * Used to attribute "where the pollution comes from" for each risk point.
 */
export type PollutionSourceKind = 'kilang' | 'pltu' | 'kawasan-industri' | 'smelter';

export interface PollutionSource {
  name: string;
  kind: PollutionSourceKind;
  lat: number;
  lon: number;
}

export const POLLUTION_SOURCES: PollutionSource[] = [
  // ── Kilang minyak ──────────────────────────────────────────────────────────
  { name: 'Kilang Cilacap (Pertamina RU IV)', kind: 'kilang', lat: -7.71, lon: 109.01 },
  { name: 'Kilang Balongan (Pertamina RU VI)', kind: 'kilang', lat: -6.35, lon: 108.35 },
  { name: 'Kilang Balikpapan (Pertamina RU V)', kind: 'kilang', lat: -1.25, lon: 116.85 },
  { name: 'Kilang Dumai (Pertamina RU II)', kind: 'kilang', lat: 1.66, lon: 101.45 },
  { name: 'Kilang Plaju Palembang (RU III)', kind: 'kilang', lat: -3.0, lon: 104.79 },
  { name: 'Kilang Kasim Sorong', kind: 'kilang', lat: -0.96, lon: 131.52 },
  { name: 'Kilang Tuban (GRR)', kind: 'kilang', lat: -6.92, lon: 112.05 },
  { name: 'Kilang Cepu (Bojonegoro)', kind: 'kilang', lat: -7.15, lon: 111.59 },

  // ── PLTU batubara ──────────────────────────────────────────────────────────
  { name: 'PLTU Suralaya (Cilegon)', kind: 'pltu', lat: -5.9, lon: 106.02 },
  { name: 'PLTU Paiton (Probolinggo)', kind: 'pltu', lat: -7.72, lon: 113.58 },
  { name: 'PLTU Gresik', kind: 'pltu', lat: -7.15, lon: 112.65 },
  { name: 'PLTU Indramayu', kind: 'pltu', lat: -6.35, lon: 108.2 },
  { name: 'PLTU Tanjung Jati B (Jepara)', kind: 'pltu', lat: -6.47, lon: 110.71 },
  { name: 'PLTU Rembang (Sluke)', kind: 'pltu', lat: -6.65, lon: 111.55 },
  { name: 'PLTU Adipala (Cilacap)', kind: 'pltu', lat: -7.67, lon: 109.18 },
  { name: 'PLTU Muara Karang (Jakarta)', kind: 'pltu', lat: -6.1, lon: 106.78 },
  { name: 'PLTU Lontar (Tangerang)', kind: 'pltu', lat: -5.97, lon: 106.53 },
  { name: 'PLTU Palabuhanratu', kind: 'pltu', lat: -7.03, lon: 106.55 },
  { name: 'PLTU Pacitan', kind: 'pltu', lat: -8.2, lon: 111.1 },
  { name: 'PLTU Tanjung Awar-Awar (Tuban)', kind: 'pltu', lat: -6.77, lon: 111.92 },
  { name: 'PLTU Banjarsari (Cilegon)', kind: 'pltu', lat: -5.98, lon: 106.03 },
  { name: 'PLTU Labuan (Pandeglang)', kind: 'pltu', lat: -6.35, lon: 105.83 },

  // ── Kawasan industri ───────────────────────────────────────────────────────
  { name: 'Kawasan Industri Cilegon (Krakatau Steel)', kind: 'kawasan-industri', lat: -6.02, lon: 106.02 },
  { name: 'Kawasan Industri Cikarang (Jababeka/MM2100)', kind: 'kawasan-industri', lat: -6.28, lon: 107.15 },
  { name: 'Kawasan Industri Karawang (KIIC)', kind: 'kawasan-industri', lat: -6.3, lon: 107.3 },
  { name: 'Kawasan Industri Gresik (KIG)', kind: 'kawasan-industri', lat: -7.12, lon: 112.65 },
  { name: 'Kawasan Industri SIER Surabaya', kind: 'kawasan-industri', lat: -7.33, lon: 112.78 },
  { name: 'Kawasan Industri Candi (Semarang)', kind: 'kawasan-industri', lat: -6.99, lon: 110.42 },
  { name: 'Kawasan Industri Medan (KIM)', kind: 'kawasan-industri', lat: 3.67, lon: 98.67 },
  { name: 'Kawasan Industri Makassar (KIMA)', kind: 'kawasan-industri', lat: -5.17, lon: 119.45 },
  { name: 'Kawasan Industri Batam (Kabil)', kind: 'kawasan-industri', lat: 1.12, lon: 104.05 },
  { name: 'Kawasan Industri Merak', kind: 'kawasan-industri', lat: -5.93, lon: 106.0 },
  { name: 'Kawasan Industri Lampung (Panjang)', kind: 'kawasan-industri', lat: -5.47, lon: 105.32 },
  { name: 'Kawasan Industri Balikpapan (Kariangau)', kind: 'kawasan-industri', lat: -1.18, lon: 116.86 },
  { name: 'Kawasan Industri Dumai', kind: 'kawasan-industri', lat: 1.65, lon: 101.43 },
  { name: 'Kawasan Industri Bitung', kind: 'kawasan-industri', lat: 1.44, lon: 125.19 },
  { name: 'Kawasan Industri Banjarmasin', kind: 'kawasan-industri', lat: -3.3, lon: 114.58 },
  { name: 'Kawasan Industri Samarinda', kind: 'kawasan-industri', lat: -0.42, lon: 117.13 },

  // ── Smelter / pengolahan logam ─────────────────────────────────────────────
  { name: 'Smelter Gresik (PT Smelting)', kind: 'smelter', lat: -7.14, lon: 112.64 },
  { name: 'Smelter Manyar Gresik (Freeport)', kind: 'smelter', lat: -7.05, lon: 112.58 },
  { name: 'IMIP Morowali (nikel)', kind: 'smelter', lat: -2.98, lon: 121.85 },
  { name: 'IWIP Weda Bay (Halmahera)', kind: 'smelter', lat: -0.34, lon: 128.25 },
  { name: 'Smelter Pomalaa (Kolaka)', kind: 'smelter', lat: -4.18, lon: 121.62 },
];
