import React, { useState } from 'react';
import { Activity, Upload, X, CheckCircle2 } from 'lucide-react';

interface Props {
  cards: {
    ts: number[];
    pr: number[];
    us: number[];
    up: number[];
    fp: number[];
    S: number;
  };
  strokeLength: number;
  pumpingSpeed: number;
  taTc: number;
}

interface MeasuredData {
  fileName: string;
  pos: number[];
  load: number[];
  strokeMeas: number;
  pprl: number;
  mprl: number;
  area: number;
  prhp: number;
}

export const DynamometerPlot: React.FC<Props> = ({ cards, strokeLength, pumpingSpeed, taTc }) => {
  const [measured, setMeasured] = useState<MeasuredData | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  if (!cards || !cards.pr || cards.pr.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 bg-slate-50 border border-slate-200 rounded-xl">
        Run calculation to display dynamometer cards.
      </div>
    );
  }

  const width = 640;
  const height = 340;
  const padLeft = 65;
  const padRight = 25;
  const padTop = 20;
  const padBottom = 40;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  // Find min/max for loads
  let fMin = Math.min(0, ...cards.pr, ...cards.fp);
  let fMax = Math.max(...cards.pr, ...cards.fp);

  if (measured) {
    fMin = Math.min(fMin, ...measured.load);
    fMax = Math.max(fMax, ...measured.load);
  }

  const fPad = (fMax - fMin) * 0.08 + 100;
  fMin -= fPad;
  fMax += fPad;

  // Position bounds (0 to strokeLength or plunger stroke)
  const xLo = Math.min(0, ...cards.up);
  const xHi = Math.max(strokeLength, ...cards.up, ...(measured ? [strokeLength] : [])) * 1.05;

  const getX = (pos: number) => {
    return padLeft + ((pos - xLo) / (xHi - xLo || 1)) * plotW;
  };

  const getY = (load: number) => {
    return padTop + (1 - (load - fMin) / (fMax - fMin || 1)) * plotH;
  };

  // Surface card path
  let surfPath = '';
  for (let i = 0; i < cards.pr.length; i++) {
    const px = getX(cards.us[i]);
    const py = getY(cards.pr[i]);
    surfPath += `${i === 0 ? 'M' : 'L'} ${px.toFixed(1)},${py.toFixed(1)} `;
  }
  if (cards.pr.length > 0) surfPath += 'Z';

  // Pump card path
  let pumpPath = '';
  for (let j = 0; j < cards.fp.length; j++) {
    const px = getX(cards.up[j]);
    const py = getY(cards.fp[j]);
    pumpPath += `${j === 0 ? 'M' : 'L'} ${px.toFixed(1)},${py.toFixed(1)} `;
  }
  if (cards.fp.length > 0) pumpPath += 'Z';

  // Measured card path
  let measPath = '';
  if (measured && measured.pos.length > 0) {
    for (let k = 0; k < measured.pos.length; k++) {
      const px = getX(measured.pos[k]);
      const py = getY(measured.load[k]);
      measPath += `${k === 0 ? 'M' : 'L'} ${px.toFixed(1)},${py.toFixed(1)} `;
    }
    measPath += 'Z';
  }

  const handleDynFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/);
        const pairs: Array<[number, number]> = [];

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const parts = trimmed.split(/[\s,;\t]+/).map(p => parseFloat(p));
          if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            pairs.push([parts[0], parts[1]]);
          }
        }

        if (pairs.length < 15) {
          throw new Error('File contains fewer than 15 valid (position, load) data pairs.');
        }

        const rawPos = pairs.map(p => p[0]);
        const loads = pairs.map(p => p[1]);
        const pmin = Math.min(...rawPos);
        const pmax = Math.max(...rawPos);
        const strokeMeas = pmax - pmin;

        // Normalize position onto unit stroke length
        const normPos = rawPos.map(p => (strokeMeas > 0 ? ((p - pmin) / strokeMeas) * strokeLength : p));

        const pprl = Math.max(...loads);
        const mprl = Math.min(...loads);

        // Shoelace area
        let area = 0;
        const n = normPos.length;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          area += normPos[i] * loads[j] - normPos[j] * loads[i];
        }
        area = Math.abs(area) / 2; // lb-in
        const prhp = (area * pumpingSpeed) / (12 * 33000);

        setMeasured({
          fileName: file.name,
          pos: normPos,
          load: loads,
          strokeMeas,
          pprl,
          mprl,
          area,
          prhp
        });
        setUploadError(null);
      } catch (err: any) {
        setUploadError(err.message || 'Failed to parse .dyn file.');
        setMeasured(null);
      }
    };
    reader.onerror = () => {
      setUploadError('Failed to read file.');
    };
    reader.readAsText(file);
  };

  const pprlComp = Math.max(...cards.pr);
  const mprlComp = Math.min(...cards.pr);

  return (
    <div id="card-dynamometer" className="card border border-slate-200 bg-white rounded-xl p-4 sm:p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 m-0">
            <Activity className="w-4 h-4 text-sky-700" />
            <span>Dynamometer Cards (Wave Equation Surface & Downhole Pump)</span>
          </h3>
          <p className="text-xs text-slate-500 m-0 mt-0.5">
            Dynamic polished rod tension & pump load cycle (Gibbs wave equation)
          </p>
        </div>

        {/* Upload .dyn file button */}
        <div className="flex items-center gap-2">
          {measured ? (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="truncate max-w-[120px]">{measured.fileName}</span>
              <button
                type="button"
                onClick={() => setMeasured(null)}
                className="text-emerald-900 hover:text-rose-600 ml-1 cursor-pointer"
                title="Clear measured card"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <label
              htmlFor="dyn-file-input"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>Upload .dyn / Measured Card</span>
              <input
                id="dyn-file-input"
                type="file"
                accept=".dyn,.txt,.csv"
                onChange={handleDynFileUpload}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      {uploadError && (
        <div className="mb-3 text-xs text-rose-600 bg-rose-50 p-2 rounded-md border border-rose-200">
          {uploadError}
        </div>
      )}

      {/* SVG Canvas */}
      <div className="relative overflow-hidden bg-slate-50/70 border border-slate-200 rounded-lg">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto block select-none"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Y Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const gy = padTop + pct * plotH;
            const fVal = fMax - pct * (fMax - fMin);
            return (
              <g key={`dgy-${idx}`}>
                <line
                  x1={padLeft}
                  y1={gy}
                  x2={width - padRight}
                  y2={gy}
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                />
                <text
                  x={padLeft - 8}
                  y={gy + 4}
                  textAnchor="end"
                  className="text-[10px] fill-slate-400 font-mono"
                >
                  {Math.round(fVal).toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* X Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const gx = padLeft + pct * plotW;
            const posVal = xLo + pct * (xHi - xLo);
            return (
              <g key={`dgx-${idx}`}>
                <line
                  x1={gx}
                  y1={padTop}
                  x2={gx}
                  y2={height - padBottom}
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                />
                <text
                  x={gx}
                  y={height - padBottom + 16}
                  textAnchor="middle"
                  className="text-[10px] fill-slate-400 font-mono"
                >
                  {posVal.toFixed(0)}″
                </text>
              </g>
            );
          })}

          {/* Zero load line if inside range */}
          {fMin < 0 && fMax > 0 && (
            <line
              x1={padLeft}
              y1={getY(0)}
              x2={width - padRight}
              y2={getY(0)}
              stroke="#94a3b8"
              strokeWidth="1.5"
            />
          )}

          {/* Surface Card Path */}
          <path
            d={surfPath}
            fill="#0284c7"
            fillOpacity="0.08"
            stroke="#0284c7"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {/* Downhole Pump Card Path */}
          <path
            d={pumpPath}
            fill="none"
            stroke="#e11d48"
            strokeWidth="2"
            strokeDasharray="6 3"
            strokeLinejoin="round"
          />

          {/* Measured Card Path if available */}
          {measPath && (
            <path
              d={measPath}
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          )}

          {/* Load Markers */}
          <text
            x={width - padRight - 6}
            y={getY(pprlComp) - 6}
            textAnchor="end"
            className="text-[10px] font-bold fill-sky-800"
          >
            PPRL: {Math.round(pprlComp).toLocaleString()} lb
          </text>
          <text
            x={width - padRight - 6}
            y={getY(mprlComp) + 14}
            textAnchor="end"
            className="text-[10px] font-bold fill-sky-800"
          >
            MPRL: {Math.round(mprlComp).toLocaleString()} lb
          </text>

          {/* Axis Titles */}
          <text
            x={padLeft + plotW / 2}
            y={height - 10}
            textAnchor="middle"
            className="text-[11px] fill-slate-500 font-medium"
          >
            Position (in)
          </text>
          <text
            transform={`translate(16, ${padTop + plotH / 2}) rotate(-90)`}
            textAnchor="middle"
            className="text-[11px] fill-slate-500 font-medium"
          >
            Polished Rod Load (lb)
          </text>
        </svg>
      </div>

      {/* Legend & Measured Summary */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-4 text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-1.5 bg-sky-600 inline-block rounded-xs"></span>
            Computed Surface Card
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-1.5 bg-rose-600 inline-block rounded-xs border-b border-dashed"></span>
            Idealized Downhole Pump Card
          </span>
          {measured && (
            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
              <span className="w-3.5 h-1.5 bg-emerald-600 inline-block rounded-xs"></span>
              Measured Dynamometer (.dyn)
            </span>
          )}
        </div>

        {measured && (
          <div className="text-slate-600 text-xs bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
            Measured PPRL: <strong className="text-slate-800">{Math.round(measured.pprl).toLocaleString()} lb</strong> ·
            Measured PRHP: <strong className="text-slate-800">{measured.prhp.toFixed(1)} hp</strong>
          </div>
        )}
      </div>
    </div>
  );
};
