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
}

export interface GfwData {
  source: 'gfw';
  vesselEvents: GfwVesselEvent[];
  totalEvents: number;
}

export interface AisVessel {
  mmsi: string;
  name?: string;
  lat: number;
  lon: number;
  speed: number;
  heading: number;
  shipType?: string;
  timestamp: string;
  flag?: string;
}

export interface AisStreamData {
  source: 'aisstream';
  vessels: AisVessel[];
  totalVessels: number;
}

/** Bundle of all fetched maritime data, passed to Agent 2 */
export interface MaritimeDataBundle {
  bmkg: BmkgWeatherData | null;
  gfw: GfwData | null;
  aisstream: AisStreamData | null;
  fetchedAt: string;
  errors: string[];
}
