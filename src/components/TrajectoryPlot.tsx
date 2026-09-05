import React, { useState } from 'react';
import { TrajectoryPoint } from '../types';
import { Layers, Eye, Activity, Maximize2 } from 'lucide-react';

interface Props {
  trajectory: TrajectoryPoint[];
  pumpDepth: number;
}

type ViewMode = '3D' | 'NORTH' | 'EAST' | 'PLAN' | 'DLS';

export const TrajectoryPlot: React.FC<Props> = ({ trajectory, pumpDepth }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('3D');
  const [hoveredPoint, setHoveredPoint] = useState<TrajectoryPoint | null>(null);

  if (!trajectory || trajectory.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 bg-slate-50 border border-slate-200 rounded-xl">
        No trajectory survey points loaded.
      </div>
    );
  }

  // Find min/max bounds for proper aspect ratio
  const maxMD = Math.max(...trajectory.map(p => p.md));
  const maxTVD = Math.max(...trajectory.map(p => p.tvd));
  const minNorth = Math.min(0, ...trajectory.map(p => p.north));
  const maxNorth = Math.max(0, ...trajectory.map(p => p.north));
  const minEast = Math.min(0, ...trajectory.map(p => p.east));
  const maxEast = Math.max(0, ...trajectory.map(p => p.east));
  const maxDls = Math.max(1, ...trajectory.map(p => p.dls));

  // Canvas bounds
  const width = 600;
  const height = 320;
  const padLeft = 65;
  const padRight = 30;
  const padTop = 25;
  const padBottom = 40;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  // Project points according to view mode
  let xLabel = 'Horizontal Departure (ft)';
  let yLabel = 'True Vertical Depth (ft)';

  const projectedPoints = trajectory.map(p => {
    let px = 0;
    let py = 0;

    if (viewMode === '3D') {
      // 3D Isometric-like oblique projection:
      // X_screen = East * cos(30 deg) - North * sin(30 deg)
      // Y_screen = TVD + (East * sin(30 deg) + North * cos(30 deg)) * 0.4
      xLabel = '3D Oblique Projection (East / North ft)';
      yLabel = 'True Vertical Depth (ft)';

      const rad = (35 * Math.PI) / 180;
      const x3d = p.east * Math.cos(rad) - p.north * Math.sin(rad);
      const z3d = p.tvd;

      // Normalize
      const minX3d = -1000;
      const maxX3d = 4000;
      px = padLeft + ((x3d - minX3d) / (maxX3d - minX3d || 1)) * plotW;
      py = padTop + (z3d / (maxTVD * 1.05 || 1)) * plotH;
    } else if (viewMode === 'NORTH') {
      // Looking North: Vertical section (East vs TVD)
      xLabel = 'East Departure (ft)';
      yLabel = 'True Vertical Depth (ft)';
      const spanEast = Math.max(500, maxEast - minEast);
      px = padLeft + ((p.east - minEast) / spanEast) * plotW;
      py = padTop + (p.tvd / (maxTVD * 1.05 || 1)) * plotH;
    } else if (viewMode === 'EAST') {
      // Looking East: Vertical section (North vs TVD)
      xLabel = 'North Departure (ft)';
      yLabel = 'True Vertical Depth (ft)';
      const spanNorth = Math.max(500, maxNorth - minNorth);
      px = padLeft + ((p.north - minNorth) / spanNorth) * plotW;
      py = padTop + (p.tvd / (maxTVD * 1.05 || 1)) * plotH;
    } else if (viewMode === 'PLAN') {
      // Plan View: North (Y) vs East (X)
      xLabel = 'East Coordinate (ft)';
      yLabel = 'North Coordinate (ft)';
      const spanX = Math.max(500, maxEast - minEast);
      const spanY = Math.max(500, maxNorth - minNorth);
      px = padLeft + ((p.east - minEast) / spanX) * plotW;
      // Y inverted so North points UP
      py = padTop + (1 - (p.north - minNorth) / spanY) * plotH;
    } else if (viewMode === 'DLS') {
      // Dogleg Severity Profile: MD (Y) vs DLS (X)
      xLabel = 'Dogleg Severity (° / 100 ft)';
      yLabel = 'Measured Depth (ft)';
      const dlsMaxScale = Math.max(5, Math.ceil(maxDls * 1.2));
      px = padLeft + (p.dls / dlsMaxScale) * plotW;
      py = padTop + (p.md / (maxMD * 1.05 || 1)) * plotH;
    }

    return { ...p, px, py };
  });

  const svgPathStr = projectedPoints.reduce((acc, pt, idx) => {
    return `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.px.toFixed(1)},${pt.py.toFixed(1)}`;
  }, '');

  return (
    <div id="card-trajectory-plot" className="card border border-slate-200 bg-white rounded-xl p-4 sm:p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 m-0">
            <Layers className="w-4 h-4 text-sky-700" />
            <span>3D/2D Wellbore Trajectory & Dogleg Severity (MCM)</span>
          </h3>
          <p className="text-xs text-slate-500 m-0 mt-0.5">
            Calculated via Minimum Curvature Method (MCM) coordinates & DLS curvature
          </p>
        </div>

        {/* View Switcher Buttons */}
        <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => setViewMode('3D')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              viewMode === '3D' ? 'bg-white text-sky-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            3D Spatial
          </button>
          <button
            type="button"
            onClick={() => setViewMode('NORTH')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              viewMode === 'NORTH' ? 'bg-white text-sky-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            North View
          </button>
          <button
            type="button"
            onClick={() => setViewMode('EAST')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              viewMode === 'EAST' ? 'bg-white text-sky-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            East View
          </button>
          <button
            type="button"
            onClick={() => setViewMode('PLAN')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              viewMode === 'PLAN' ? 'bg-white text-sky-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Plan View
          </button>
          <button
            type="button"
            onClick={() => setViewMode('DLS')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              viewMode === 'DLS' ? 'bg-white text-sky-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            DLS vs MD
          </button>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative overflow-hidden bg-slate-50/70 border border-slate-200 rounded-lg">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto block select-none"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const gy = padTop + pct * plotH;
            const gx = padLeft + pct * plotW;
            return (
              <g key={`grid-${idx}`}>
                <line
                  x1={padLeft}
                  y1={gy}
                  x2={width - padRight}
                  y2={gy}
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                />
                <line
                  x1={gx}
                  y1={padTop}
                  x2={gx}
                  y2={height - padBottom}
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                />
              </g>
            );
          })}

          {/* DLS threshold zone if DLS mode */}
          {viewMode === 'DLS' && (
            <line
              x1={padLeft + (3 / Math.max(5, Math.ceil(maxDls * 1.2))) * plotW}
              y1={padTop}
              x2={padLeft + (3 / Math.max(5, Math.ceil(maxDls * 1.2))) * plotW}
              y2={height - padBottom}
              stroke="#ef4444"
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />
          )}

          {/* Trajectory Profile Path */}
          <path
            d={svgPathStr}
            fill="none"
            stroke="#0284c7"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Survey Stations Nodes */}
          {projectedPoints.map((pt, idx) => {
            const isHighDls = pt.dls >= 3.0;
            return (
              <circle
                key={`pt-${idx}`}
                cx={pt.px}
                cy={pt.py}
                r={isHighDls ? 5 : 3.5}
                fill={isHighDls ? '#ef4444' : '#0369a1'}
                stroke="#ffffff"
                strokeWidth="1.5"
                className="cursor-pointer transition-transform hover:scale-150"
                onMouseEnter={() => setHoveredPoint(pt)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            );
          })}

          {/* Axis Labels */}
          <text
            x={padLeft + plotW / 2}
            y={height - 10}
            textAnchor="middle"
            className="text-[11px] fill-slate-500 font-medium"
          >
            {xLabel}
          </text>
          <text
            transform={`translate(16, ${padTop + plotH / 2}) rotate(-90)`}
            textAnchor="middle"
            className="text-[11px] fill-slate-500 font-medium"
          >
            {yLabel}
          </text>
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && (
          <div className="absolute top-2 right-2 bg-slate-900/90 text-white text-xs px-3 py-2 rounded-md shadow-lg pointer-events-none backdrop-blur-xs border border-slate-700">
            <div className="font-semibold text-sky-300">Survey Station @ {hoveredPoint.md} ft MD</div>
            <div>TVD: {Math.round(hoveredPoint.tvd).toLocaleString()} ft</div>
            <div>Inclination: {hoveredPoint.inc.toFixed(1)}°</div>
            <div>Azimuth: {hoveredPoint.azim.toFixed(1)}°</div>
            <div className={hoveredPoint.dls >= 3 ? 'text-amber-300 font-bold' : ''}>
              DLS: {hoveredPoint.dls.toFixed(2)}° / 100 ft
            </div>
            <div>North: {Math.round(hoveredPoint.north)} ft · East: {Math.round(hoveredPoint.east)} ft</div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 mt-2.5 px-1">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-sky-600 inline-block"></span>
            Wellbore Trajectory
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500 inline-block"></span>
            Critical Dogleg (DLS &ge; 3.0°/100ft)
          </span>
        </div>
        <div>
          Pump Depth: <span className="font-semibold text-slate-700">{pumpDepth} ft</span>
        </div>
      </div>
    </div>
  );
};
