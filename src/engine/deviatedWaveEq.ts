import {
  RodDefinition,
  TubingDefinition,
  PumpingUnitDefinition,
  RodGradeDefinition,
  TaperConfig,
  SectionSummary,
  SimulationResult,
  TrajectoryPoint,
  BucklingAnalysisResult
} from '../types';
import { sampleTrajectoryAtDepths, SegmentGeometry } from './mcmTrajectory';
import { RODS, TUBING, UNITS, GRADES } from '../data/defaultData';

export const E_STEEL = 30.0e6;       // psi
export const V_WAVE_IN = 196000.0;   // in/s (16,333 ft/s)
export const GC = 386.09;            // in/s^2

export interface EngineInputs {
  pumpDepth: number;         // ft
  fluidLevel: number;        // ft
  pumpedOff: boolean;
  plungerDia: number;        // in
  fluidSG: number;           // dimensionless
  strokeLength: number;      // in
  pumpingSpeed: number;      // spm
  tubingIndex: number;
  tubingIdOverride?: number; // in
  tubingAnchored: 'anchored' | 'unanchored';
  tapers: TaperConfig[];
  unitId: string;
  taTc: number;
  gradeIndex: number;
  serviceFactor: number;
  damping: number;
  muUp: number;              // upstroke friction coeff (default 0.20)
  muDown: number;            // downstroke friction coeff (default 0.20)
  trajectory: TrajectoryPoint[];
}

export function computeRodProperties(tapers: TaperConfig[], depthFt: number) {
  let Ar = 0;
  let wrSum = 0;
  const sections: SectionSummary[] = [];

  let currentTop = 0;
  for (let i = 0; i < tapers.length; i++) {
    const r = RODS[tapers[i].sizeIndex] || RODS[0];
    const frac = tapers[i].pct / 100;
    const len = frac * depthFt;
    Ar += frac * r.area;
    wrSum += frac * r.wt;
    const bottom = currentTop + len;

    sections.push({
      label: r.label,
      dia: r.dia,
      pct: tapers[i].pct,
      area: r.area,
      wtPerFt: r.wt,
      lengthFt: len,
      weightLb: len * r.wt,
      topMd: currentTop,
      bottomMd: bottom
    });
    currentTop = bottom;
  }

  const Wr = wrSum * depthFt;
  return { Ar, Wr, sections };
}

export function computeFluidLoad(plungerDia: number, sg: number, fluidLevelFt: number) {
  const Ap = (Math.PI / 4) * plungerDia * plungerDia;
  const G = 0.433 * sg; // psi/ft
  return { Ap, G, Fo: Ap * G * fluidLevelFt };
}

/**
 * Frequency Factor Fc (API RP 11L)
 */
export function computeFrequencyFactor(tapers: TaperConfig[], atOverAp: number) {
  const mix = [0, 0, 0, 0, 0];
  for (let i = 0; i < tapers.length; i++) {
    const idx = tapers[i].sizeIndex;
    if (idx >= 0 && idx < 5) mix[idx] += tapers[i].pct;
  }

  // Weight coefficient calculation
  const FC_SINGLE = [0.010, 0.010, 0.015, 0.020, 0.025];
  let coef = 0;
  for (let q = 0; q < 5; q++) {
    coef += (mix[q] / 100) * FC_SINGLE[q];
  }
  return { Fc: 1 + coef * atOverAp, coef };
}

/**
 * Idealized four-bar linkage kinematics
 */
export function buildFourBar(S: number) {
  const R = S / 2;
  const a1 = 1.30 * S;
  const a2 = 2.20 * S;
  const P = 2.00 * S;

  function solveDelta(phi: number, K: number, guess = 0) {
    let d = guess;
    for (let it = 0; it < 40; it++) {
      const F =
        a1 * a1 +
        R * R +
        K * K +
        2 * a1 * R * Math.sin(d - phi) +
        2 * K * a1 * Math.sin(d) +
        2 * K * R * Math.cos(phi) -
        P * P;
      const Fd = 2 * a1 * R * Math.cos(d - phi) + 2 * K * a1 * Math.cos(d);
      if (Math.abs(Fd) < 1e-9) break;
      const step = F / Fd;
      d -= step;
      if (d > 1.2) d = 1.2;
      if (d < -1.2) d = -1.2;
      if (Math.abs(step) < 1e-12) break;
    }
    return d;
  }

  function strokeForK(K: number) {
    const N = 180;
    const dPhi = (2 * Math.PI) / N;
    let sMin = Infinity;
    let sMax = -Infinity;
    let delta = 0;
    for (let i = 0; i <= N; i++) {
      const phi = i * dPhi;
      delta = solveDelta(phi, K, delta);
      const s = a2 * Math.sin(delta);
      if (s < sMin) sMin = s;
      if (s > sMax) sMax = s;
    }
    return sMax - sMin;
  }

  let klo = 0.3 * S;
  let khi = 4.0 * S;
  for (let b = 0; b < 40; b++) {
    const kmid = 0.5 * (klo + khi);
    if (strokeForK(kmid) > S) klo = kmid;
    else khi = kmid;
  }
  const K = 0.5 * (klo + khi);

  const N = 360;
  const dPhi = (2 * Math.PI) / N;
  const phis: number[] = [];
  const ss: number[] = [];
  const tfs: number[] = [];
  let delta = 0;

  for (let p = 0; p <= N; p++) {
    const phi2 = p * dPhi;
    delta = solveDelta(phi2, K, delta);
    const sv = a2 * Math.sin(delta);
    const dsdd = a2 * Math.cos(delta);
    const Fd = 2 * a1 * R * Math.cos(delta - phi2) + 2 * K * a1 * Math.cos(delta);
    const Fphi = -2 * a1 * R * Math.cos(delta - phi2) - 2 * K * R * Math.sin(phi2);
    const ddphi = Math.abs(Fd) > 1e-9 ? -Fphi / Fd : 0;
    const tf = dsdd * ddphi;
    phis.push(phi2);
    ss.push(sv);
    tfs.push(tf);
  }

  let iMin = 0;
  let iMax = 0;
  for (let q2 = 1; q2 <= N; q2++) {
    if (ss[q2] < ss[iMin]) iMin = q2;
    if (ss[q2] > ss[iMax]) iMax = q2;
  }

  const sShift = ss[iMin];
  for (let z = 0; z <= N; z++) ss[z] -= sShift;

  return { phis, ss, tfs, K, R, a1, a2, P, iMin, iMax };
}

function phiFromPosition(fb: ReturnType<typeof buildFourBar>, sTarget: number, rising: boolean) {
  const N = fb.ss.length - 1;
  const start = rising ? fb.iMin : fb.iMax;
  let end = rising ? fb.iMax : fb.iMin;
  if (end <= start) end += N;

  let prevIdx = start;
  for (let i = start + 1; i <= end; i++) {
    const v = fb.ss[i % N];
    const crossed = rising ? v >= sTarget : v <= sTarget;
    if (crossed) {
      const v0 = fb.ss[prevIdx % N];
      const v1 = v;
      const fr = v1 !== v0 ? (sTarget - v0) / (v1 - v0) : 0;
      const idx = prevIdx + Math.max(0, Math.min(1, fr));
      return (idx % N) * ((2 * Math.PI) / N);
    }
    prevIdx = i;
  }
  return (end % N) * ((2 * Math.PI) / N);
}

export function computeTorqueAnalysis(
  sol: { pr: number[]; us: number[] },
  S: number,
  taTc: number
) {
  const fb = buildFourBar(S);
  const n = sol.pr.length;
  const tfAt: number[] = [];

  for (let i = 0; i < n; i++) {
    const sPos = sol.us[i];
    const iPrev = Math.max(0, i - 1);
    const iNext = Math.min(n - 1, i + 1);
    const rising = sol.us[iNext] - sol.us[iPrev] >= 0;
    const phi = phiFromPosition(fb, sPos, rising);
    const idx = (phi / (2 * Math.PI)) * (fb.tfs.length - 1);
    const i0 = Math.floor(idx);
    const i1 = Math.min(i0 + 1, fb.tfs.length - 1);
    const fr = idx - i0;
    tfAt.push(fb.tfs[i0] * (1 - fr) + fb.tfs[i1] * fr);
  }

  function peaks(cb: number) {
    let pu = -Infinity;
    let pd = -Infinity;
    for (let k = 0; k < n; k++) {
      const tau = (sol.pr[k] - cb) * tfAt[k];
      if (tau > pu) pu = tau;
      if (-tau > pd) pd = -tau;
    }
    return { up: pu, down: pd };
  }

  const cbMax = Math.max(...sol.pr);
  let gPrev = peaks(0).up - peaks(0).down;
  let lo = 0;
  let hi = cbMax;
  let found = false;
  const steps = 80;

  for (let s2 = 1; s2 <= steps; s2++) {
    const cbTry = (cbMax * s2) / steps;
    const gTry = peaks(cbTry).up - peaks(cbTry).down;
    if (gPrev > 0 && gTry <= 0) {
      lo = (cbMax * (s2 - 1)) / steps;
      hi = cbTry;
      found = true;
      break;
    }
    gPrev = gTry;
  }
  if (!found) {
    lo = cbMax;
    hi = cbMax;
  }

  for (let b2 = 0; b2 < 30 && found; b2++) {
    const mid = 0.5 * (lo + hi);
    const pk = peaks(mid);
    if (pk.up > pk.down) lo = mid;
    else hi = mid;
  }

  const CB = 0.5 * (lo + hi);
  const pkFinal = peaks(CB);
  const PTideal = Math.max(pkFinal.up, pkFinal.down);
  const tfPk = Math.max(...tfAt);

  return {
    PT: PTideal * taTc,
    CBM: CB * tfPk * taTc,
    CBEeq: CB,
    tfPeak: tfPk
  };
}

/**
 * Solves the Deviated Damped Wave Equation with 3D Wellbore Friction & Buckling Analysis
 *
 * Governing Equation:
 * rho * A * d^2u/dt^2 = E * A * d^2u/dx^2 - c * rho * A * du/dt + w_r * cos(alpha) - sgn(du/dt) * mu * f_n(x, T)
 */
export function solveDeviatedWaveEquation(inp: EngineInputs): {
  sol: {
    ts: number[];
    pr: number[];
    us: number[];
    up: number[];
    fp: number[];
    PPRL: number;
    MPRL: number;
    SpRods: number;
  };
  buckling: BucklingAnalysisResult;
  maxDragUp: number;
  maxDragDown: number;
  maxSideLoad: number;
} {
  const L = inp.pumpDepth;
  const Lin = L * 12; // inches
  const M = Math.max(40, Math.min(100, Math.round(L / 80))); // segment count
  const dxIn = Lin / M;
  const dxFt = L / M;
  const dt = (0.75 * dxIn) / V_WAVE_IN; // CFL stability

  const omega = (2 * Math.PI * inp.pumpingSpeed) / 60;
  const cycleT = (2 * Math.PI) / omega;
  const stepsPerCycle = Math.max(40, Math.ceil(cycleT / dt));
  const nCycles = Math.min(60, Math.max(10, Math.ceil(25 / cycleT)));
  const totalSteps = stepsPerCycle * nCycles;

  // Tubing inner diameter
  const defaultTub = TUBING[inp.tubingIndex] || TUBING[1];
  const tubingID = inp.tubingIdOverride && inp.tubingIdOverride > 0 ? inp.tubingIdOverride : defaultTub.id;

  // Segment depths (ft)
  const nodeDepthsFt = Array.from({ length: M + 1 }, (_, i) => i * dxFt);
  const segDepthsFt = Array.from({ length: M }, (_, i) => (i + 0.5) * dxFt);

  // Sample trajectory geometry at segment midpoints
  const segGeom: SegmentGeometry[] = sampleTrajectoryAtDepths(inp.trajectory, segDepthsFt);

  // Rod properties along string
  const rp = computeRodProperties(inp.tapers, L);

  // Segment properties
  const segAreas = new Float64Array(M);
  const segDia = new Float64Array(M);
  const segWtAir = new Float64Array(M);
  const segMomentOfInertia = new Float64Array(M);
  const segRadialClearance = new Float64Array(M);
  const segWrFluid = new Float64Array(M); // lb/ft buoyant

  for (let i = 0; i < M; i++) {
    const depth = segDepthsFt[i];
    let sec = rp.sections[rp.sections.length - 1];
    for (const s of rp.sections) {
      if (depth <= s.bottomMd) {
        sec = s;
        break;
      }
    }
    segAreas[i] = sec.area;
    segDia[i] = sec.dia;
    segWtAir[i] = sec.wtPerFt;
    segMomentOfInertia[i] = (Math.PI * Math.pow(sec.dia, 4)) / 64;
    segRadialClearance[i] = Math.max(0.1, (tubingID - sec.dia) / 2);
    // Buoyant weight per foot
    segWrFluid[i] = sec.wtPerFt * (1 - 0.128 * inp.fluidSG);
  }

  // Node mass (lb*s^2/in)
  const rhoM = E_STEEL / (V_WAVE_IN * V_WAVE_IN);
  const m = new Float64Array(M + 1);
  for (let i = 1; i < M; i++) {
    m[i] = rhoM * dxIn * ((segAreas[i - 1] + segAreas[i]) / 2);
  }
  // Plunger mass at node M
  m[M] = 1.5;

  // Axial gravity body force per node: w_r * cos(alpha) * dx (downward along hole)
  const fgravAxial = new Float64Array(M + 1);
  for (let i = 1; i < M; i++) {
    const wAvg = (segWrFluid[i - 1] + segWrFluid[i]) / 2; // lb/ft
    const cosAvg = (segGeom[i - 1].cosInc + segGeom[i].cosInc) / 2;
    fgravAxial[i] = (wAvg / 12) * cosAvg * dxIn; // lb downward along axis
  }

  // State variables
  const u = new Float64Array(M + 1);
  const vel = new Float64Array(M + 1);
  const acc = new Float64Array(M + 1);

  // Initial displacement profile under static tension
  // Top: 0; bottom stretches under submerged rod weight
  for (let i = 1; i <= M; i++) {
    u[i] = 0;
    vel[i] = 0;
  }

  // Fluid load valve model
  const fl = computeFluidLoad(inp.plungerDia, inp.fluidSG, inp.pumpedOff ? L : inp.fluidLevel);
  const Fo = fl.Fo;
  const tauF = Math.max(0.05, 0.08 * cycleT);
  const deltaSw = Math.max(0.5, 0.03 * inp.strokeLength);
  let loaded = false;
  let xLow = 0;
  let xHigh = 0;
  let Fp = 0;

  const samplesWanted = 240;
  const sampleEvery = Math.max(1, Math.floor(stepsPerCycle / samplesWanted));
  const lastStart = (nCycles - 1) * stepsPerCycle;

  const ts: number[] = [];
  const pr: number[] = [];
  const us: number[] = [];
  const up: number[] = [];
  const fp: number[] = [];

  // Track dynamic loads across space & time during the final cycle
  // For buckling analysis and drag load distribution
  const peakDownAxialLoad = new Float64Array(M);
  peakDownAxialLoad.fill(Infinity); // we want minimum (most compressive, negative)
  const peakUpAxialLoad = new Float64Array(M);
  peakUpAxialLoad.fill(-Infinity);

  const maxNormalForceUp = new Float64Array(M);
  const maxNormalForceDown = new Float64Array(M);
  const maxDragForceUp = new Float64Array(M);
  const maxDragForceDown = new Float64Array(M);

  // Time stepping
  for (let step = 0; step < totalSteps; step++) {
    const t = step * dt;

    // Surface stroke kinematics
    u[0] = (inp.strokeLength / 2) * (1 - Math.cos(omega * t));
    vel[0] = (inp.strokeLength / 2) * omega * Math.sin(omega * t);

    // Pump valve latching logic
    if (!loaded) {
      if (u[M] < xLow) xLow = u[M];
      if (u[M] - xLow > deltaSw) {
        loaded = true;
        xHigh = u[M];
      }
    } else {
      if (u[M] > xHigh) xHigh = u[M];
      if (xHigh - u[M] > deltaSw) {
        loaded = false;
        xLow = u[M];
      }
    }
    const targetFp = loaded ? Fo : 0;
    Fp += (targetFp - Fp) * Math.min(1, dt / tauF);

    const isFinalCycle = step >= lastStart;

    // Compute internal tensions and normal contact forces per segment
    // Segment i lies between node i and node i+1
    const segTension = new Float64Array(M);
    for (let i = 0; i < M; i++) {
      // Axial force: T = E * A * du/dx
      // In internal coords: u[i] is shallower, u[i+1] is deeper
      // When rod is stretched, u[i] - u[i+1] < 0 (bottom moves down)
      // Standard tension: T = E*A * (u[i] - u[i+1]) / dxIn
      segTension[i] = (E_STEEL * segAreas[i] * (u[i] - u[i + 1])) / dxIn;
    }

    // Interior nodes acceleration
    for (let n = 1; n < M; n++) {
      const Tup = segTension[n - 1]; // tension pulling node n upward towards node n-1
      const Tdn = segTension[n];     // tension pulling node n downward towards node n+1

      // Average segment properties around node n
      const g = segGeom[n];
      const wrFluid = (segWrFluid[n - 1] + segWrFluid[n]) / 2; // lb/ft
      const vNode = vel[n];

      // Axial Tension magnitude for normal force calculation
      const Tmag = Math.max(0, (Tup + Tdn) / 2);

      // Normal Contact Force per unit length:
      // f_n = sqrt[ (T * dTheta * sin(alpha))^2 + (w_r * sin(alpha) + T * dAlpha)^2 ]
      // with dTheta and dAlpha per unit foot
      const dThetaPerFt = (g.dlsDegPer100Ft * (Math.PI / 180)) / 100;
      const dAlphaPerFt = g.deltaIncRad / dxFt;

      const term1 = Tmag * dThetaPerFt * g.sinInc;
      const term2 = wrFluid * g.sinInc + Tmag * dAlphaPerFt;
      const fn = Math.sqrt(term1 * term1 + term2 * term2); // lb/ft

      const isUpstroke = vNode > 0;
      const mu = isUpstroke ? inp.muUp : inp.muDown;
      const Fdrag = mu * fn * dxFt; // total drag force on segment around node (lb)

      // Drag opposes velocity: -sgn(v) * Fdrag
      let fDragSigned = 0;
      if (Math.abs(vNode) > 1e-4) {
        fDragSigned = -(vNode > 0 ? 1 : -1) * Fdrag;
      }

      // Acceleration: (Tup - Tdn + fgravAxial + fDragSigned) / m[n] - c * vel[n]
      acc[n] = (Tup - Tdn - fgravAxial[n] + fDragSigned) / m[n] - inp.damping * vel[n];

      if (isFinalCycle) {
        if (isUpstroke) {
          if (fn > maxNormalForceUp[n]) maxNormalForceUp[n] = fn;
          if (Fdrag > maxDragForceUp[n]) maxDragForceUp[n] = Fdrag;
        } else {
          if (fn > maxNormalForceDown[n]) maxNormalForceDown[n] = fn;
          if (Fdrag > maxDragForceDown[n]) maxDragForceDown[n] = Fdrag;
        }
      }
    }

    // Node M (Pump)
    const TM1 = segTension[M - 1];
    acc[M] = (TM1 - Fp) / m[M] - inp.damping * vel[M];

    // Integrate velocity and displacement
    for (let q = 1; q <= M; q++) {
      vel[q] += acc[q] * dt;
      // Clamp extreme numerical surges if any
      if (vel[q] > 3000) vel[q] = 3000;
      if (vel[q] < -3000) vel[q] = -3000;
    }
    for (let w = 1; w <= M; w++) {
      u[w] += vel[w] * dt;
    }

    // Record data during the final cycle
    if (isFinalCycle) {
      // Track axial load profiles along all segments
      for (let i = 0; i < M; i++) {
        const axialLoad = segTension[i]; // positive = tension, negative = compression
        if (axialLoad < peakDownAxialLoad[i]) {
          peakDownAxialLoad[i] = axialLoad;
        }
        if (axialLoad > peakUpAxialLoad[i]) {
          peakUpAxialLoad[i] = axialLoad;
        }
      }

      if ((step - lastStart) % sampleEvery === 0) {
        const FPR = segTension[0];
        ts.push(t - lastStart * dt);
        pr.push(FPR);
        us.push(u[0]);
        up.push(u[M]);
        fp.push(Fp);
      }
    }
  }

  // Summary loads
  let PPRL = -Infinity;
  let MPRL = Infinity;
  let uMax = -Infinity;
  let uMin = Infinity;

  for (let s = 0; s < pr.length; s++) {
    if (pr[s] > PPRL) PPRL = pr[s];
    if (pr[s] < MPRL) MPRL = pr[s];
    if (up[s] > uMax) uMax = up[s];
    if (up[s] < uMin) uMin = up[s];
  }

  // Buckling Analysis (Paslay-Bogy / Lubinski / Gibbs criteria)
  // Sinusoidal: F_crit,sin = 2 * sqrt( E * I * w_r * sin(alpha) / r_clr )
  // Helical:    F_crit,hel = 2*sqrt(2) * sqrt( E * I * w_r * sin(alpha) / r_clr )
  const profiles: BucklingAnalysisResult['profiles'] = [];
  let neutralPointDepth = L;
  let foundNeutral = false;
  let hasSinusoidal = false;
  let hasHelical = false;
  let maxCompression = 0;
  let maxCompressionDepth = 0;
  let critSinAtMax = 0;
  let critHelAtMax = 0;

  const bucklingIntervals: Array<{ topMd: number; bottomMd: number; type: 'SINUSOIDAL' | 'HELICAL' }> = [];
  let inInterval = false;
  let currentIntervalTop = 0;
  let currentIntervalType: 'SINUSOIDAL' | 'HELICAL' = 'SINUSOIDAL';

  for (let i = 0; i < M; i++) {
    const md = segDepthsFt[i];
    const geom = segGeom[i];
    const I = segMomentOfInertia[i];
    const rClr = segRadialClearance[i]; // in
    const wrIn = segWrFluid[i] / 12;    // lb/in
    const wrFt = segWrFluid[i];         // lb/ft

    // Sinusoidal buckling critical load in inclined hole
    const sinInc = Math.max(0.001, geom.sinInc);
    // Dawson-Paslay / Paslay-Bogy formula:
    // F_crit_sin = 2 * sqrt( E * I * w_r * sin(alpha) / r_clr )
    const radicand = (E_STEEL * I * wrIn * sinInc) / rClr;
    let fCritSin = 2 * Math.sqrt(Math.max(0, radicand));

    // For vertical or near-vertical holes, transition smoothly to Lea's formula
    // F_crit_vert = 0.795 * [ E * I * (pi * w_r)^2 ]^(1/3) / 144
    const leaRadicand = E_STEEL * I * Math.pow(Math.PI * wrFt, 2);
    const fCritVert = (0.795 * Math.cbrt(leaRadicand)) / 144;
    fCritSin = Math.max(fCritSin, fCritVert);

    const fCritHel = Math.SQRT2 * fCritSin;

    const axialDown = peakDownAxialLoad[i];
    const axialUp = peakUpAxialLoad[i];
    const compMag = axialDown < 0 ? Math.abs(axialDown) : 0;

    if (compMag > maxCompression) {
      maxCompression = compMag;
      maxCompressionDepth = md;
      critSinAtMax = fCritSin;
      critHelAtMax = fCritHel;
    }

    // Neutral point detection (where downstroke axial load goes from positive to negative)
    if (!foundNeutral && axialDown < 0) {
      neutralPointDepth = md;
      foundNeutral = true;
    }

    const isHel = compMag > fCritHel;
    const isSin = compMag > fCritSin;

    if (isHel) {
      hasHelical = true;
      hasSinusoidal = true;
    } else if (isSin) {
      hasSinusoidal = true;
    }

    // Track buckling zones
    if (isSin) {
      if (!inInterval) {
        inInterval = true;
        currentIntervalTop = md - dxFt / 2;
        currentIntervalType = isHel ? 'HELICAL' : 'SINUSOIDAL';
      } else if (isHel) {
        currentIntervalType = 'HELICAL';
      }
    } else {
      if (inInterval) {
        inInterval = false;
        bucklingIntervals.push({
          topMd: Math.max(0, currentIntervalTop),
          bottomMd: md - dxFt / 2,
          type: currentIntervalType
        });
      }
    }

    profiles.push({
      md,
      tvd: geom.tvd,
      inc: geom.incDeg,
      axialLoadPeakDown: axialDown,
      axialLoadPeakUp: axialUp,
      compressionMag: compMag,
      fCritSin,
      fCritHel,
      fnUp: maxNormalForceUp[i],
      fnDown: maxNormalForceDown[i],
      fDragUp: maxDragForceUp[i],
      fDragDown: maxDragForceDown[i],
      isSinusoidal: isSin,
      isHelical: isHel
    });
  }

  if (inInterval) {
    bucklingIntervals.push({
      topMd: Math.max(0, currentIntervalTop),
      bottomMd: L,
      type: currentIntervalType
    });
  }

  let status: 'NO BUCKLING' | 'SINUSOIDAL' | 'HELICAL' = 'NO BUCKLING';
  if (hasHelical) status = 'HELICAL';
  else if (hasSinusoidal) status = 'SINUSOIDAL';

  let maxDragUp = 0;
  let maxDragDown = 0;
  let maxSideLoad = 0;

  for (let i = 0; i < M; i++) {
    if (maxDragForceUp[i] > maxDragUp) maxDragUp = maxDragForceUp[i];
    if (maxDragForceDown[i] > maxDragDown) maxDragDown = maxDragForceDown[i];
    if (maxNormalForceUp[i] > maxSideLoad) maxSideLoad = maxNormalForceUp[i];
    if (maxNormalForceDown[i] > maxSideLoad) maxSideLoad = maxNormalForceDown[i];
  }

  return {
    sol: {
      ts,
      pr,
      us,
      up,
      fp,
      PPRL,
      MPRL,
      SpRods: uMax - uMin
    },
    buckling: {
      status,
      hasBuckling: status !== 'NO BUCKLING',
      bucklingDepthRanges: bucklingIntervals,
      neutralPointDepth: foundNeutral ? neutralPointDepth : L,
      maxCompression,
      maxCompressionDepth,
      criticalSinAtMaxComp: critSinAtMax,
      criticalHelAtMaxComp: critHelAtMax,
      profiles
    },
    maxDragUp,
    maxDragDown,
    maxSideLoad
  };
}

/**
 * Full Sucker Rod Pumping Design Calculation
 * Seamlessly integrates API RP 11L worksheet + Lufkin Deviated Gibbs Wave Equation
 */
export function calculateDeviatedDesign(inp: EngineInputs): SimulationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];

  const L = inp.pumpDepth;
  const H = inp.pumpedOff ? inp.pumpDepth : inp.fluidLevel;
  const S = inp.strokeLength;
  const N = inp.pumpingSpeed;
  const sg = inp.fluidSG;
  const D = inp.plungerDia;

  if (!(L > 0)) errors.push('Pump setting depth must be positive.');
  if (H > L) errors.push('Fluid level cannot be deeper than the pump setting depth.');
  if (!(S > 0)) errors.push('Stroke length must be positive.');
  if (!(N > 0)) errors.push('Pumping speed must be positive.');
  if (!(sg > 0)) errors.push('Fluid specific gravity must be positive.');

  let taperSum = 0;
  for (const t of inp.tapers) taperSum += t.pct;
  if (inp.tapers.length === 0) errors.push('Define at least one rod taper section.');
  else if (Math.abs(taperSum - 100) > 0.5) {
    errors.push(`Rod taper percentages must total 100% (currently ${taperSum.toFixed(1)}%).`);
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      warnings,
      notes,
      main: {} as any,
      buckling: {} as any,
      trajectory: inp.trajectory,
      cards: {} as any,
      params: [],
      checks: [],
      mills: {} as any
    };
  }

  // Rod string properties
  const rp = computeRodProperties(inp.tapers, L);
  const Wr = rp.Wr;
  const Wrf = Wr * (1 - 0.128 * sg);
  const Kr = (E_STEEL * rp.Ar) / (12 * L); // lbf/in
  const SKr = S * Kr;

  // Fluid load
  const fl = computeFluidLoad(D, sg, H);
  const Fo = fl.Fo;

  // Frequency factor & dimensionless groups
  const tub = TUBING[inp.tubingIndex] || TUBING[1];
  const ff = computeFrequencyFactor(inp.tapers, tub.area / fl.Ap);
  const N0p = (245000 * Math.sqrt(ff.Fc)) / L;
  const yRatio = N / N0p;
  const xRatio = Fo / SKr;

  // Solve Deviated Wave Equation
  const sim = solveDeviatedWaveEquation(inp);
  const sol = sim.sol;
  const buckling = sim.buckling;

  // Tubing stretch correction
  let tubingStretch = 0;
  if (inp.tubingAnchored === 'unanchored') {
    tubingStretch = (Fo * L * 12) / (E_STEEL * tub.area);
  }
  const Sp = Math.max(0, sol.SpRods - tubingStretch);
  const PD = 0.1166 * D * D * Sp * N; // bbl/d

  // Gearbox torque & counterbalance
  const ta = computeTorqueAnalysis(sol, S, inp.taTc);
  const PRHP = 6.31e-6 * ta.PT * N;

  // Modified Goodman Stress Analysis
  const grade = GRADES[inp.gradeIndex] || GRADES[1];
  let Amin = rp.sections[0].area;
  for (let i = 1; i < rp.sections.length; i++) {
    if (rp.sections[i].area < Amin) Amin = rp.sections[i].area;
  }
  const sMax = sol.PPRL / Amin;
  const sMin = sol.MPRL / Amin;
  const Sa = inp.serviceFactor * (grade.tensile / 4 + 0.5625 * sMin);
  const goodmanUtil = Sa > 0 ? (sMax / Sa) * 100 : Infinity;

  // Mills closed-form check
  const alphaMills = (S * N * N) / 70500;
  const millsPPRL = Wrf + Wr * alphaMills + Fo;
  const millsMPRL = Wr * (1 - alphaMills - 0.127 * sg);

  // Equipment Checks
  const unit = inp.unitId ? UNITS.find(u => u.id === inp.unitId) : null;
  const checks: SimulationResult['checks'] = [];

  // 1. Buckling Check
  if (buckling.status === 'HELICAL') {
    checks.push({
      status: 'fail',
      title: 'Severe Buckling Risk (Helical)',
      text: `Downstroke compression (${Math.round(buckling.maxCompression)} lb at ${Math.round(buckling.maxCompressionDepth)} ft) exceeds Helical Critical Load (${Math.round(buckling.criticalHelAtMaxComp)} lb). High risk of rod helical lockup, accelerated tubing wear, and coupling failure!`
    });
  } else if (buckling.status === 'SINUSOIDAL') {
    checks.push({
      status: 'warn',
      title: 'Moderate Buckling Risk (Sinusoidal)',
      text: `Downstroke compression (${Math.round(buckling.maxCompression)} lb at ${Math.round(buckling.maxCompressionDepth)} ft) exceeds Sinusoidal Critical Load (${Math.round(buckling.criticalSinAtMaxComp)} lb). Sinker bars or rod guides recommended in the buckling interval.`
    });
  } else {
    checks.push({
      status: 'ok',
      title: 'Buckling Stability',
      text: 'No buckling detected along the entire rod string. Downstroke axial forces remain within safe critical Euler thresholds.'
    });
  }

  // 2. Rod Fatigue
  checks.push({
    status: goodmanUtil > 100 ? 'fail' : goodmanUtil > 80 ? 'warn' : 'ok',
    title: 'Rod Fatigue (Modified Goodman)',
    text: `Peak stress ${(sMax / 1000).toFixed(1)} ksi vs allowable ${(Sa / 1000).toFixed(1)} ksi — utilization ${goodmanUtil.toFixed(0)}%`,
    util: Math.min(goodmanUtil, 120)
  });

  // 3. Unit Ratings
  if (unit) {
    const structUtil = (sol.PPRL / unit.struct) * 100;
    checks.push({
      status: structUtil > 100 ? 'fail' : structUtil > 90 ? 'warn' : 'ok',
      title: 'Unit Structure Load',
      text: `PPRL ${Math.round(sol.PPRL).toLocaleString()} lb vs rating ${unit.struct.toLocaleString()} lb (${structUtil.toFixed(0)}%)`,
      util: structUtil
    });

    const gearUtil = (ta.PT / unit.gearbox) * 100;
    checks.push({
      status: gearUtil > 100 ? 'fail' : gearUtil > 90 ? 'warn' : 'ok',
      title: 'Gearbox Torque',
      text: `PT ${Math.round(ta.PT / 1000).toLocaleString()}k in-lb vs rating ${Math.round(unit.gearbox / 1000).toLocaleString()}k in-lb (${gearUtil.toFixed(0)}%)`,
      util: gearUtil
    });

    if (S > unit.stroke) {
      checks.push({
        status: 'fail',
        title: 'Stroke Length',
        text: `Selected unit maximum stroke is ${unit.stroke}" < requested ${S}"`
      });
    } else {
      checks.push({
        status: 'ok',
        title: 'Stroke Length',
        text: `${S}" within unit capability of ${unit.stroke}"`
      });
    }
  }

  // Dimensionless speed warning
  if (yRatio > 0.80) {
    checks.push({
      status: 'warn',
      title: "Dimensionless Speed N/N'0",
      text: `N/N'0 = ${yRatio.toFixed(2)} exceeds 0.80 — risk of high dynamic harmonics and severe resonance.`
    });
  }

  // Side load notice
  if (sim.maxSideLoad > 200) {
    notes.push(
      `Peak rod side load is ${Math.round(sim.maxSideLoad)} lb/ft in high dogleg zones. Wear guides (molded or wheeled) are recommended to mitigate tubing wear.`
    );
  }

  const params: Array<[string, number, string]> = [
    ['Average rod area Ar', rp.Ar, 'in2'],
    ['Rod weight in air Wr', Wr, 'lb'],
    ['Rod weight in fluid Wrf', Wrf, 'lb'],
    ['Rod string constant Kr', Kr, 'lb/in'],
    ['SKr (S x Kr)', SKr, 'lb'],
    ['Fluid load Fo', Fo, 'lb'],
    ['Fo / SKr', xRatio, '-'],
    ['Frequency factor Fc', ff.Fc, '-'],
    ["Natural frequency N'0", N0p, 'spm'],
    ["N / N'0", yRatio, '-'],
    ['Static rod stretch Fo/Kr', Fo / Kr, 'in'],
    ['Tubing stretch (if unanchored)', tubingStretch, 'in'],
    ['Plunger stroke Sp', Sp, 'in'],
    ['Sp / S', Sp / S, '-'],
    ['Pump displacement PD', PD, 'bbl/d'],
    ['Peak torque PT', ta.PT, 'in-lb'],
    ['Counterbalance moment', ta.CBM, 'in-lb'],
    ['Counterbalance effect (API)', 1.06 * (Wrf + Fo / 2), 'lb'],
    ['Polished rod horsepower PRHP', PRHP, 'hp'],
    ['Maximum Upstroke Drag Force', sim.maxDragUp, 'lb'],
    ['Maximum Downstroke Drag Force', sim.maxDragDown, 'lb'],
    ['Peak Contact Normal Force (fn)', sim.maxSideLoad, 'lb/ft'],
    ['Peak Downstroke Compression', buckling.maxCompression, 'lb'],
    ['Neutral Point Depth', buckling.neutralPointDepth, 'ft'],
    ['Peak rod stress', sMax, 'psi'],
    ['Min rod stress', sMin, 'psi'],
    ['Goodman allowable Sa', Sa, 'psi']
  ];

  return {
    ok: true,
    errors,
    warnings,
    notes,
    main: {
      PPRL: sol.PPRL,
      MPRL: sol.MPRL,
      PT: ta.PT,
      PRHP,
      Sp,
      PD,
      CBM: ta.CBM,
      CBE: 1.06 * (Wrf + Fo / 2),
      goodmanUtil,
      sMax,
      Sa,
      maxDragUp: sim.maxDragUp,
      maxDragDown: sim.maxDragDown,
      maxSideLoad: sim.maxSideLoad
    },
    buckling,
    trajectory: inp.trajectory,
    cards: {
      ts: sol.ts,
      pr: sol.pr,
      us: sol.us,
      up: sol.up,
      fp: sol.fp,
      S
    },
    params,
    checks,
    mills: {
      PPRL: millsPPRL,
      MPRL: millsMPRL,
      alpha: alphaMills
    }
  };
}
