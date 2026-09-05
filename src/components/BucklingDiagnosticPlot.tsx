import React, { useState } from 'react';
import { BucklingAnalysisResult } from '../types';
import { AlertTriangle, ShieldCheck, HelpCircle, Activity } from 'lucide-react';

interface Props {
  buckling: BucklingAnalysisResult;
  pumpDepth: number;
}

export const BucklingDiagnosticPlot: React.FC<Props> = ({ buckling, pumpDepth }) => {
  const [activeTab, setActiveTab] = useState<'BUCKLING_DIAG' | 'AXIAL_PROFILE'>('BUCKLING_DIAG');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { profiles, status, bucklingDepthRanges, neutralPointDepth, maxCompression, maxCompressionDepth } = buckling;

  if (!profiles || profiles.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 bg-slate-50 border border-slate-200 rounded-xl">
        Run design calculation to generate buckling diagnostic curves.
      </div>
    );
  }

  const width = 640;
  const height = 360;
  const padLeft = 70;
  const padRight = 30;
  const padTop = 25;
  const padBottom = 45;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  // Depth range (Y-axis): 0 to pumpDepth
  const maxDepth = pumpDepth;

  // Force range (X-axis)
  let maxForce = 2000;
  let minForce = 0;

  if (activeTab === 'BUCKLING_DIAG') {
    // X is positive magnitude of compression & critical thresholds
    const maxComp = Math.max(...profiles.map(p => p.compressionMag));
    const maxCrit = Math.max(...profiles.map(p => p.fCritHel));
    maxForce = Math.max(1500, Math.ceil(Math.max(maxComp, maxCrit) * 1.15));
    minForce = 0;
  } else {
    // X is signed Axial Load (tension > 0, compression < 0)
    const minAxial = Math.min(...profiles.map(p => p.axialLoadPeakDown));
    const maxAxial = Math.max(...profiles.map(p => p.axialLoadPeakUp));
    minForce = Math.min(-500, Math.floor(minAxial * 1.15));
    maxForce = Math.max(2000, Math.ceil(maxAxial * 1.15));
  }

  const getX = (val: number) => {
    return padLeft + ((val - minForce) / (maxForce - minForce || 1)) * plotW;
  };

  const getY = (depth: number) => {
    return padTop + (depth / (maxDepth || 1)) * plotH;
  };

  // Build SVG Paths
  let compPathStr = '';
  let sinPathStr = '';
  let helPathStr = '';
  let downAxialPathStr = '';
  let upAxialPathStr = '';

  profiles.forEach((p, i) => {
    const y = getY(p.md);
    if (activeTab === 'BUCKLING_DIAG') {
      const xComp = getX(p.compressionMag);
      const xSin = getX(p.fCritSin);
      const xHel = getX(p.fCritHel);

      compPathStr += `${i === 0 ? 'M' : 'L'} ${xComp.toFixed(1)},${y.toFixed(1)} `;
      sinPathStr += `${i === 0 ? 'M' : 'L'} ${xSin.toFixed(1)},${y.toFixed(1)} `;
      helPathStr += `${i === 0 ? 'M' : 'L'} ${xHel.toFixed(1)},${y.toFixed(1)} `;
    } else {
      const xDown = getX(p.axialLoadPeakDown);
      const xUp = getX(p.axialLoadPeakUp);

      downAxialPathStr += `${i === 0 ? 'M' : 'L'} ${xDown.toFixed(1)},${y.toFixed(1)} `;
      upAxialPathStr += `${i === 0 ? 'M' : 'L'} ${xUp.toFixed(1)},${y.toFixed(1)} `;
    }
  });

  const hoveredProfile = hoverIndex !== null ? profiles[hoverIndex] : null;

  return (
    <div id="card-buckling-diagnostic" className="card border border-slate-200 bg-white rounded-xl p-4 sm:p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-800 m-0 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-rose-600" />
              <span>Diagnostic Sucker Rod Buckling & Axial Load Engine</span>
            </h3>

            {/* Status Badge */}
            {status === 'HELICAL' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200 animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5" />
                HELICAL BUCKLING
              </span>
            ) : status === 'SINUSOIDAL' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5" />
                SINUSOIDAL BUCKLING
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5" />
                NO BUCKLING
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 m-0 mt-0.5">
            Paslay-Bogy / Lubinski / Gibbs criteria: F<sub>axial</sub> vs Sinusoidal & Helical Thresholds
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('BUCKLING_DIAG')}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
              activeTab === 'BUCKLING_DIAG'
                ? 'bg-white text-rose-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Buckling Diagram (F<sub>crit</sub> vs |F<sub>axial</sub>|)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('AXIAL_PROFILE')}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
              activeTab === 'AXIAL_PROFILE'
                ? 'bg-white text-sky-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Axial Load Profile (Up vs Down)
          </button>
        </div>
      </div>

      {/* SVG Plot */}
      <div className="relative overflow-hidden bg-slate-50/70 border border-slate-200 rounded-lg">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto block select-none"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Depth Grid Lines (Horizontal) */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const gy = padTop + pct * plotH;
            const depthVal = pct * maxDepth;
            return (
              <g key={`dgrid-${idx}`}>
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
                  {Math.round(depthVal).toLocaleString()} ft
                </text>
              </g>
            );
          })}

          {/* Force Grid Lines (Vertical) */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const gx = padLeft + pct * plotW;
            const forceVal = minForce + pct * (maxForce - minForce);
            return (
              <g key={`fgrid-${idx}`}>
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
                  {Math.round(forceVal).toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* Zero Axis for Axial Load Profile */}
          {activeTab === 'AXIAL_PROFILE' && minForce < 0 && (
            <g>
              <line
                x1={getX(0)}
                y1={padTop}
                x2={getX(0)}
                y2={height - padBottom}
                stroke="#64748b"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
              <text
                x={getX(0)}
                y={padTop - 6}
                textAnchor="middle"
                className="text-[10px] fill-slate-500 font-bold"
              >
                0 (Neutral Line)
              </text>
            </g>
          )}

          {/* Highlight Red Zones where Buckling is Identified */}
          {activeTab === 'BUCKLING_DIAG' &&
            bucklingDepthRanges.map((range, idx) => {
              const y1 = getY(range.topMd);
              const y2 = getY(range.bottomMd);
              const h = Math.max(4, y2 - y1);
              return (
                <g key={`zone-${idx}`}>
                  <rect
                    x={padLeft}
                    y={y1}
                    width={plotW}
                    height={h}
                    fill={range.type === 'HELICAL' ? '#f43f5e' : '#f59e0b'}
                    fillOpacity="0.16"
                  />
                  <line
                    x1={padLeft}
                    y1={y1}
                    x2={width - padRight}
                    y2={y1}
                    stroke={range.type === 'HELICAL' ? '#e11d48' : '#d97706'}
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <line
                    x1={padLeft}
                    y1={y2}
                    x2={width - padRight}
                    y2={y2}
                    stroke={range.type === 'HELICAL' ? '#e11d48' : '#d97706'}
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <text
                    x={width - padRight - 8}
                    y={y1 + 14}
                    textAnchor="end"
                    className="text-[10px] font-bold fill-rose-700"
                  >
                    BUCKLING ZONE: {Math.round(range.topMd)} - {Math.round(range.bottomMd)} ft
                  </text>
                </g>
              );
            })}

          {/* Neutral Point Depth Line */}
          {neutralPointDepth < pumpDepth && (
            <g>
              <line
                x1={padLeft}
                y1={getY(neutralPointDepth)}
                x2={width - padRight}
                y2={getY(neutralPointDepth)}
                stroke="#0284c7"
                strokeWidth="1.5"
                strokeDasharray="5 3"
              />
              <text
                x={padLeft + 10}
                y={getY(neutralPointDepth) - 4}
                className="text-[10px] font-semibold fill-sky-700"
              >
                Neutral Point: {Math.round(neutralPointDepth).toLocaleString()} ft
              </text>
            </g>
          )}

          {/* Paths for Buckling Diagram */}
          {activeTab === 'BUCKLING_DIAG' ? (
            <>
              {/* Sinusoidal Critical Load Curve */}
              <path
                d={sinPathStr}
                fill="none"
                stroke="#eab308"
                strokeWidth="2"
                strokeDasharray="4 2"
              />

              {/* Helical Critical Load Curve */}
              <path
                d={helPathStr}
                fill="none"
                stroke="#ef4444"
                strokeWidth="2"
                strokeDasharray="6 3"
              />

              {/* Compression Force Profile */}
              <path
                d={compPathStr}
                fill="none"
                stroke="#881337"
                strokeWidth="2.5"
              />

              {/* Data Node Hitboxes */}
              {profiles.map((p, idx) => (
                <circle
                  key={`pt-${idx}`}
                  cx={getX(p.compressionMag)}
                  cy={getY(p.md)}
                  r={p.isHelical ? 5 : p.isSinusoidal ? 4 : 2.5}
                  fill={p.isHelical ? '#e11d48' : p.isSinusoidal ? '#f59e0b' : '#475569'}
                  stroke="#ffffff"
                  strokeWidth="1"
                  className="cursor-pointer transition-all hover:scale-150"
                  onMouseEnter={() => setHoverIndex(idx)}
                  onMouseLeave={() => setHoverIndex(null)}
                />
              ))}
            </>
          ) : (
            <>
              {/* Peak Upstroke Tension */}
              <path
                d={upAxialPathStr}
                fill="none"
                stroke="#0284c7"
                strokeWidth="2.5"
              />

              {/* Peak Downstroke Compression */}
              <path
                d={downAxialPathStr}
                fill="none"
                stroke="#e11d48"
                strokeWidth="2.5"
              />

              {/* Data Node Hitboxes */}
              {profiles.map((p, idx) => (
                <circle
                  key={`pt2-${idx}`}
                  cx={getX(p.axialLoadPeakDown)}
                  cy={getY(p.md)}
                  r={3.5}
                  fill={p.axialLoadPeakDown < 0 ? '#e11d48' : '#0284c7'}
                  stroke="#ffffff"
                  strokeWidth="1"
                  className="cursor-pointer transition-all hover:scale-150"
                  onMouseEnter={() => setHoverIndex(idx)}
                  onMouseLeave={() => setHoverIndex(null)}
                />
              ))}
            </>
          )}

          {/* Axes Labels */}
          <text
            x={padLeft + plotW / 2}
            y={height - 10}
            textAnchor="middle"
            className="text-[11px] fill-slate-500 font-medium"
          >
            {activeTab === 'BUCKLING_DIAG'
              ? 'Load / Threshold Magnitude (lb)'
              : 'Axial Load (lb) — [Negative = Compression | Positive = Tension]'}
          </text>
          <text
            transform={`translate(18, ${padTop + plotH / 2}) rotate(-90)`}
            textAnchor="middle"
            className="text-[11px] fill-slate-500 font-medium"
          >
            Measured Depth MD (ft)
          </text>
        </svg>

        {/* Hover Tooltip */}
        {hoveredProfile && (
          <div className="absolute top-2 right-2 bg-slate-900/95 text-white text-xs px-3.5 py-2.5 rounded-lg shadow-xl pointer-events-none backdrop-blur-xs border border-slate-700">
            <div className="font-semibold text-rose-300">
              Depth: {Math.round(hoveredProfile.md)} ft MD (Inc: {hoveredProfile.inc.toFixed(1)}°)
            </div>
            <div>
              Downstroke Axial Load:{' '}
              <span className={hoveredProfile.axialLoadPeakDown < 0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                {Math.round(hoveredProfile.axialLoadPeakDown)} lb
              </span>
            </div>
            <div>Upstroke Peak Tension: {Math.round(hoveredProfile.axialLoadPeakUp)} lb</div>
            <div className="text-amber-300">
              Sinusoidal Limit (F<sub>crit,sin</sub>): {Math.round(hoveredProfile.fCritSin)} lb
            </div>
            <div className="text-rose-400">
              Helical Limit (F<sub>crit,hel</sub>): {Math.round(hoveredProfile.fCritHel)} lb
            </div>
            <div className="mt-1 pt-1 border-t border-slate-700 text-[11px]">
              Buckling Status:{' '}
              <span className="font-bold">
                {hoveredProfile.isHelical
                  ? 'HELICAL BUCKLING'
                  : hoveredProfile.isSinusoidal
                  ? 'SINUSOIDAL BUCKLING'
                  : 'STABLE (NO BUCKLING)'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Legend & Diagnostic Summary */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3 text-slate-600">
          {activeTab === 'BUCKLING_DIAG' ? (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-1.5 bg-rose-900 inline-block rounded-xs"></span>
                |F<sub>axial,comp</sub>| (Actual Compression)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-1.5 bg-amber-500 inline-block rounded-xs"></span>
                F<sub>crit,sin</sub> (Sinusoidal Threshold)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-1.5 bg-rose-600 inline-block rounded-xs"></span>
                F<sub>crit,hel</sub> (Helical Threshold)
              </span>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-1.5 bg-sky-600 inline-block rounded-xs"></span>
                Upstroke Tension Peak
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-1.5 bg-rose-600 inline-block rounded-xs"></span>
                Downstroke Compression Peak
              </span>
            </>
          )}
        </div>

        <div className="text-right text-slate-500">
          Peak Compression: <span className="font-bold text-rose-700">{Math.round(maxCompression)} lb</span> @{' '}
          <span className="font-semibold text-slate-700">{Math.round(maxCompressionDepth)} ft</span>
        </div>
      </div>
    </div>
  );
};
