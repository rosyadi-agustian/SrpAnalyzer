export interface SurveyStation {
  md: number;        // Measured Depth (ft)
  inc: number;       // Inclination (degrees)
  azim: number;      // Azimuth (degrees)
  tvd?: number;      // True Vertical Depth (ft)
  north?: number;    // Northing offset (ft)
  east?: number;     // Easting offset (ft)
  dls?: number;      // Dogleg Severity (deg / 100 ft)
}

export interface TrajectoryPoint {
  md: number;
  tvd: number;
  north: number;
  east: number;
  inc: number;       // degrees
  azim: number;      // degrees
  dls: number;       // deg / 100 ft
  doglegAngleRad: number; // beta radians over segment
}

export interface RodDefinition {
  label: string;
  dia: number;       // inches (OD)
  area: number;      // in^2
  wt: number;        // lb/ft
  momentOfInertia: number; // in^4 (pi * d^4 / 64)
}

export interface TubingDefinition {
  label: string;
  od: number;        // in
  id: number;        // in
  area: number;      // steel area in^2
}

export interface PumpingUnitDefinition {
  id: string;
  type: 'Conventional' | 'Mark II' | 'Air Balanced';
  gearbox: number;   // in-lb rating
  struct: number;    // lb rating
  stroke: number;    // max stroke (in)
  taTc: number;      // default torque adjustment
}

export interface RodGradeDefinition {
  id: string;
  label: string;
  tensile: number;   // psi
}

export interface TaperConfig {
  sizeIndex: number;
  pct: number;
}

export interface SectionSummary {
  label: string;
  dia: number;
  pct: number;
  area: number;
  wtPerFt: number;
  lengthFt: number;
  weightLb: number;
  topMd: number;
  bottomMd: number;
}

export interface BucklingAnalysisResult {
  status: 'NO BUCKLING' | 'SINUSOIDAL' | 'HELICAL';
  hasBuckling: boolean;
  bucklingDepthRanges: Array<{ topMd: number; bottomMd: number; type: 'SINUSOIDAL' | 'HELICAL' }>;
  neutralPointDepth: number; // ft
  maxCompression: number;    // lb
  maxCompressionDepth: number; // ft
  criticalSinAtMaxComp: number;
  criticalHelAtMaxComp: number;
  profiles: Array<{
    md: number;
    tvd: number;
    inc: number;
    axialLoadPeakDown: number;  // lb (negative for compression)
    axialLoadPeakUp: number;    // lb (tension)
    compressionMag: number;     // |Faxial| if Faxial < 0, else 0
    fCritSin: number;           // lb
    fCritHel: number;           // lb
    fnUp: number;               // lb/ft (normal force)
    fnDown: number;             // lb/ft
    fDragUp: number;            // lb per segment dx
    fDragDown: number;          // lb per segment dx
    isSinusoidal: boolean;
    isHelical: boolean;
  }>;
}

export interface SimulationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  notes: string[];
  main: {
    PPRL: number;
    MPRL: number;
    PT: number;
    PRHP: number;
    Sp: number;
    PD: number;
    CBM: number;
    CBE: number;
    goodmanUtil: number;
    sMax: number;
    Sa: number;
    maxDragUp: number;
    maxDragDown: number;
    maxSideLoad: number;
  };
  buckling: BucklingAnalysisResult;
  trajectory: TrajectoryPoint[];
  cards: {
    ts: number[];
    pr: number[];
    us: number[];
    up: number[];
    fp: number[];
    S: number;
  };
  params: Array<[string, number, string]>;
  checks: Array<{
    status: 'ok' | 'warn' | 'fail';
    title: string;
    text: string;
    util?: number;
  }>;
  mills: {
    PPRL: number;
    MPRL: number;
    alpha: number;
  };
}
