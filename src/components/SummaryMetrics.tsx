import React from 'react';
import { SimulationResult } from '../types';
import { ShieldCheck, AlertTriangle, Activity, Gauge, Flame, ArrowDownUp } from 'lucide-react';

interface Props {
  result: SimulationResult;
}

export const SummaryMetrics: React.FC<Props> = ({ result }) => {
  const { main, buckling } = result;

  const bucklingRangesStr =
    buckling.bucklingDepthRanges.length > 0
      ? buckling.bucklingDepthRanges
          .map(r => `${Math.round(r.topMd).toLocaleString()} - ${Math.round(r.bottomMd).toLocaleString()} ft`)
          .join(', ')
      : 'None (Stable)';

  return (
    <div id="card-summary-metrics" className="card border border-slate-200 bg-white rounded-xl p-4 sm:p-5 shadow-xs">
      <div className="border-b border-slate-100 pb-3 mb-4">
        <h2 className="text-base font-semibold text-slate-800 flex items-center justify-between m-0">
          <span className="flex items-center gap-2">
            <Gauge className="w-5 h-5 text-sky-700" />
            <span>Design & Deviated Diagnostic Results</span>
          </span>
          <span className="text-xs text-slate-400 font-normal">API RP 11L + Gibbs Deviated</span>
        </h2>
      </div>

      {/* Primary Highlights: Buckling & Deviated Engine Outputs (Required by prompt) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {/* 1. Buckling Status */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            buckling.status === 'HELICAL'
              ? 'bg-rose-50/80 border-rose-200 text-rose-900'
              : buckling.status === 'SINUSOIDAL'
              ? 'bg-amber-50/80 border-amber-200 text-amber-900'
              : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase font-medium tracking-wide opacity-80">Buckling Status</span>
            {buckling.status === 'HELICAL' ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 animate-bounce" />
            ) : buckling.status === 'SINUSOIDAL' ? (
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            )}
          </div>
          <div className="text-lg font-bold">
            {buckling.status}
          </div>
          <div className="text-[11px] opacity-75 mt-0.5">
            {buckling.status === 'HELICAL'
              ? 'Severe helical spiraling'
              : buckling.status === 'SINUSOIDAL'
              ? 'Sinusoidal snake bending'
              : 'Rod string axially stable'}
          </div>
        </div>

        {/* 2. Maximum Drag Load */}
        <div className="p-3.5 rounded-xl border border-sky-200 bg-sky-50/60 text-sky-950">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase font-medium tracking-wide text-sky-700">Maximum Drag Load</span>
            <Flame className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-lg font-bold text-sky-900">
            {Math.round(Math.max(main.maxDragUp, main.maxDragDown)).toLocaleString()} <span className="text-xs font-normal text-slate-500">lb</span>
          </div>
          <div className="text-[11px] text-sky-700 mt-0.5">
            Up: {Math.round(main.maxDragUp)} lb · Down: {Math.round(main.maxDragDown)} lb
          </div>
        </div>

        {/* 3. Buckling Depth Range */}
        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/80 text-slate-800">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase font-medium tracking-wide text-slate-500">Buckling Depth Range</span>
            <ArrowDownUp className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-base font-bold text-slate-900 truncate" title={bucklingRangesStr}>
            {bucklingRangesStr}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Peak Comp: {Math.round(buckling.maxCompression)} lb @ {Math.round(buckling.maxCompressionDepth)} ft
          </div>
        </div>

        {/* 4. Neutral Point Depth */}
        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/80 text-slate-800">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase font-medium tracking-wide text-slate-500">Neutral Point Depth</span>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-lg font-bold text-slate-900">
            {Math.round(buckling.neutralPointDepth).toLocaleString()} <span className="text-xs font-normal text-slate-500">ft</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Tension/Compression transition point
          </div>
        </div>
      </div>

      {/* Grid of Sucker Rod Pumping Core Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
          <span className="text-[11px] font-medium text-slate-500 block uppercase tracking-wide">PPRL (Peak Load)</span>
          <span className="text-base font-bold text-slate-900 block mt-0.5">
            {Math.round(main.PPRL).toLocaleString()} <span className="text-xs font-normal text-slate-500">lb</span>
          </span>
        </div>

        <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
          <span className="text-[11px] font-medium text-slate-500 block uppercase tracking-wide">MPRL (Min Load)</span>
          <span className="text-base font-bold text-slate-900 block mt-0.5">
            {Math.round(main.MPRL).toLocaleString()} <span className="text-xs font-normal text-slate-500">lb</span>
          </span>
        </div>

        <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
          <span className="text-[11px] font-medium text-slate-500 block uppercase tracking-wide">Peak Gearbox Torque</span>
          <span className="text-base font-bold text-slate-900 block mt-0.5">
            {(main.PT / 1000).toFixed(1)} <span className="text-xs font-normal text-slate-500">k in-lb</span>
          </span>
        </div>

        <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
          <span className="text-[11px] font-medium text-slate-500 block uppercase tracking-wide">Pump Displacement</span>
          <span className="text-base font-bold text-sky-800 block mt-0.5">
            {Math.round(main.PD).toLocaleString()} <span className="text-xs font-normal text-slate-500">bbl/d</span>
          </span>
        </div>

        <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
          <span className="text-[11px] font-medium text-slate-500 block uppercase tracking-wide">Polished Rod Power</span>
          <span className="text-base font-bold text-slate-900 block mt-0.5">
            {main.PRHP.toFixed(1)} <span className="text-xs font-normal text-slate-500">hp</span>
          </span>
        </div>

        <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
          <span className="text-[11px] font-medium text-slate-500 block uppercase tracking-wide">Goodman Stress</span>
          <span
            className={`text-base font-bold block mt-0.5 ${
              main.goodmanUtil > 100
                ? 'text-rose-600'
                : main.goodmanUtil > 80
                ? 'text-amber-600'
                : 'text-emerald-700'
            }`}
          >
            {main.goodmanUtil.toFixed(0)}% <span className="text-xs font-normal text-slate-500">util</span>
          </span>
        </div>
      </div>
    </div>
  );
};
