import { RodDefinition, TubingDefinition, PumpingUnitDefinition, RodGradeDefinition, SurveyStation } from '../types';

export const DEFAULT_SURVEY_CSV = `MD(ft),Inclination(deg),Azimuth(deg)
0,0.0,0.0
500,0.5,15.0
1000,2.1,30.0
1500,5.8,42.0
2000,12.4,50.0
2500,21.0,53.0
3000,31.5,55.0
3500,42.0,56.0
4000,48.5,57.0
4500,52.0,58.0
5000,52.2,58.5
5500,51.8,59.0
6000,45.0,60.0
6500,32.0,62.0
7000,18.0,65.0
7500,5.0,70.0
8000,1.0,72.0`;

export const RODS: RodDefinition[] = [
  { label: '5/8"',   dia: 0.625, area: 0.3068, wt: 1.63, momentOfInertia: (Math.PI * Math.pow(0.625, 4)) / 64 },
  { label: '3/4"',   dia: 0.750, area: 0.4418, wt: 2.22, momentOfInertia: (Math.PI * Math.pow(0.750, 4)) / 64 },
  { label: '7/8"',   dia: 0.875, area: 0.6013, wt: 3.02, momentOfInertia: (Math.PI * Math.pow(0.875, 4)) / 64 },
  { label: '1"',     dia: 1.000, area: 0.7854, wt: 4.14, momentOfInertia: (Math.PI * Math.pow(1.000, 4)) / 64 },
  { label: '1-1/8"', dia: 1.125, area: 0.9940, wt: 5.25, momentOfInertia: (Math.PI * Math.pow(1.125, 4)) / 64 }
];

export const TUBING: TubingDefinition[] = [
  { label: '2-3/8"', od: 2.375, id: 1.995, area: 1.304 },
  { label: '2-7/8"', od: 2.875, id: 2.441, area: 1.812 },
  { label: '3-1/2"', od: 3.500, id: 2.992, area: 2.596 },
  { label: '4-1/2"', od: 4.500, id: 3.958, area: 4.407 }
];

export const PLUNGERS: number[] = [1.06, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25, 3.75];

export const UNITS: PumpingUnitDefinition[] = [
  { id: 'C-80D-133-64',   type: 'Conventional', gearbox: 80000,   struct: 13300, stroke: 64,  taTc: 1.00 },
  { id: 'C-114D-143-64',  type: 'Conventional', gearbox: 114000,  struct: 14300, stroke: 64,  taTc: 1.00 },
  { id: 'C-160D-173-74',  type: 'Conventional', gearbox: 160000,  struct: 17300, stroke: 74,  taTc: 1.00 },
  { id: 'C-228D-200-74',  type: 'Conventional', gearbox: 228000,  struct: 20000, stroke: 74,  taTc: 1.00 },
  { id: 'C-250D-256-100', type: 'Conventional', gearbox: 250000,  struct: 25600, stroke: 100, taTc: 1.00 },
  { id: 'C-320D-256-100', type: 'Conventional', gearbox: 320000,  struct: 25600, stroke: 100, taTc: 1.00 },
  { id: 'C-456D-305-120', type: 'Conventional', gearbox: 456000,  struct: 30500, stroke: 120, taTc: 1.00 },
  { id: 'C-640D-365-144', type: 'Conventional', gearbox: 640000,  struct: 36500, stroke: 144, taTc: 1.00 },
  { id: 'C-912D-427-168', type: 'Conventional', gearbox: 912000,  struct: 42700, stroke: 168, taTc: 1.00 },
  { id: 'C-1280D-470-192',type: 'Conventional', gearbox: 1280000, struct: 47000, stroke: 192, taTc: 1.00 },
  { id: 'M-160D-173-74',  type: 'Mark II',      gearbox: 160000,  struct: 17300, stroke: 74,  taTc: 1.25 },
  { id: 'M-228D-200-74',  type: 'Mark II',      gearbox: 228000,  struct: 20000, stroke: 74,  taTc: 1.25 },
  { id: 'M-320D-256-100', type: 'Mark II',      gearbox: 320000,  struct: 25600, stroke: 100, taTc: 1.25 },
  { id: 'M-456D-305-120', type: 'Mark II',      gearbox: 456000,  struct: 30500, stroke: 120, taTc: 1.25 },
  { id: 'M-640D-365-144', type: 'Mark II',      gearbox: 640000,  struct: 36500, stroke: 144, taTc: 1.25 },
  { id: 'A-228D-200-74',  type: 'Air Balanced', gearbox: 228000,  struct: 20000, stroke: 74,  taTc: 1.09 },
  { id: 'A-320D-256-100', type: 'Air Balanced', gearbox: 320000,  struct: 25600, stroke: 100, taTc: 1.09 },
  { id: 'A-456D-305-120', type: 'Air Balanced', gearbox: 456000,  struct: 30500, stroke: 120, taTc: 1.09 },
  { id: 'A-640D-365-144', type: 'Air Balanced', gearbox: 640000,  struct: 36500, stroke: 144, taTc: 1.09 }
];

export const GRADES: RodGradeDefinition[] = [
  { id: 'C', label: 'Grade C (carbon steel)',        tensile: 90000 },
  { id: 'D', label: 'Grade D (high-strength alloy)', tensile: 115000 },
  { id: 'K', label: 'Grade K (corrosion resistant)', tensile: 90000 }
];

export function parseSurveyCSV(csvText: string): SurveyStation[] {
  const lines = csvText.split(/\r?\n/);
  const stations: SurveyStation[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // Check if header line
    if (trimmed.toLowerCase().includes('md') || trimmed.toLowerCase().includes('depth')) {
      continue;
    }

    const parts = trimmed.split(/[,\s;\t]+/).map(p => parseFloat(p));
    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      stations.push({
        md: parts[0],
        inc: parts[1],
        azim: parts[2]
      });
    }
  }

  // Ensure sorted by MD
  stations.sort((a, b) => a.md - b.md);

  // If first station is not MD=0, prepend origin
  if (stations.length > 0 && stations[0].md > 0) {
    stations.unshift({
      md: 0,
      inc: stations[0].inc,
      azim: stations[0].azim
    });
  } else if (stations.length === 0) {
    // Default vertical station
    stations.push({ md: 0, inc: 0, azim: 0 });
    stations.push({ md: 10000, inc: 0, azim: 0 });
  }

  return stations;
}
