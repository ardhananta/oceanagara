/** Major Indonesian ports used to compute "nearest port" distance from risk points. */
export interface Port {
  name: string;
  lat: number;
  lon: number;
}

export const INDONESIAN_PORTS: Port[] = [
  { name: 'Belawan (Medan)', lat: 3.79, lon: 98.69 },
  { name: 'Sibolga', lat: 1.74, lon: 98.78 },
  { name: 'Batam', lat: 1.12, lon: 104.02 },
  { name: 'Tanjung Pinang', lat: 0.93, lon: 104.44 },
  { name: 'Dumai', lat: 1.66, lon: 101.44 },
  { name: 'Palembang (Boom Baru)', lat: -2.99, lon: 104.76 },
  { name: 'Pangkalbalam', lat: -2.13, lon: 106.13 },
  { name: 'Tanjung Priok (Jakarta)', lat: -6.1, lon: 106.88 },
  { name: 'Cirebon', lat: -6.71, lon: 108.56 },
  { name: 'Tanjung Emas (Semarang)', lat: -6.94, lon: 110.42 },
  { name: 'Tanjung Perak (Surabaya)', lat: -7.2, lon: 112.73 },
  { name: 'Tanjung Wangi (Banyuwangi)', lat: -8.21, lon: 114.37 },
  { name: 'Benoa (Bali)', lat: -8.75, lon: 115.21 },
  { name: 'Lembar (Lombok)', lat: -8.73, lon: 116.07 },
  { name: 'Bima', lat: -8.46, lon: 118.72 },
  { name: 'Teluk Bayur (Padang)', lat: -0.99, lon: 100.37 },
  { name: 'Panjang (Lampung)', lat: -5.46, lon: 105.31 },
  { name: 'Pontianak', lat: -0.03, lon: 109.28 },
  { name: 'Banjarmasin', lat: -3.33, lon: 114.54 },
  { name: 'Balikpapan', lat: -1.27, lon: 116.83 },
  { name: 'Samarinda', lat: -0.5, lon: 117.15 },
  { name: 'Tarakan', lat: 3.31, lon: 117.59 },
  { name: 'Makassar', lat: -5.13, lon: 119.41 },
  { name: 'Kendari', lat: -3.97, lon: 122.51 },
  { name: 'Toli-Toli', lat: 1.04, lon: 120.82 },
  { name: 'Bitung', lat: 1.44, lon: 125.19 },
  { name: 'Ambon', lat: -3.69, lon: 128.17 },
  { name: 'Ternate', lat: 0.79, lon: 127.38 },
  { name: 'Tual', lat: -5.63, lon: 132.75 },
  { name: 'Sorong', lat: -0.88, lon: 131.28 },
  { name: 'Depapre (Jayapura)', lat: -2.49, lon: 140.45 },
  { name: 'Merauke', lat: -8.49, lon: 140.4 },
];
