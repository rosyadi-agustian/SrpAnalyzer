import React from 'react';
import {
  Activity,
  Compass,
  Layers,
  Gauge,
  BookOpen,
  Bot,
  Zap,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Anchor,
  RotateCcw,
  Sliders,
  ChevronRight,
  HelpCircle
} from 'lucide-react';
import { SimulationResult, TaperConfig } from '../types';

export type ActiveViewTab = 'AGENTIC' | 'BUCKLING' | 'TRAJECTORY' | 'DRAG' | 'DYNA' | 'INTERMEDIATES';

interface Props {
  activeTab: ActiveViewTab;
  onTabChange: (tab: ActiveViewTab) => void;
  result: SimulationResult;
  onOpenChat: (initialPrompt?: string) => void;
  onApplyPreset: (presetName: string) => void;
  onQuickAugment: (action: 'mitigate-buckling' | 'toggle-anchor' | 'tune-speed') => void;
  tubingAnchored: 'anchored' | 'unanchored';
  pumpingSpeed: number;
}

export const SmartSidebar: React.FC<Props> = ({
  activeTab,
  onTabChange,
  result,
  onOpenChat,
  onApplyPreset,
  onQuickAugment,
  tubingAnchored,
  pumpingSpeed,
}) => {
  const { buckling, main, trajectory } = result;

  const maxDls = trajectory.length > 0 ? Math.max(...trajectory.map(p => p.dls)) : 0;
  const maxDrag = Math.round(Math.max(main.maxDragUp, main.maxDragDown));

  return (
    <aside
      id="smart-sidebar"
      className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-xs flex flex-col gap-4 text-xs select-none"
    >
      {/* Header / Brand */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sky-900 text-sky-200 flex items-center justify-center font-bold text-xs shadow-xs">
            SR
          </div>
          <div>
            <span className="font-bold text-slate-800 tracking-tight block">Smart Control Hub</span>
            <span className="text-[10px] text-slate-400 block -mt-0.5">Deviated Diagnostic Suite</span>
          </div>
        </div>

        {/* AI Chat Launcher Badge */}
        <button
          id="btn-sidebar-open-chat"
          type="button"
          onClick={() => onOpenChat()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-medium text-[11px] shadow-xs hover:shadow transition-all cursor-pointer"
          title="Open AI Engineering Assistant"
        >
          <Bot className="w-3.5 h-3.5 animate-pulse" />
          <span>AI Assist</span>
        </button>
      </div>

      {/* 1. Primary Navigation Views */}
      <div>
        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2 px-1 flex items-center justify-between">
          <span>Diagnostic Views</span>
          <span className="text-[9px] font-normal text-slate-400">6 Modules</span>
        </div>

        <nav className="space-y-1" aria-label="Diagnostic Modules">
          {/* Agentic AI Predictor & Diagnostic */}
          <button
            id="btn-sidebar-tab-agentic"
            type="button"
            onClick={() => onTabChange('AGENTIC')}
            className={`w-full text-left p-2.5 rounded-lg transition-all flex items-center justify-between cursor-pointer border ${
              activeTab === 'AGENTIC'
                ? 'bg-gradient-to-r from-indigo-50 to-sky-50 text-indigo-950 border-indigo-300 shadow-xs font-semibold ring-1 ring-indigo-400/30'
                : 'hover:bg-slate-50 text-slate-700 border-transparent'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Sparkles
                className={`w-4 h-4 shrink-0 ${
                  activeTab === 'AGENTIC' ? 'text-indigo-600 animate-pulse' : 'text-indigo-500'
                }`}
              />
              <div className="truncate">
                <span className="block truncate font-bold text-slate-900">Agentic Predictor</span>
                <span className="text-[10px] text-indigo-600 block -mt-0.5">Autonomous AI Lift Engine</span>
              </div>
            </div>
            <span className="shrink-0 ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-600 text-white shadow-2xs">
              AGENT
            </span>
          </button>

          {/* Buckling View */}
          <button
            type="button"
            onClick={() => onTabChange('BUCKLING')}
            className={`w-full text-left p-2.5 rounded-lg transition-all flex items-center justify-between cursor-pointer border ${
              activeTab === 'BUCKLING'
                ? 'bg-rose-50/90 text-rose-900 border-rose-200 shadow-xs font-semibold'
                : 'hover:bg-slate-50 text-slate-700 border-transparent'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Activity
                className={`w-4 h-4 shrink-0 ${
                  activeTab === 'BUCKLING' ? 'text-rose-600' : 'text-slate-400'
                }`}
              />
              <div className="truncate">
                <span className="block truncate">Buckling & Stress</span>
                <span className="text-[10px] text-slate-500 block -mt-0.5">Paslay-Bogy / Lubinski</span>
              </div>
            </div>
            <span
              className={`shrink-0 ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                buckling.status === 'HELICAL'
                  ? 'bg-rose-600 text-white animate-pulse'
                  : buckling.status === 'SINUSOIDAL'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {buckling.status}
            </span>
          </button>

          {/* 3D/2D Trajectory View */}
          <button
            type="button"
            onClick={() => onTabChange('TRAJECTORY')}
            className={`w-full text-left p-2.5 rounded-lg transition-all flex items-center justify-between cursor-pointer border ${
              activeTab === 'TRAJECTORY'
                ? 'bg-sky-50/90 text-sky-900 border-sky-200 shadow-xs font-semibold'
                : 'hover:bg-slate-50 text-slate-700 border-transparent'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Compass
                className={`w-4 h-4 shrink-0 ${
                  activeTab === 'TRAJECTORY' ? 'text-sky-600' : 'text-slate-400'
                }`}
              />
              <div className="truncate">
                <span className="block truncate">3D/2D Trajectory</span>
                <span className="text-[10px] text-slate-500 block -mt-0.5">MCM Spatial & DLS</span>
              </div>
            </div>
            <span className="shrink-0 ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
              {maxDls.toFixed(1)}°/100′
            </span>
          </button>

          {/* Drag & Side Load View */}
          <button
            type="button"
            onClick={() => onTabChange('DRAG')}
            className={`w-full text-left p-2.5 rounded-lg transition-all flex items-center justify-between cursor-pointer border ${
              activeTab === 'DRAG'
                ? 'bg-sky-50/90 text-sky-900 border-sky-200 shadow-xs font-semibold'
                : 'hover:bg-slate-50 text-slate-700 border-transparent'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Layers
                className={`w-4 h-4 shrink-0 ${
                  activeTab === 'DRAG' ? 'text-sky-600' : 'text-slate-400'
                }`}
              />
              <div className="truncate">
                <span className="block truncate">Drag & Side Load</span>
                <span className="text-[10px] text-slate-500 block -mt-0.5">Contact Force fn</span>
              </div>
            </div>
            <span className="shrink-0 ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-100 text-sky-800">
              {maxDrag} lb
            </span>
          </button>

          {/* Dynamometer Cards View */}
          <button
            type="button"
            onClick={() => onTabChange('DYNA')}
            className={`w-full text-left p-2.5 rounded-lg transition-all flex items-center justify-between cursor-pointer border ${
              activeTab === 'DYNA'
                ? 'bg-sky-50/90 text-sky-900 border-sky-200 shadow-xs font-semibold'
                : 'hover:bg-slate-50 text-slate-700 border-transparent'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Gauge
                className={`w-4 h-4 shrink-0 ${
                  activeTab === 'DYNA' ? 'text-sky-600' : 'text-slate-400'
                }`}
              />
              <div className="truncate">
                <span className="block truncate">Dynamometer Cards</span>
                <span className="text-[10px] text-slate-500 block -mt-0.5">Surface & Downhole</span>
              </div>
            </div>
            <span className="shrink-0 ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
              {Math.round(main.PPRL / 1000)}k lb
            </span>
          </button>

          {/* Equipment Integrity & Specs */}
          <button
            type="button"
            onClick={() => onTabChange('INTERMEDIATES')}
            className={`w-full text-left p-2.5 rounded-lg transition-all flex items-center justify-between cursor-pointer border ${
              activeTab === 'INTERMEDIATES'
                ? 'bg-sky-50/90 text-sky-900 border-sky-200 shadow-xs font-semibold'
                : 'hover:bg-slate-50 text-slate-700 border-transparent'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <BookOpen
                className={`w-4 h-4 shrink-0 ${
                  activeTab === 'INTERMEDIATES' ? 'text-sky-600' : 'text-slate-400'
                }`}
              />
              <div className="truncate">
                <span className="block truncate">Equipment & Limits</span>
                <span className="text-[10px] text-slate-500 block -mt-0.5">API RP 11L Sheet</span>
              </div>
            </div>
            <span
              className={`shrink-0 ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                main.goodmanUtil > 100
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {main.goodmanUtil.toFixed(0)}% Util
            </span>
          </button>
        </nav>
      </div>

      {/* 2. Quick Augmentations (1-Click Model Actions) */}
      <div className="border-t border-slate-100 pt-3">
        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2 px-1 flex items-center justify-between">
          <span>Quick Augmentations</span>
          <Zap className="w-3 h-3 text-amber-500" />
        </div>

        <div className="grid grid-cols-1 gap-1.5">
          {/* Quick Action: Auto-Mitigate Buckling */}
          <button
            type="button"
            onClick={() => onQuickAugment('mitigate-buckling')}
            className="w-full text-left p-2 rounded-lg bg-slate-50 hover:bg-rose-50/70 border border-slate-200 hover:border-rose-200 text-slate-700 hover:text-rose-900 transition-colors cursor-pointer flex items-center justify-between"
            title="Automatically rebalance rod string taper percentages with heavier bottom to suppress buckling"
          >
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>Auto-Mitigate Buckling</span>
            </span>
            <span className="text-[10px] font-semibold text-rose-700 bg-white px-1.5 py-0.5 rounded border border-rose-100">
              Opt Taper
            </span>
          </button>

          {/* Quick Action: Toggle Tubing Anchor */}
          <button
            type="button"
            onClick={() => onQuickAugment('toggle-anchor')}
            className="w-full text-left p-2 rounded-lg bg-slate-50 hover:bg-sky-50/70 border border-slate-200 hover:border-sky-200 text-slate-700 hover:text-sky-900 transition-colors cursor-pointer flex items-center justify-between"
            title="Toggle between anchored and unanchored tubing string"
          >
            <span className="flex items-center gap-2">
              <Anchor className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span>Toggle Tubing Anchor</span>
            </span>
            <span className="text-[10px] font-semibold text-sky-700 bg-white px-1.5 py-0.5 rounded border border-sky-100">
              {tubingAnchored === 'anchored' ? 'Anchored' : 'Unanchored'}
            </span>
          </button>

          {/* Quick Action: Auto-Tune Pumping Speed */}
          <button
            type="button"
            onClick={() => onQuickAugment('tune-speed')}
            className="w-full text-left p-2 rounded-lg bg-slate-50 hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-200 text-slate-700 hover:text-indigo-900 transition-colors cursor-pointer flex items-center justify-between"
            title="Tune pumping speed to optimize gearbox torque safety margin"
          >
            <span className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>Tune Speed (SPM)</span>
            </span>
            <span className="text-[10px] font-semibold text-indigo-700 bg-white px-1.5 py-0.5 rounded border border-indigo-100">
              {pumpingSpeed} SPM
            </span>
          </button>
        </div>
      </div>

      {/* 3. Common Shortcut Q&A for Chatbot */}
      <div className="border-t border-slate-100 pt-3">
        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2 px-1 flex items-center justify-between">
          <span>AI Shortcut Q&A</span>
          <Sparkles className="w-3 h-3 text-sky-600" />
        </div>

        <div className="space-y-1 text-[11px]">
          <button
            type="button"
            onClick={() => onOpenChat('Why is my rod string buckling and how can I eliminate it?')}
            className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer flex items-center justify-between group"
          >
            <span className="truncate">Why is rod string buckling?</span>
            <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-slate-700 shrink-0 ml-1" />
          </button>

          <button
            type="button"
            onClick={() => onOpenChat('Suggest an optimal taper configuration to mitigate downstroke compression.')}
            className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer flex items-center justify-between group"
          >
            <span className="truncate">Augment taper percentages</span>
            <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-slate-700 shrink-0 ml-1" />
          </button>

          <button
            type="button"
            onClick={() => onOpenChat('Evaluate current gearbox torque and Goodman rod fatigue stress.')}
            className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer flex items-center justify-between group"
          >
            <span className="truncate">Evaluate Goodman fatigue</span>
            <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-slate-700 shrink-0 ml-1" />
          </button>

          <button
            type="button"
            onClick={() => onOpenChat('How does dogleg severity (DLS) impact normal contact force and rod wear in this trajectory?')}
            className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer flex items-center justify-between group"
          >
            <span className="truncate">Analyze DLS wear zones</span>
            <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-slate-700 shrink-0 ml-1" />
          </button>
        </div>
      </div>

      {/* 4. Scenario Presets */}
      <div className="border-t border-slate-100 pt-3">
        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2 px-1 flex items-center justify-between">
          <span>Scenario Presets</span>
          <RotateCcw className="w-3 h-3 text-slate-400" />
        </div>

        <div className="grid grid-cols-1 gap-1">
          <button
            type="button"
            onClick={() => onApplyPreset('baseline')}
            className="w-full text-left px-2 py-1.5 rounded-md hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer font-medium"
          >
            1. Permian 8,000 ft Baseline
          </button>
          <button
            type="button"
            onClick={() => onApplyPreset('severe-buckling')}
            className="w-full text-left px-2 py-1.5 rounded-md hover:bg-slate-100 text-rose-700 transition-colors cursor-pointer font-medium"
          >
            2. Severe Helical Buckling Case
          </button>
          <button
            type="button"
            onClick={() => onApplyPreset('shallow-high-volume')}
            className="w-full text-left px-2 py-1.5 rounded-md hover:bg-slate-100 text-sky-700 transition-colors cursor-pointer font-medium"
          >
            3. Shallow High Volume (4,500 ft)
          </button>
          <button
            type="button"
            onClick={() => onApplyPreset('mitigated-taper')}
            className="w-full text-left px-2 py-1.5 rounded-md hover:bg-slate-100 text-emerald-700 transition-colors cursor-pointer font-medium"
          >
            4. Buckling-Mitigated Taper
          </button>
        </div>
      </div>
    </aside>
  );
};
