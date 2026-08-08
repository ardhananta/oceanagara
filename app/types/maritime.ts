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
}

/** Bundle of all fetched maritime data, passed to Agent 2 */
export interface MaritimeDataBundle {
  bmkg: BmkgWeatherData | null;
  gfw: GfwData | null;
  fetchedAt: string;
  errors: string[];
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
