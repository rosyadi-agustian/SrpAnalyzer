import { SurveyStation, TrajectoryPoint } from '../types';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/**
 * Calculates 3D Well Trajectory using Minimum Curvature Method (MCM)
 * as defined in SPE / API standards and Lufkin/Gibbs deviated well paper.
 */
export function calculateMCMTrajectory(stations: SurveyStation[]): TrajectoryPoint[] {
  if (!stations || stations.length === 0) {
    return [{ md: 0, tvd: 0, north: 0, east: 0, inc: 0, azim: 0, dls: 0, doglegAngleRad: 0 }];
  }

  const result: TrajectoryPoint[] = [];

  // Station 0
  const st0 = stations[0];
  result.push({
    md: st0.md,
    tvd: 0,
    north: 0,
    east: 0,
    inc: st0.inc,
    azim: st0.azim,
    dls: 0,
    doglegAngleRad: 0
  });

  let curTVD = 0;
  let curNorth = 0;
  let curEast = 0;

  for (let i = 1; i < stations.length; i++) {
    const s1 = stations[i - 1];
    const s2 = stations[i];
    const dMD = s2.md - s1.md;

    if (dMD <= 0) continue;

    const a1 = s1.inc * DEG_TO_RAD;
    const a2 = s2.inc * DEG_TO_RAD;
    const p1 = s1.azim * DEG_TO_RAD;
    const p2 = s2.azim * DEG_TO_RAD;

    // Minimum Curvature Subtended Angle (beta)
    // cos(beta) = cos(a2 - a1) - sin(a1) * sin(a2) * (1 - cos(p2 - p1))
    // Alternatively: cos(beta) = cos(a1)*cos(a2) + sin(a1)*sin(a2)*cos(p2 - p1)
    let cosBeta = Math.cos(a2 - a1) - Math.sin(a1) * Math.sin(a2) * (1 - Math.cos(p2 - p1));
    cosBeta = Math.max(-1, Math.min(1, cosBeta));
    const beta = Math.acos(cosBeta);

    let rf = 1.0;
    if (beta > 1e-6) {
      rf = (2 / beta) * Math.tan(beta / 2);
    }

    // Dogleg Severity (deg / 100 ft)
    const dls = (beta * RAD_TO_DEG) * (100 / dMD);

    const dTVD = (dMD / 2) * (Math.cos(a1) + Math.cos(a2)) * rf;
    const dNorth = (dMD / 2) * (Math.sin(a1) * Math.cos(p1) + Math.sin(a2) * Math.cos(p2)) * rf;
    const dEast = (dMD / 2) * (Math.sin(a1) * Math.sin(p1) + Math.sin(a2) * Math.sin(p2)) * rf;

    curTVD += dTVD;
    curNorth += dNorth;
    curEast += dEast;

    result.push({
      md: s2.md,
      tvd: curTVD,
      north: curNorth,
      east: curEast,
      inc: s2.inc,
      azim: s2.azim,
      dls: dls,
      doglegAngleRad: beta
    });
  }

  return result;
}

export interface SegmentGeometry {
  md: number;
  tvd: number;
  incDeg: number;
  incRad: number;
  azimDeg: number;
  azimRad: number;
  dlsDegPer100Ft: number;
  deltaIncRad: number;     // change in inclination over dx
  deltaAzimRad: number;    // change in azimuth over dx
  deltaThetaRad: number;   // total 3D curvature angle beta over dx
  cosInc: number;
  sinInc: number;
}

/**
 * Samples the trajectory at discrete rod depth points, calculating
 * inclination, 3D dogleg, and curvature rates for the wave equation.
 */
export function sampleTrajectoryAtDepths(
  traj: TrajectoryPoint[],
  depths: number[]
): SegmentGeometry[] {
  if (traj.length === 0) {
    return depths.map(d => ({
      md: d,
      tvd: d,
      incDeg: 0,
      incRad: 0,
      azimDeg: 0,
      azimRad: 0,
      dlsDegPer100Ft: 0,
      deltaIncRad: 0,
      deltaAzimRad: 0,
      deltaThetaRad: 0,
      cosInc: 1,
      sinInc: 0
    }));
  }

  return depths.map((d, idx) => {
    // Find enclosing stations
    let s0 = traj[0];
    let s1 = traj[traj.length - 1];

    if (d <= traj[0].md) {
      s0 = traj[0];
      s1 = traj.length > 1 ? traj[1] : traj[0];
    } else if (d >= traj[traj.length - 1].md) {
      s0 = traj.length > 1 ? traj[traj.length - 2] : traj[0];
      s1 = traj[traj.length - 1];
    } else {
      for (let i = 0; i < traj.length - 1; i++) {
        if (d >= traj[i].md && d <= traj[i + 1].md) {
          s0 = traj[i];
          s1 = traj[i + 1];
          break;
        }
      }
    }

    const span = s1.md - s0.md;
    const frac = span > 1e-5 ? (d - s0.md) / span : 0;
    const clampedFrac = Math.max(0, Math.min(1, frac));

    const incDeg = s0.inc + (s1.inc - s0.inc) * clampedFrac;
    const azimDeg = s0.azim + (s1.azim - s0.azim) * clampedFrac;
    const tvd = s0.tvd + (s1.tvd - s0.tvd) * clampedFrac;
    const dls = s1.dls;

    const incRad = incDeg * DEG_TO_RAD;
    const azimRad = azimDeg * DEG_TO_RAD;

    // Segment dx estimation
    let dx = 100;
    if (depths.length > 1) {
      if (idx === 0) dx = depths[1] - depths[0];
      else if (idx === depths.length - 1) dx = depths[idx] - depths[idx - 1];
      else dx = (depths[idx + 1] - depths[idx - 1]) / 2;
    }
    dx = Math.max(1, dx);

    // Rate of inclination and azimuth change over segment length dx
    const dIncStation = (s1.inc - s0.inc) * DEG_TO_RAD;
    const dAzimStation = (s1.azim - s0.azim) * DEG_TO_RAD;
    const rateInc = span > 1e-5 ? dIncStation / span : 0;
    const rateAzim = span > 1e-5 ? dAzimStation / span : 0;

    const deltaIncRad = rateInc * dx;
    const deltaAzimRad = rateAzim * dx;

    // 3D angle change: beta = DLS * (pi/180) * (dx / 100)
    const deltaThetaRad = (dls * DEG_TO_RAD * dx) / 100;

    return {
      md: d,
      tvd: tvd,
      incDeg: incDeg,
      incRad: incRad,
      azimDeg: azimDeg,
      azimRad: azimRad,
      dlsDegPer100Ft: dls,
      deltaIncRad: deltaIncRad,
      deltaAzimRad: deltaAzimRad,
      deltaThetaRad: deltaThetaRad,
      cosInc: Math.cos(incRad),
      sinInc: Math.sin(incRad)
    };
  });
}
