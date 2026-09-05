import React, { useState } from 'react';
import { BucklingAnalysisResult } from '../types';
import { TrendingUp, Anchor, AlertCircle } from 'lucide-react';

interface Props {
  buckling: BucklingAnalysisResult;
  pumpDepth: number;
}

export const DragAndSideLoadPlot: React.FC<Props> = ({ buckling, pumpDepth }) => {
  const [metric, setMetric] = useState<'DRAG' | 'SIDE_LOAD'>('DRAG');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { profiles } = buckling;

  if (!profiles || profiles.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 bg-slate-50 border border-slate-200 rounded-xl">
        Run calculation to display drag load distribution.
      </div>
    );
  }

  const width = 640;
  const height = 340;
  const padLeft = 70;
  const padRight = 30;
  const padTop = 25;
  const padBottom = 45;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxDepth = pumpDepth;

  // X scale
  let maxX = 500;
  if (metric === 'DRAG') {
    const maxDragVal = Math.max(
      ...profiles.map(p => Math.max(p.fDragUp, p.fDragDown))
    );
    maxX = Math.max(200, Math.ceil(maxDragVal * 1.2));
  } else {
    const maxSideVal = Math.max(
      ...profiles.map(p => Math.max(p.fnUp, p.fnDown))
    );
    maxX = Math.max(150, Math.ceil(maxSideVal * 1.2));
  }

  const getX = (val: number) => {
    return padLeft + (val / maxX) * plotW;
  };

  const getY = (depth: number) => {
    return padTop + (depth / (maxDepth || 1)) * plotH;
  };

  let upPathStr = '';
  let downPathStr = '';

  profiles.forEach((p, idx) => {
    const y = getY(p.md);
    const valUp = metric === 'DRAG' ? p.fDragUp : p.fnUp;
    const valDown = metric === 'DRAG' ? p.fDragDown : p.fnDown;

    const xUp = getX(valUp);
    const xDown = getX(valDown);

    upPathStr += `${idx === 0 ? 'M' : 'L'} ${xUp.toFixed(1)},${y.toFixed(1)} `;
    downPathStr += `${idx === 0 ? 'M' : 'L'} ${xDown.toFixed(1)},${y.toFixed(1)} `;
  });

  const hoveredItem = hoverIndex !== null ? profiles[hoverIndex] : null;

  return (
    <div id="card-drag-load-plot" className="card border border-slate-200 bg-white rounded-xl p-4 sm:p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 m-0">
            <TrendingUp className="w-4 h-4 text-sky-700" />
            <span>Rod-Tubing Contact Side Load & Frictional Drag Distribution</span>
          </h3>
          <p className="text-xs text-slate-500 m-0 mt-0.5">
            Lufkin Normal Contact Force: f<sub>n</sub> = √[(T·Δθ·sin α)² + (w<sub>r</sub>·sin α + T·Δα)²]
          </p>
        </div>

        <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => setMetric('DRAG')}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
              metric === 'DRAG' ? 'bg-white text-sky-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Drag Force F<sub>drag</sub> (lb)
          </button>
          <button
            type="button"
            onClick={() => setMetric('SIDE_LOAD')}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
              metric === 'SIDE_LOAD' ? 'bg-white text-sky-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Side Load f<sub>n</sub> (lb/ft)
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden bg-slate-50/70 border border-slate-200 rounded-lg">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto block select-none"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Depth Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const gy = padTop + pct * plotH;
            const depthVal = pct * maxDepth;
            return (
              <g key={`gy-${idx}`}>
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

          {/* Value Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const gx = padLeft + pct * plotW;
            const val = pct * maxX;
            return (
              <g key={`gx-${idx}`}>
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
                  {Math.round(val).toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* Upstroke Curve */}
          <path
            d={upPathStr}
            fill="none"
            stroke="#0284c7"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Downstroke Curve */}
          <path
            d={downPathStr}
            fill="none"
            stroke="#e11d48"
            strokeWidth="2.5"
            strokeDasharray="5 3"
            strokeLinecap="round"
          />

          {/* Node Points */}
          {profiles.map((p, idx) => {
            const y = getY(p.md);
            const xUp = getX(metric === 'DRAG' ? p.fDragUp : p.fnUp);
            return (
              <circle
                key={`dp-${idx}`}
                cx={xUp}
                cy={y}
                r={3}
                fill="#0284c7"
                stroke="#ffffff"
                strokeWidth="1"
                className="cursor-pointer transition-all hover:scale-150"
                onMouseEnter={() => setHoverIndex(idx)}
                onMouseLeave={() => setHoverIndex(null)}
              />
            );
          })}

          {/* Axes Labels */}
          <text
            x={padLeft + plotW / 2}
            y={height - 10}
            textAnchor="middle"
            className="text-[11px] fill-slate-500 font-medium"
          >
            {metric === 'DRAG' ? 'Frictional Drag Force F_drag (lb)' : 'Normal Contact Force fn (lb/ft)'}
          </text>
          <text
            transform={`translate(18, ${padTop + plotH / 2}) rotate(-90)`}
            textAnchor="middle"
            className="text-[11px] fill-slate-500 font-medium"
          >
            Measured Depth MD (ft)
          </text>
        </svg>

        {hoveredItem && (
          <div className="absolute top-2 right-2 bg-slate-900/95 text-white text-xs px-3.5 py-2.5 rounded-lg shadow-xl pointer-events-none backdrop-blur-xs border border-slate-700">
            <div className="font-semibold text-sky-300">
              Depth: {Math.round(hoveredItem.md)} ft MD (Inc: {hoveredItem.inc.toFixed(1)}°)
            </div>
            <div>Upstroke Drag: <span className="text-sky-300 font-bold">{Math.round(hoveredItem.fDragUp)} lb</span></div>
            <div>Downstroke Drag: <span className="text-rose-300 font-bold">{Math.round(hoveredItem.fDragDown)} lb</span></div>
            <div>Upstroke Normal Contact: {hoveredItem.fnUp.toFixed(1)} lb/ft</div>
            <div>Downstroke Normal Contact: {hoveredItem.fnDown.toFixed(1)} lb/ft</div>
          </div>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 px-1">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-1 bg-sky-600 inline-block rounded-xs"></span>
            Upstroke Motion (μ<sub>u</sub> Drag)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-1 bg-rose-600 inline-block rounded-xs border-b border-dashed"></span>
            Downstroke Motion (μ<sub>d</sub> Drag)
          </span>
        </div>
        <div className="text-slate-500">
          Guide design tip: side loads &gt; 150 lb/ft warrant rod guides (Norris / Ramex).
        </div>
      </div>
    </div>
  );
};
