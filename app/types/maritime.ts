// ─── Chat & Agent Types ─────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/** Structured location data extracted by Agent 1 */
export interface LocationQuery {
  ready: boolean;
  regionName: string;         // e.g. "Laut Jawa Pesisir Semarang"
  lat: number;                // center latitude
  lon: number;                // center longitude
  boundingBox: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  startDate: string;          // ISO date string
  endDate: string;
  pollutionTypes: string[];   // e.g. ["minyak", "limbah industri", "plastik"]
  summary: string;            // Human-readable summary for UI
}

/** A single risk point produced by Agent 2 */
export interface RiskPoint {
  lat: number;
  lon: number;
  riskScore: number;          // 0–100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskType: string;           // e.g. "tumpahan minyak", "limbah industri"
  description: string;        // AI-generated explanation
  source: string;             // Which API data contributed
  timestamp?: string;
  /** Perkiraan radius sebaran limbah dalam km (ditampilkan sebagai lingkaran di peta) */
  spillRadiusKm?: number;
  /** Bentuk/fase limbah: cairan, partikel, padat, gas, dll. */
  wasteForm?: string;
  /** Deterministic attribution: factories/PLTU/refineries/ports/vessels nearby */
  nearbySources?: RiskSource[];
}

/** A detected pollution source attributed to a risk point */
export interface RiskSource {
  kind: 'kilang' | 'pltu' | 'kawasan-industri' | 'smelter' | 'pelabuhan' | 'kapal' | 'muara';
  name: string;
  distanceKm: number;
  direction: string;          // cardinal or "sekitar"/"pesisir"
  count?: number;
  detail?: string;
}

/** Full analysis result from Agent 2 */
export interface RiskAnalysisResult {
  locationName: string;
  analysisTimestamp: string;
  riskPoints: RiskPoint[];
  overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  recommendations: string[];
  dataSources: string[];
}

// ─── Agent 1 API Response ────────────────────────────────────────────────────

export interface Agent1Response {
  message: string;
  location: LocationQuery | null;
}

// ─── Agent 2 API Request/Response ────────────────────────────────────────────

export interface Agent2Request {
  location: LocationQuery;
  maritimeData: MaritimeDataBundle;
  /** Optional: nearby pollution sources / port / vessel context for attribution */
  sourceContext?: string;
}
export interface Agent2Response {
  result: RiskAnalysisResult;
}

// ─── Maritime API Data Types ─────────────────────────────────────────────────

export interface BmkgWeatherData {
  source: 'bmkg';
  region: string;
  forecasts: Array<{
    time: string;
    windSpeed: number;       // m/s
    windDirection: number;   // degrees
    waveHeight: number;      // meters
    wavePeriod: number;      // seconds — mean wave period (height-weighted wind sea + swell)
    swellPeriod: number;     // seconds — primary swell period
    currentSpeed: number;    // m/s
    currentDirection: number;
    visibility: number;      // km
    weatherCode: string;
  }>;
}

export interface GfwVesselEvent {
  type: 'fishing' | 'loitering' | 'port_visit';
  lat: number;
  lon: number;
  startTime: string;
  endTime: string;
  vesselId: string;
  flag?: string;
  /** Nama kapal (dari GFW vessel.name) */
  vesselName?: string;
  /** Jenis kapal: fishing | cargo | tanker | passenger | support | other */
  vesselType?: string;
  /** Kode pelabuhan tujuan berikutnya (GFW vessel.nextPort) */
  nextPort?: string;
  /** Estimasi arah gerak kapal dalam derajat (0=N), dihitung dari bounding box event */
  heading?: number;
  /** Kecepatan rata-rata (knots) saat event */
  speedKnots?: number;
  /** Jarak ke pantai saat akhir event (km, dari GFW) */
  endDistanceFromShoreKm?: number;
  /** Jarak ke pelabuhan saat akhir event (km, dari GFW) */
  endDistanceFromPortKm?: number;
}

export interface GfwData {
  source: 'gfw';
  vesselEvents: GfwVesselEvent[];
  totalEvents: number;
  /** true = data simulasi (API GFW tidak terjangkau / circuit breaker) */
  isMock?: boolean;
}

/** Bundle of all fetched maritime data, passed to Agent 2 */
export interface MaritimeDataBundle {
  bmkg: BmkgWeatherData | null;
  gfw: GfwData | null;
  satellite: SatelliteAnalysis | null;
  /** Deteksi sampah padat terapung (Sentinel-2 + indeks FDI) */
  solidWaste: SatelliteSolidWasteAnalysis | null;
  fetchedAt: string;
  errors: string[];
}

// ─── Analisis Citra Satelit (NASA GIBS) ───────────────────────────────────────

/** Indikasi anomali yang terdeteksi pada satu layer citra satelit. */
export interface SatelliteAnomaly {
  /** bloom = ledakan klorofil (tanda eutrofikasi), slick = area gelap di laut (kandidat minyak), thermal = zona suhu tinggi, turbidity = plume sedimen/kekeruhan di muara, cloud = tutupan awan */
  kind: 'bloom' | 'slick' | 'thermal' | 'turbidity' | 'cloud';
  label: string;
  /** Fraksi piksel anomali terhadap total piksel (0-1) */
  fraction: number;
  centerLat: number;
  centerLon: number;
  /** Perkiraan luas area anomali (km²) */
  areaKm2: number;
  note: string;
  /** Estimasi pH permukaan laut di area anomali (heuristik palet) */
  ph?: number;
  /** Estimasi konsentrasi klorofil-a (mg/m³) — dari palet GIBS */
  chl?: number;
  /** Estimasi suhu permukaan laut (°C) — dari palet GIBS */
  sst?: number;
}

/** Estimasi pH permukaan laut untuk satu layer (heuristik palet warna). */
export interface SatellitePhEstimate {
  min: number;
  max: number;
  avg: number;
  /** Fraksi piksel asam (pH < 7.5) */
  acidFraction: number;
  /** Fraksi piksel basa (pH > 8.4) */
  alkalineFraction: number;
}

/** Hasil analisis satu layer citra satelit GIBS. */
export interface SatelliteLayerAnalysis {
  layer: string;
  label: string;
  /** Tanggal citra yang benar-benar dipakai (setelah fallback) */
  imageryDate: string;
  /** Persentase piksel valid (tidak transparan) */
  coveragePct: number;
  /** Persentase piksel yang tampak awan (hanya TrueColor) */
  cloudPct?: number;
  /** URL WMS (EPSG:3857) untuk overlay di peta */
  wmsUrl: string;
  anomalies: SatelliteAnomaly[];
  /** Estimasi pH permukaan laut (heuristik palet warna) */
  ph?: SatellitePhEstimate;
  /** Nilai median klorofil-a (mg/m³) — hanya layer klorofil */
  medianChl?: number;
  /** Nilai median suhu permukaan (°C) — hanya layer SST */
  medianSst?: number;
}

/** Hasil analisis citra satelit untuk deteksi indikasi pencemaran. */
export interface SatelliteAnalysis {
  source: 'satelit';
  layers: SatelliteLayerAnalysis[];
  summary: string;
  fetchedAt: string;
  /** Estimasi berbasis palet warna — bukan pengukuran ilmiah */
  disclaimer: string;
}

// ─── Deteksi Sampah Padat Terapung (Sentinel-2, indeks FDI) ───────────────────

/** Kandidat sampah padat terapung yang lolos ambang kepercayaan (≥ 0.7). */
export interface SatelliteWasteCandidate {
  lat: number;
  lon: number;
  /** Perkiraan luas area kandidat (m²) */
  areaM2: number;
  /** Skor kepercayaan 0-1 — hanya kandidat ≥ 0.7 yang dilaporkan */
  confidence: number;
  /** Tanggal citra (jendela mundur 1 minggu) yang ikut mengonfirmasi kandidat */
  observedDates: string[];
  /** Jarak ke pantai terdekat (km) */
  coastKm: number;
}

/** Hasil deteksi sampah padat terapung via Sentinel-2 (indeks FDI, Biermann et al. 2020). */
export interface SatelliteSolidWasteAnalysis {
  source: 'sentinel-2';
  /** Tanggal citra yang dianalisis (maks 3, terbaik per tanggal) */
  dates: string[];
  /** Persentase area laut bersih (tanpa awan) yang dianalisis — mean semua tanggal */
  coveragePct: number;
  candidates: SatelliteWasteCandidate[];
  summary: string;
  fetchedAt: string;
  disclaimer: string;
}

// ─── Zona Tangkap Ikan (klorofil + SST + spesies + arah gerak) ────────────────

/** Zona penangkapan ikan yang direkomendasikan (aman dari kontaminasi). */
export interface FishingZone {
  lat: number;
  lon: number;
  /** Perkiraan luas zona (km²) */
  areaKm2: number;
  /** Skor kesesuaian habitat 0-1 (klorofil × suhu) */
  score: number;
  /** Spesies ikan yang berpotensi ada (jendela suhu & klorofil) */
  species: string[];
  /** Suhu permukaan rata-rata zona (°C) */
  meanSst: number;
  /** Klorofil-a rata-rata zona (mg/m³) */
  meanChl: number;
  /** Kecepatan arus laut (m/s) dari BMKG */
  currentSpeed?: number;
  /** Arah arus laut (°) dari BMKG */
  currentDirection?: number;
  /** Arah pergerakan kawanan ikan (°, 0=N) — dominan arus/gradien klorofil */
  movementDeg?: number;
  /** Label arah pergerakan kawanan (bahasa Indonesia) */
  movementLabel: string;
  /** Jarak ke pantai terdekat (km) */
  coastKm: number;
  /** Jarak ke pantai terdekat dalam Mil Laut (NMi) */
  coastNmi?: number;
  /** Jumlah kapal penangkap (GFW fishing/loitering) dalam radius 30 km dari zona */
  nearbyVessels?: number;
  /** Heading dominan kapal di sekitar zona (°, 0=N) — arah migrasi ikan komersial */
  vesselHeading?: number;
  /** Catatan peringatan (mis. bloom ekstrem di dekat zona) */
  flagged?: string;
}

/** Hasil rekomendasi zona tangkap ikan berbasis citra satelit. */
export interface FishingZoneAnalysis {
  source: 'zona-tangkap';
  /** Tanggal citra yang dipakai (klorofil/SST) */
  date: string;
  zones: FishingZone[];
  /** Jumlah titik kontaminasi yang berhasil dihindari */
  avoidedCount: number;
  /** Kandidat sampah padat terdekat yang membuat zona ditolak (informasi) */
  rejectedZones: number;
  summary: string;
  fetchedAt: string;
  disclaimer: string;
  /** Aktivitas kapal penangkap GFW di wilayah (hotspot konsentrasi kapal) */
  gfw?: FishingGfwActivity | null;
  /** Hasil analisis Agentic AI (rekomendasi, arah gerak, saran GFW) */
  aiAnalysis?: FishingAiAnalysis | null;
}

/** Ringkasan aktivitas kapal penangkap (Global Fishing Watch) di bbox. */
export interface FishingGfwActivity {
  /** Total event kapal terdeteksi (semua jenis) */
  totalEvents: number;
  /** Event menangkap ikan (fishing) */
  fishingEvents: number;
  /** Event berhenti/melayang (loitering — indikasi penangkapan) */
  loiteringEvents: number;
  /** true = data simulasi karena API GFW tidak terjangkau */
  isMock: boolean;
  /** Hotspot konsentrasi kapal (klaster event berdekatan) */
  hotspots: Array<{
    lat: number;
    lon: number;
    /** Jumlah event kapal dalam klaster */
    count: number;
    /** Heading dominan kapal dalam klaster (°, 0=N) — arah migrasi ikan */
    headingDeg?: number;
  }>;
  /** Periode data (mulai s/d akhir) */
  period: string;
}

/** Hasil analisis Agentic AI untuk zona tangkap ikan. */
export interface FishingAiAnalysis {
  /** Zona terbaik yang direkomendasikan AI (indeks ke zones) */
  recommendedZoneIndex?: number;
  /** Ringkasan rekomendasi zona terbaik */
  recommendation: string;
  /** Analisis arah pergerakan kawanan ikan (menuju mana & alasannya) */
  movementAnalysis: string;
  /** Saran berbasis aktivitas kapal penangkap GFW (migrasi ikan komersial) */
  gfwSuggestion: string;
  /** Peringatan risiko (mis. HAB, kontaminasi terdekat, cuaca) */
  risks: string[];
  /** Rekomendasi tindakan */
  recommendations: string[];
  /** true = analisis degradasi (AI tidak terjangkau, pakai heuristik) */
  degraded?: boolean;
}


// ── Analisis Kualitas Ikan (iklim, suhu, limbah) ───────────────────────────

/** Kualitas ikan per spesies di zona. */
export interface SpeciesQuality {
  /** Nama spesies (jendela suhu/klorofil zona) */
  species: string;
  /** Skor kualitas spesies 0-100 */
  quality: number;
  /** Catatan dampak (stres suhu, bloom, kontaminasi) */
  note: string;
}

/** Penilaian kualitas ikan untuk satu zona tangkap. */
export interface FishQualityScore {
  /** Indeks ke zones (analisis zona-tangkap) */
  zoneIndex: number;
  lat: number;
  lon: number;
  /** Skor keseluruhan kualitas ikan zona 0-100 (tinggi = lebih baik) */
  qualityScore: number;
  /** Label kualitas: Sangat Baik / Baik / Sedang / Berisiko */
  qualityLabel: string;
  /** Sumber tekanan dominan (stres suhu, HAB, jarak kontaminasi) */
  pressureSources: string[];
  /** Jarak ke titik kontaminasi terdekat (km) */
  nearestContaminantKm: number | null;
  /** Label kontaminasi terdekat */
  nearestContaminantLabel?: string | null;
  /** Kualitas per spesies yang masuk jendela habitat zona */
  speciesQuality: SpeciesQuality[];
  /** Tekanan suhu 0-100 (anomali vs jendela spesies) */
  sstStress: number;
  /** Risiko ledakan alga (klorofil > 8 mg/m³) */
  habRisk: boolean;
  /** Estimasi pH permukaan laut zona (heuristik klorofil × SST) */
  ph?: number;
  /** Tekanan pH 0-100 (deviasi dari kisaran optimal laut ~8.0) */
  phStress?: number;
}

/** Hasil analisis kualitas ikan vs perubahan iklim, suhu, dan limbah. */
export interface FishQualityAnalysis {
  source: 'kualitas-ikan';
  /** Tanggal citra yang dipakai (klorofil/SST) */
  date: string;
  /** Zona tangkap hasil analisis zona-tangkap (reused) */
  zones: FishingZone[];
  /** Penilaian kualitas per zona */
  scores: FishQualityScore[];
  summary: string;
  fetchedAt: string;
  disclaimer: string;
  /** Citra overlay penyebaran klorofil-a & SST (PNG data URL, bounds = bbox analisis). */
  layers?: {
    chl?: FishQualityLayer;
    sst?: FishQualityLayer;
    /** Citra overlay estimasi pH permukaan laut (heuristik klorofil × SST). */
    ph?: FishQualityLayer;
  };
  /** Analisis Agentic AI (dampak iklim, limbah, prediksi kawanan) */
  aiAnalysis?: FishQualityAiAnalysis | null;
}

/** Satu citra overlay (PNG data URL) hasil rasterisasi grid 256×256. */
export interface FishQualityLayer {
  dataUrl: string;
  /** Tanggal citra sumber */
  date: string;
  /** Rentang nilai fisik yang direpresentasikan palet (min–max) */
  min: number;
  max: number;
}

/** Hasil analisis Agentic AI untuk kualitas ikan. */
export interface FishQualityAiAnalysis {
  /** Ringkasan kualitas ikan & tekanan iklim di wilayah */
  summary: string;
  /** Dampak perubahan iklim (suhu naik) terhadap spesies */
  climateImpact: string;
  /** Dampak limbah/polusi terhadap kualitas ikan */
  wasteImpact: string;
  /** Prediksi tujuan pergerakan kawanan berikutnya (koordinat + label) */
  nextSchool: {
    lat: number;
    lon: number;
    label: string;
  };
  /** Peringatan risiko */
  risks: string[];
  /** Rekomendasi tindakan */
  recommendations: string[];
  /** true = analisis degradasi (AI tidak terjangkau, pakai heuristik) */
  degraded?: boolean;
}

// ── Verifikasi Kualitas Tangkapan (setelah ikan ditangkap) ───────────────────

/** Pengamatan peneliti/nelayan terhadap hasil tangkapan setelah melaut. */
export interface TangkapanVerificationInput {
  /** Spesies ikan yang ditangkap (dari zona prediksi) */
  species: string;
  /** Cuaca saat penangkapan: cerah | berawan | hujan | angin-kencang */
  weather: string;
  /** Suhu air laut saat penangkapan (°C) */
  waterTemp: number;
  /** Durasi penyimpanan sejak ditangkap: <2 | 2-6 | 6-12 | 12-24 | >24 (jam) */
  holdHours: string;
  /** Kondisi mata ikan: jernih | agak-keruh | keruh-cekung */
  eyes: string;
  /** Warna insang: merah-segar | merah-muda | coklat-keabu */
  gills: string;
  /** Bau: khas-laut | amis-ringan | amis-menyengat */
  smell: string;
  /** Tekstur daging: kenyal | agak-lembek | lembek-berair */
  flesh: string;
  /** Foto tangkapan (base64 JPEG, maks 3) — resolusi penuh untuk analisis AI. */
  photos?: string[];
  /** Versi thumbnail foto (base64, kecil) — disimpan di Firestore agar ringkas. */
  photoThumbs?: string[];
}

/** Hasil penilaian AI atas kesegaran tangkapan. */
export interface TangkapanVerificationVerdict {
  /** Skor kesegaran 0-100 (tinggi = lebih segar) */
  freshnessScore: number;
  /** Segar / Mulai Berubah / Tidak Segar */
  freshnessLabel: string;
  /** Ringkasan 1-2 kalimat */
  summary: string;
  /** Perubahan yang terlihat (akibat cuaca/suhu) */
  changes: string[];
  /** Saran penyimpanan & penanganan */
  storageAdvice: string[];
  /** Peringatan risiko */
  risks: string[];
  /** Temuan visual AI dari foto tangkapan (bila foto dianalisis) */
  visualFindings?: string[];
  /** true = foto ikut dianalisis vision model */
  photosAnalyzed?: boolean;
  /** true = analisis degradasi (AI tidak terjangkau, pakai heuristik) */
  degraded?: boolean;
}

// ── Scan Kualitas Ikan (analisis foto kesegaran via model vision) ─────────────

/** Penilaian satu indikator fisik ikan dari foto. */
export interface FishScanIndicator {
  /** Kunci indikator: eyes | gills | scales | slime | flesh | smell | abdomen | rigor */
  key: string;
  /** Nama indikator (Mata, Insang, Sisik, ...) */
  name: string;
  /** Status indikator: segar / mulai berubah / tidak segar */
  status: 'good' | 'fair' | 'bad';
  /** Deskripsi detail hasil pengamatan indikator pada foto */
  observation: string;
  /** Kontribusi skor indikator sesuai status (100/60/20). */
  score: number;
}

/** Hasil scan kesegaran ikan dari analisis foto. */
export interface FishScanResult {
  /** Skor kesegaran 0-100 (tinggi = lebih segar) */
  freshnessScore: number;
  /** Segar / Mulai Berubah / Tidak Segar */
  freshnessLabel: string;
  /** Spesies ikan yang terdeteksi/diisi pengguna */
  species: string;
  /** Ringkasan 1-2 kalimat status kesegaran */
  summary: string;
  /** Penilaian detail per indikator fisik */
  indicators: FishScanIndicator[];
  /** Temuan visual detail dari foto (mata, insang, sisik, lendir, daging, rigor) */
  findings: string[];
  /** Saran penanganan & penyimpanan */
  storageAdvice: string[];
  /** Peringatan risiko */
  risks: string[];
  /** true = analisis degradasi (model vision tidak terjangkau, pakai heuristik) */
  degraded?: boolean;
}

// ── Laporan Limbah Warga (foto + validasi keaslian berbasis AI) ──────────────

/** Jenis limbah yang dilaporkan warga. */
export type WasteType = 'plastik' | 'tumpahan-minyak' | 'kimia-pabrik' | 'organik' | 'sampah-campuran' | 'lainnya';

/** Status akhir validasi laporan. */
export type WasteValidationStatus = 'verified' | 'suspected' | 'rejected';

/** Lokasi pelaporan (GPS perangkat atau manual). */
export interface WasteLocationInfo {
  lat: number;
  lon: number;
  /** Akurasi GPS dalam meter (bila dari perangkat). */
  accuracyMeters?: number | null;
  /** asal koordinat: GPS perangkat atau input manual. */
  source: 'gps' | 'manual';
  /** Nama area / alamat deskriptif dari pelapor (opsional). */
  label?: string;
}

/** Metadata EXIF foto yang diekstrak di sisi klien sebelum kompresi. */
export interface WasteExifInfo {
  gpsLat?: number;
  gpsLon?: number;
  /** Waktu pengambilan foto (UTC ISO, dari EXIF) */
  capturedAt?: string;
}

/** Cek keaslian foto oleh AI vision. */
export interface WastePhotoCheck {
  /** benar-benar foto limbah/pencemaran asli (bukan layar kaca/stock/foto lama) */
  genuine: boolean;
  /** keyakinan 0-100 */
  score: number;
  /** catatan analisis visual */
  note: string;
  /** jenis limbah yang terdeteksi AI */
  wasteType: string;
  /** lingkungan yang terlihat (pantai / sungai / laut / darat / tidak jelas) */
  environment: string;
  /** tanda-tanda kecurigaan (foto berulang, rekayasa, kualitas rendah, dll) */
  riskSigns: string[];
}

/** Cek kesesuaian lokasi: GPS perangkat vs GPS EXIF foto. */
export interface WasteLocationCheck {
  /** apakah foto punya EXIF GPS */
  referenced: boolean;
  /** jarak antara GPS perangkat dan GPS EXIF foto (meter), null bila tidak ada EXIF */
  distanceMeters: number | null;
  /** match = ≤150 m, close = ≤2 km, mismatch = >2 km, unverifiable = tanpa EXIF GPS */
  verdict: 'match' | 'close' | 'mismatch' | 'unverifiable';
  note: string;
}

/** Cek kesesuaian waktu: waktu EXIF foto vs waktu pelaporan. */
export interface WasteTimestampCheck {
  /** waktu pengambilan foto dari EXIF (ISO, UTC) */
  photoTime: string | null;
  /** selisih jam (foto vs laporan); null bila tanpa EXIF waktu */
  driftHours: number | null;
  /** valid = selisih ≤ 3 jam, drifted = > 3 jam, unverifiable = tanpa EXIF waktu */
  verdict: 'valid' | 'drifted' | 'unverifiable';
  note: string;
}

/** Hasil validasi keaslian laporan limbah. */
export interface WasteReportValidation {
  status: WasteValidationStatus;
  /** keyakinan keseluruhan 0-100 */
  confidence: number;
  photoCheck: WastePhotoCheck;
  locationCheck: WasteLocationCheck;
  timestampCheck: WasteTimestampCheck;
  /** ringkasan 1-2 kalimat */
  summary: string;
  findings: string[];
  recommendations: string[];
  /** model Groq yang dipakai, bila analisis AI jalan */
  model?: string;
  /** true = analisis degradasi (AI tidak terjangkau, validasi geospasial saja) */
  degraded?: boolean;
}

/** Satu laporan limbah warga. */
export interface WasteReport {
  id?: string;
  uid: string;
  /** nama pelapor (dari profil) */
  reporterName: string;
  location: WasteLocationInfo;
  /** jenis limbah pilihan pelapor */
  wasteType: WasteType;
  description: string;
  /** thumbnail foto (base64, max 512px) */
  photoThumbs: string[];
  /** waktu laporan tercatat (ISO) */
  capturedAt: string;
  /** metadata EXIF foto (GPS & waktu) */
  exif?: WasteExifInfo | null;
  /** hasil validasi AI */
  validation: WasteReportValidation | null;
  /** kunci deduplikasi laporan (bulan + koordinat + hash foto) */
  reportKey?: string;
  createdAt?: unknown;
}

// ── Arus Pencemaran (prediksi penyebaran limbah berbasis arus) ────────────────

/** Vektor arus laut (BMKG): arah MENUJU (0=N, searah jarum jam), m/s */
export interface CurrentVector {
  speedMps: number;
  directionDeg: number;
}

/** Satu titik lintasan hasil simulasi drift */
export interface DriftPoint {
  lat: number;
  lon: number;
  /** Jam sejak titik buangan */
  timeOffsetHours: number;
  /** Jarak lurus dari titik buangan (km) */
  distanceFromOriginKm: number;
  /** Jarak tempuh kumulatif (km) */
  cumulativeDistanceKm: number;
  speedMps: number;
  directionDeg: number;
}

/** Tujuan akhir limbah: terdampar di pantai / lepas pantai / batas simulasi */
export interface DriftDestination {
  lat: number;
  lon: number;
  type: 'coast' | 'open-sea' | 'time-limit' | 'no-data';
  label: string;
}

/** Jenis analisis pada halaman arus-pencemaran. */
export type ArusAnalysisMode = 'buangan' | 'kapal' | 'pabrik';

/** Satu peristiwa kapal melintas di sekitar titik analisis (GFW event). */
export interface VesselPass {
  eventType: string;
  lat: number;
  lon: number;
  heading?: number;
  speedKnots?: number;
  /** ISO — waktu mulai lewat */
  startTime: string;
  /** ISO — waktu selesai */
  endTime: string;
  /** Jarak ke titik analisis (km) */
  distanceFromPointKm: number;
}

/** Riwayat + posisi kini + prediksi hanyut limbah satu kapal yang melintas. */
export interface VesselTrack {
  vesselId: string;
  vesselName: string;
  vesselType: string;
  flag: string;
  /** Riwayat lewat, urut waktu naik */
  passes: VesselPass[];
  /** Posisi terakhir diketahui (event terbaru) */
  current: { lat: number; lon: number; time: string; heading?: number; speedKnots?: number } | null;
  /** Prediksi hanyut limbah dari posisi kapal saat ini */
  wasteDrift: {
    bearingDeg: number;
    directionLabel: string;
    durationLabel: string;
    distanceKm: number;
    trajectory: DriftPoint[];
    destination: DriftDestination | null;
  } | null;
}

/** Pabrik sumber pencemar (statis) dalam radius analisis. */
export interface FactorySource {
  name: string;
  kind: 'kilang' | 'pltu' | 'kawasan-industri' | 'smelter';
  lat: number;
  lon: number;
  /** Jarak ke titik analisis (km) */
  distanceKm: number;
  /** Arah pabrik dari titik analisis (kardinal) */
  direction: string;
  wasteForms: string[];
  /** Prediksi hanyut limbah dari muara/pantai terdekat pabrik (null jika jauh dari pantai) */
  drift: {
    bearingDeg: number;
    directionLabel: string;
    durationLabel: string;
    distanceKm: number;
    trajectory: DriftPoint[];
    destination: DriftDestination | null;
  } | null;
}

export interface ArusPencemaranRequest {
  regionName: string;
  originLat: number;
  originLon: number;
  spillRadiusKm?: number;
  wasteForm?: string;
  /** Sertakan analisis kandidat kapal industri dari GFW di sekitar titik (default true) */
  includeVesselAnalysis?: boolean;
  /** Jenis analisis: titik buangan (default) | kapal melintas | pabrik */
  mode?: ArusAnalysisMode;
  /** Radius pemindaian kapal/pabrik (km), dipakai saat mode kapal/pabrik */
  radiusKm?: number;
  /** Horizon prediksi rute kapal (hari), dipakai saat mode kapal */
  forecastDays?: number;
  /** Jendela riwayat kapal (hari), dipakai saat mode kapal */
  historyDays?: number;
}

/** Kandidat kapal industri (GFW) yang berpotensi membuang limbah di perairan. */
export interface VesselWasteCandidate {
  vesselId: string;
  vesselName: string;
  vesselType: string;
  flag: string;
  lat: number;
  lon: number;
  speedKnots?: number;
  heading?: number;
  eventType: string;
  startTime?: string;
  endTime?: string;
  /** Jarak dari titik buangan/analisis (km) */
  distanceFromOriginKm: number;
  likelihood: 'tinggi' | 'sedang' | 'rendah';
  /** Alasan penilaian (loitering lambat, tipe tanker, dst.) */
  reason: string;
  /** Bentuk limbah yang kemungkinan dibuang kapal ini */
  wasteForms: string[];
  /** Simulasi drift limbah dari posisi kapal */
  predicted: {
    bearingDeg: number;
    directionLabel: string;
    durationHours: number;
    durationLabel: string;
    distanceKm: number;
    trajectory: DriftPoint[];
    destination: DriftDestination | null;
  };
}

export interface ArusPencemaranResult {
  locationName: string;
  analysisTimestamp: string;
  origin: { lat: number; lon: number };
  spillRadiusKm?: number;
  wasteForm?: string;
  /** Jenis analisis yang dijalankan */
  mode?: ArusAnalysisMode;
  /** Radius pemindaian kapal/pabrik (km) */
  radiusKm?: number;
  /** Jendela riwayat kapal (hari) */
  historyDays?: number;
  /** Horizon prediksi rute kapal (hari) */
  forecastDays?: number;
  /** Arus di titik buangan */
  currentAtOrigin: CurrentVector | null;
  /** Lintasan simulasi (titik 0 = origin) */
  trajectory: DriftPoint[];
  destination: DriftDestination | null;
  /** Kandidat kapal industri (GFW) di sekitar titik buangan */
  vesselCandidates: VesselWasteCandidate[];
  /** Riwayat + posisi + prediksi rute kapal yang melintas (mode kapal) */
  vesselTracks?: VesselTrack[];
  /** Pabrik sumber pencemar dalam radius (mode pabrik) */
  factorySources?: FactorySource[];
  /** Arah gerak rata-rata limbah (kardinal, mis. "Tenggara") */
  directionLabel: string;
  bearingDeg: number;
  /** Kecepatan rata-rata lintasan (knots) */
  avgSpeedKnots: number;
  /** Jarak lurus origin → titik akhir (km) */
  straightDistanceKm: number;
  /** Jarak tempuh kumulatif lintasan (km) */
  totalDistanceKm: number;
  durationHours: number;
  /** Durasi dalam teks, mis. "3 hari 4 jam" */
  durationLabel: string;
  summary: string;
  recommendations: string[];
  dataSources: string[];
}
