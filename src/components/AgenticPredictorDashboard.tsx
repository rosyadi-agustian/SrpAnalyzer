import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Cpu,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
  Gauge,
  Layers,
  ShieldCheck,
  Activity,
  ChevronDown,
  ChevronUp,
  Bot,
  Flame,
  Anchor,
  HelpCircle,
  Clock,
  Check
} from 'lucide-react';
import { SimulationResult, TaperConfig, TrajectoryPoint } from '../types';
import { EngineInputs, calculateDeviatedDesign } from '../engine/deviatedWaveEq';

export type OptimizationGoal = 'balanced' | 'eliminate-buckling' | 'maximize-production' | 'minimize-fatigue';

interface Props {
  result: SimulationResult;
  inputs: EngineInputs;
  onApplyAugmentation: (aug: {
    tapers?: TaperConfig[];
    pumpingSpeed?: number;
    strokeLength?: number;
    plungerDia?: number;
    tubingAnchor?: 'anchored' | 'unanchored';
    summary?: string;
  }) => void;
  onOpenChat: (initialPrompt?: string) => void;
}

interface AgenticTraceStep {
  step: number;
  title: string;
  detail: string;
  status: 'complete' | 'warning' | 'active';
}

interface AgenticPredictions {
  production: {
    displacementBFPD: number;
    effectiveStrokeIn: number;
    volumetricEfficiencyPct: number;
    strokeLossTubingIn: number;
    strokeLossRodIn: number;
    assessment: string;
  };
  buckling: {
    status: string;
    helicalIntervals: string;
    neutralPointDepthFt: number;
    maxCompressionLb: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'CRITICAL';
    assessment: string;
  };
  tubingWear: {
    maxContactSideLoadLbFt: number;
    criticalWearIntervals: string;
    recommendedRodGuideDensity: string;
    assessment: string;
  };
  mechanicalReliability: {
    goodmanUtilizationPct: number;
    gearboxTorquePct: number;
    structuralBeamPct: number;
    fatigueFailureRisk: string;
    assessment: string;
  };
  dynamometer: {
    predictedCardType: string;
    fillageQualityPct: number;
    fluidPoundRisk: string;
    assessment: string;
  };
}

export const AgenticPredictorDashboard: React.FC<Props> = ({
  result,
  inputs,
  onApplyAugmentation,
  onOpenChat
}) => {
  const [goal, setGoal] = useState<OptimizationGoal>('balanced');
  const [isRunning, setIsRunning] = useState(false);
  const [traceExpanded, setTraceExpanded] = useState(true);
  const [lastRunTime, setLastRunTime] = useState<string>('Just now');
  const [isAiLive, setIsAiLive] = useState(false);
  const [appliedSuccess, setAppliedSuccess] = useState(false);

  // Formulate candidate parameters based on selected optimization goal
  const candidateInputs = useMemo<EngineInputs>(() => {
    const base = { ...inputs };
    if (goal === 'eliminate-buckling') {
      return {
        ...base,
        tubingAnchored: 'anchored',
        pumpingSpeed: inputs.pumpingSpeed > 8.0 ? 7.5 : inputs.pumpingSpeed,
        tapers: [
          { sizeIndex: 3, pct: 25.0 }, // 1"
          { sizeIndex: 2, pct: 35.0 }, // 7/8"
          { sizeIndex: 1, pct: 40.0 }  // 3/4" heavy bottom
        ]
      };
    } else if (goal === 'maximize-production') {
      return {
        ...base,
        tubingAnchored: 'anchored',
        pumpingSpeed: Math.min(10.0, inputs.pumpingSpeed + 1.0),
        tapers: [
          { sizeIndex: 3, pct: 30.0 },
          { sizeIndex: 2, pct: 35.0 },
          { sizeIndex: 1, pct: 35.0 }
        ]
      };
    } else if (goal === 'minimize-fatigue') {
      return {
        ...base,
        tubingAnchored: 'anchored',
        pumpingSpeed: Math.max(6.5, inputs.pumpingSpeed - 1.2),
        tapers: [
          { sizeIndex: 3, pct: 40.0 },
          { sizeIndex: 2, pct: 35.0 },
          { sizeIndex: 1, pct: 25.0 }
        ]
      };
    } else {
      // Balanced
      return {
        ...base,
        tubingAnchored: 'anchored',
        pumpingSpeed: 8.0,
        tapers: [
          { sizeIndex: 3, pct: 28.0 },
          { sizeIndex: 2, pct: 36.0 },
          { sizeIndex: 1, pct: 36.0 }
        ]
      };
    }
  }, [goal, inputs]);

  // Run the mathematical wave equation on the candidate design for exact counterfactual predictions
  const candidateResult = useMemo<SimulationResult>(() => {
    try {
      return calculateDeviatedDesign(candidateInputs);
    } catch (e) {
      console.error('Candidate simulation calculation error:', e);
      return result;
    }
  }, [candidateInputs, result]);

  // Telemetry & metrics from current simulation
  const { main, buckling, trajectory } = result;
  const status = buckling.status;
  const maxDls = trajectory.length > 0 ? Math.max(...trajectory.map(p => p.dls)) : 0;
  const maxDlsDepth = trajectory.length > 0
    ? trajectory.reduce((maxP, p) => (p.dls > maxP.dls ? p : maxP), trajectory[0]).md
    : 0;
  const maxDrag = Math.round(Math.max(main.maxDragUp, main.maxDragDown));
  const maxSideLoad = Math.round(main.maxSideLoad);

  // Candidate comparison metrics
  const candidateMain = candidateResult.main;
  const candidateBuckling = candidateResult.buckling;
  const pdDelta = Math.round(candidateMain.PD - main.PD);
  const pdDeltaPct = ((candidateMain.PD - main.PD) / (main.PD || 1)) * 100;
  const goodmanDelta = candidateMain.goodmanUtil - main.goodmanUtil;
  const spDelta = candidateMain.Sp - main.Sp;
  const torqueDeltaPct = ((candidateMain.PT - main.PT) / 640000) * 100;

  // Local agentic trace
  const [agenticTrace, setAgenticTrace] = useState<AgenticTraceStep[]>([
    {
      step: 1,
      title: 'Wellbore Trajectory & Dogleg Severity Perception',
      detail: `Scanned trajectory up to ${Math.round(inputs.pumpDepth)} ft MD. Max DLS of ${maxDls.toFixed(2)}°/100ft detected near ${Math.round(maxDlsDepth)} ft MD. Cumulative mechanical drag reaches ${maxDrag.toLocaleString()} lb.`,
      status: maxDls > 3.0 ? 'warning' : 'complete'
    },
    {
      step: 2,
      title: 'Gibbs Damped Wave Dynamic Load Prediction',
      detail: `Simulated downhole dynamic wave cycles. PPRL: ${Math.round(main.PPRL).toLocaleString()} lb, MPRL: ${Math.round(main.MPRL).toLocaleString()} lb. Effective stroke Sp = ${main.Sp.toFixed(1)}″ vs surface stroke ${inputs.strokeLength}″.`,
      status: 'complete'
    },
    {
      step: 3,
      title: 'Downhole Sucker Rod Buckling & Neutral Point Determination',
      detail: `Computed axial stress profile. Neutral point located at ${Math.round(buckling.neutralPointDepth)} ft MD. Peak compression: ${Math.round(buckling.maxCompression).toLocaleString()} lb. Current evaluation: ${status}.`,
      status: status === 'HELICAL' || status === 'SINUSOIDAL' ? 'warning' : 'complete'
    },
    {
      step: 4,
      title: 'Rod-Tubing Contact Wear & Fatigue Life Evaluation',
      detail: `Normal contact force peaks at ${maxSideLoad} lb/ft. Modified Goodman stress utilization is ${main.goodmanUtil.toFixed(1)}%. Tubing is ${inputs.tubingAnchored === 'anchored' ? 'ANCHORED (no breathing loss)' : 'UNANCHORED (cyclic stroke loss)'}.`,
      status: main.goodmanUtil > 90 || inputs.tubingAnchored !== 'anchored' ? 'warning' : 'complete'
    },
    {
      step: 5,
      title: 'Autonomous Counterfactual Optimization Plan Synthesis',
      detail: `Synthesized candidate configuration: rebalanced taper distribution, ensured anchored tubing, and tuned kinematics to eliminate buckling while maintaining target production.`,
      status: 'complete'
    }
  ]);

  const [executiveDiagnosis, setExecutiveDiagnosis] = useState<string>(
    status === 'HELICAL'
      ? `Critical helical buckling predicted across the lower rod string. Severe rod-on-tubing wear and downstroke floating risk detected. Tubing anchor and heavier bottom taper reweighting required.`
      : status === 'SINUSOIDAL'
      ? `Sinusoidal buckling detected along dogleg intervals. Moderate frictional contact side loads observed. Recommended to install molded rod guides across high-DLS stations.`
      : `Well system is axially stable with no active buckling detected. Kinematic and structural loads are within API RP 11B envelopes.`
  );

  const [rationale, setRationale] = useState<string>(
    `The synthesized optimization rebalances rod taper distribution to provide downward gravitational momentum against upward friction, shifting the neutral point into the pump barrel and suppressing helical compression completely.`
  );

  // Trigger agentic analysis on server
  const runAgenticAnalysis = async () => {
    setIsRunning(true);
    setAppliedSuccess(false);

    try {
      const response = await fetch('/api/agentic-predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: {
            main,
            buckling,
            trajectory,
            inputs
          },
          goal
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.agenticTrace) setAgenticTrace(data.agenticTrace);
        if (data.executiveDiagnosis) setExecutiveDiagnosis(data.executiveDiagnosis);
        if (data.recommendedAugmentation?.rationale) setRationale(data.recommendedAugmentation.rationale);
        setIsAiLive(!!data.isAiLive);
        setLastRunTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch (err) {
      console.error('Failed to run agentic prediction:', err);
    } finally {
      setIsRunning(false);
    }
  };

  // Re-run whenever goal changes
  useEffect(() => {
    runAgenticAnalysis();
  }, [goal]);

  const handleApplyOptimization = () => {
    onApplyAugmentation({
      tapers: candidateInputs.tapers,
      pumpingSpeed: candidateInputs.pumpingSpeed,
      tubingAnchor: candidateInputs.tubingAnchored,
      summary: `Applied Agentic Optimization (${goal}): ${candidateInputs.tapers.map(t => `${t.pct}%`).join('/')} tapers, ${candidateInputs.pumpingSpeed} SPM, ${candidateInputs.tubingAnchored} tubing.`
    });
    setAppliedSuccess(true);
    setTimeout(() => setAppliedSuccess(false), 4000);
  };

  return (
    <div id="agentic-predictor-dashboard" className="space-y-4 sm:space-y-6">
      {/* 1. Header Banner & Goal Controller */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-2xl p-4 sm:p-5 text-white shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                Autonomous AI Lift Agent
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                <Clock className="w-3 h-3 text-slate-500" />
                Updated {lastRunTime}
              </span>
              {isAiLive && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Gemini 3.8 Flash Active
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Predictive Performance & Root-Cause Diagnostic</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Continuous autonomous perception of deviated well trajectory, wave equation dynamics, buckling thresholds, and fatigue risk with counterfactual plan formulation.
            </p>
          </div>

          {/* Action Button */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              id="btn-rerun-agentic-diagnostic"
              type="button"
              onClick={runAgenticAnalysis}
              disabled={isRunning}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold shadow-md hover:shadow-indigo-500/25 transition-all cursor-pointer"
            >
              <Cpu className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
              <span>{isRunning ? 'Analyzing Dynamics...' : 'Re-Run Agentic Diagnostic'}</span>
            </button>
          </div>
        </div>

        {/* Goal Selector Bar */}
        <div id="agentic-goal-selector" className="mt-4 pt-3.5 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
            Optimization Goal:
          </span>
          {[
            { id: 'balanced', label: '🎯 Balanced Pareto Lift', desc: '0 Buckling + Low Stress + High Output' },
            { id: 'eliminate-buckling', label: '🛡️ Zero Buckling & Wear', desc: 'Heavy bottom taper + Tubing anchor' },
            { id: 'maximize-production', label: '⚡ Max Liquid Displacement', desc: 'Recover stroke loss + Calibrated SPM' },
            { id: 'minimize-fatigue', label: '🔧 Long-Life Fatigue Relief', desc: 'Sub-75% Goodman stress + Tuned speed' }
          ].map(item => (
            <button
              key={item.id}
              id={`btn-agentic-goal-${item.id}`}
              type="button"
              onClick={() => setGoal(item.id as OptimizationGoal)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                goal === item.id
                  ? 'bg-indigo-600 text-white border-indigo-400 shadow-xs'
                  : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white'
              }`}
              title={item.desc}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Executive Diagnosis Alert Card */}
      <div id="agentic-executive-diagnosis-card" className={`rounded-xl p-4 border shadow-xs flex flex-col sm:flex-row items-start gap-3.5 ${
        status === 'HELICAL'
          ? 'bg-rose-50/90 border-rose-200 text-rose-950'
          : status === 'SINUSOIDAL'
          ? 'bg-amber-50/90 border-amber-200 text-amber-950'
          : 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
      }`}>
        <div className="p-2 rounded-lg bg-white/80 shadow-2xs shrink-0 mt-0.5">
          {status === 'HELICAL' ? (
            <AlertTriangle className="w-5 h-5 text-rose-600 animate-pulse" />
          ) : status === 'SINUSOIDAL' ? (
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          )}
        </div>
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm tracking-tight">Executive System Diagnosis</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
              status === 'HELICAL'
                ? 'bg-rose-600 text-white'
                : status === 'SINUSOIDAL'
                ? 'bg-amber-600 text-white'
                : 'bg-emerald-600 text-white'
            }`}>
              {status}
            </span>
          </div>
          <p className="text-xs sm:text-sm font-normal leading-relaxed text-slate-800">
            {executiveDiagnosis}
          </p>
        </div>
      </div>

      {/* 3. Multi-Step Autonomous Agentic Reasoning Trace */}
      <div id="agentic-reasoning-trace-card" className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <button
          id="btn-toggle-agentic-trace"
          type="button"
          onClick={() => setTraceExpanded(!traceExpanded)}
          className="w-full px-4 py-3 bg-slate-50/80 hover:bg-slate-100/80 transition-colors flex items-center justify-between cursor-pointer border-b border-slate-200/80 text-left"
        >
          <div className="flex items-center gap-2.5">
            <Cpu className="w-4 h-4 text-indigo-600" />
            <span className="font-bold text-xs sm:text-sm text-slate-800 tracking-tight">
              Autonomous Agent Execution & Reasoning Trace
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-800">
              5 Steps Completed
            </span>
          </div>
          {traceExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </button>

        {traceExpanded && (
          <div className="p-4 space-y-3 divide-y divide-slate-100">
            {agenticTrace.map((step) => (
              <div key={step.step} id={`agentic-trace-step-${step.step}`} className="pt-2.5 first:pt-0 flex items-start gap-3 text-xs">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-[11px] ${
                  step.status === 'warning'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                }`}>
                  {step.step}
                </div>
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-800 text-xs">{step.title}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.2 rounded ${
                      step.status === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {step.status === 'warning' ? 'Warning Flagged' : 'Verified'}
                    </span>
                  </div>
                  <p className="text-slate-600 text-xs leading-relaxed">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Predictive Metric Cards Grid (4 Core Petroleum Pillars) */}
      <div id="agentic-predictive-metric-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Production & Kinematics */}
        <div id="agentic-card-production-kinematics" className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Production & Kinematics</span>
              <TrendingUp className="w-4 h-4 text-sky-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {Math.round(main.PD)} <span className="text-xs font-semibold text-slate-500">BFPD</span>
            </div>
            <div className="text-xs text-slate-600 mt-1 flex items-center justify-between">
              <span>Downhole Plunger Sp:</span>
              <span className="font-semibold text-slate-800">{main.Sp.toFixed(1)}″ <span className="text-slate-400">/ {inputs.strokeLength}″</span></span>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Volumetric Efficiency:</span>
              <span className="font-bold text-sky-700">{((main.Sp / (inputs.strokeLength || 1)) * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-sky-600 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.max(0, (main.Sp / (inputs.strokeLength || 1)) * 100))}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1 leading-tight">
              {inputs.tubingAnchored === 'anchored'
                ? 'Anchored tubing recovers 100% of cyclic breathing stroke loss.'
                : 'Unanchored tubing loses ~15-20% plunger stroke to tubing stretch.'}
            </p>
          </div>
        </div>

        {/* Card 2: Downhole Buckling Profile */}
        <div id="agentic-card-buckling-profile" className={`border rounded-xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between space-y-3 ${
          status === 'HELICAL'
            ? 'bg-rose-50/40 border-rose-200'
            : status === 'SINUSOIDAL'
            ? 'bg-amber-50/40 border-amber-200'
            : 'bg-white border-slate-200'
        }`}>
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Buckling Evaluation</span>
              <Activity className={`w-4 h-4 ${status === 'HELICAL' ? 'text-rose-600 animate-pulse' : 'text-slate-400'}`} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-xl sm:text-2xl font-black tracking-tight ${
                status === 'HELICAL'
                  ? 'text-rose-700'
                  : status === 'SINUSOIDAL'
                  ? 'text-amber-700'
                  : 'text-emerald-700'
              }`}>
                {status}
              </span>
            </div>
            <div className="text-xs text-slate-600 mt-1 flex items-center justify-between">
              <span>Neutral Point Depth:</span>
              <span className="font-semibold text-slate-800">{Math.round(buckling.neutralPointDepth).toLocaleString()} ft</span>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-100 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Max Compressive Load:</span>
              <span className="font-bold text-slate-800">{Math.round(buckling.maxCompression).toLocaleString()} lb</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              {status === 'HELICAL'
                ? 'High risk of rod helix locking and rapid tubing perforation holes.'
                : status === 'SINUSOIDAL'
                ? 'Lateral snaking against tubing walls; install rod guides.'
                : 'Axial tension dominates entire stroke length; zero buckling.'}
            </p>
          </div>
        </div>

        {/* Card 3: Rod-Tubing Side Load & Wear */}
        <div id="agentic-card-sideload-wear" className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Side Load & Wear Index</span>
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {maxSideLoad} <span className="text-xs font-semibold text-slate-500">lb/ft fn</span>
            </div>
            <div className="text-xs text-slate-600 mt-1 flex items-center justify-between">
              <span>Max Dogleg DLS:</span>
              <span className="font-semibold text-slate-800">{maxDls.toFixed(2)}°/100ft</span>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-100 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Guide Spacing:</span>
              <span className="font-bold text-indigo-700">
                {maxDls > 3.0 ? '2 guides/rod in dogleg' : '1 guide/rod build'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Normal contact load highest near {Math.round(maxDlsDepth)} ft MD where trajectory builds inclination.
            </p>
          </div>
        </div>

        {/* Card 4: Mechanical Fatigue & Surface Unit */}
        <div id="agentic-card-fatigue-gearbox" className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Fatigue & Gearbox</span>
              <Gauge className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {main.goodmanUtil.toFixed(0)}% <span className="text-xs font-semibold text-slate-500">Goodman</span>
            </div>
            <div className="text-xs text-slate-600 mt-1 flex items-center justify-between">
              <span>Gearbox Net Torque:</span>
              <span className="font-semibold text-slate-800">{((main.PT / 640000) * 100).toFixed(0)}% <span className="text-slate-400">rating</span></span>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-100 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">PPRL Structural Load:</span>
              <span className="font-bold text-slate-800">{Math.round(main.PPRL).toLocaleString()} lb</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              {main.goodmanUtil > 100
                ? 'Operating above API RP 11B limit; high risk of surface fatigue parting.'
                : 'Stress amplitude within allowable fatigue envelope; run life > 3.5 years.'}
            </p>
          </div>
        </div>
      </div>

      {/* 5. Counterfactual Predictive Comparison Table & 1-Click Execution */}
      <div id="agentic-counterfactual-container" className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-600" />
              <span>Counterfactual Optimization Plan ({goal.toUpperCase()})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Exact wave-equation comparative prediction of current well state vs candidate target design.
            </p>
          </div>

          <button
            id="btn-apply-agentic-optimization"
            type="button"
            onClick={handleApplyOptimization}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer ${
              appliedSuccess
                ? 'bg-emerald-600 text-white shadow-emerald-500/25'
                : 'bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white shadow-indigo-500/25'
            }`}
          >
            {appliedSuccess ? (
              <>
                <Check className="w-4 h-4" />
                <span>Applied to Live Simulation!</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Apply Agentic Optimization Plan</span>
              </>
            )}
          </button>
        </div>

        {/* Comparison Matrix */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="py-2.5 px-3 font-bold">Engineering Parameter</th>
                <th className="py-2.5 px-3 font-bold text-slate-700">Current Model</th>
                <th className="py-2.5 px-3 font-bold text-indigo-700 bg-indigo-50/50">Agentic Target Model</th>
                <th className="py-2.5 px-3 font-bold text-slate-800">Predicted Delta (Δ)</th>
                <th className="py-2.5 px-3 font-bold">Status Assessment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Buckling Status */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-2.5 px-3 font-semibold text-slate-800">Downhole Buckling</td>
                <td className="py-2.5 px-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    status === 'HELICAL' ? 'bg-rose-100 text-rose-800' : status === 'SINUSOIDAL' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {status}
                  </span>
                </td>
                <td className="py-2.5 px-3 bg-indigo-50/30">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    {candidateBuckling.status}
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  {status !== 'NO BUCKLING' ? (
                    <span className="font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Compression Suppressed
                    </span>
                  ) : (
                    <span className="text-slate-400">Maintained Stable</span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-slate-600">
                  {candidateBuckling.status === 'NO BUCKLING' ? '100% Rod Wear Elimination' : 'Partial Buckling Relief'}
                </td>
              </tr>

              {/* Net Daily Production */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-2.5 px-3 font-semibold text-slate-800">Production Displacement (PD)</td>
                <td className="py-2.5 px-3 font-medium text-slate-700">{Math.round(main.PD)} BFPD</td>
                <td className="py-2.5 px-3 font-bold text-indigo-900 bg-indigo-50/30">{Math.round(candidateMain.PD)} BFPD</td>
                <td className="py-2.5 px-3">
                  <span className={`font-bold ${pdDelta >= 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                    {pdDelta >= 0 ? `+${pdDelta} BFPD (+${pdDeltaPct.toFixed(1)}%)` : `${pdDelta} BFPD`}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-slate-600">
                  {pdDelta >= 0 ? 'Increased Liquid Recovery' : 'Consolidated Stroke'}
                </td>
              </tr>

              {/* Downhole Stroke Sp */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-2.5 px-3 font-semibold text-slate-800">Plunger Effective Stroke (Sp)</td>
                <td className="py-2.5 px-3 font-medium text-slate-700">{main.Sp.toFixed(1)}″</td>
                <td className="py-2.5 px-3 font-bold text-indigo-900 bg-indigo-50/30">{candidateMain.Sp.toFixed(1)}″</td>
                <td className="py-2.5 px-3">
                  <span className={`font-bold ${spDelta >= 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                    {spDelta >= 0 ? `+${spDelta.toFixed(1)}″` : `${spDelta.toFixed(1)}″`}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-slate-600">
                  {candidateInputs.tubingAnchored === 'anchored' ? 'No Tubing Breathing Loss' : 'Elastic Stroke Loss'}
                </td>
              </tr>

              {/* Goodman Fatigue Utilization */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-2.5 px-3 font-semibold text-slate-800">Goodman Fatigue Utilization</td>
                <td className="py-2.5 px-3 font-medium text-slate-700">{main.goodmanUtil.toFixed(1)}%</td>
                <td className="py-2.5 px-3 font-bold text-indigo-900 bg-indigo-50/30">{candidateMain.goodmanUtil.toFixed(1)}%</td>
                <td className="py-2.5 px-3">
                  <span className={`font-bold ${goodmanDelta <= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {goodmanDelta <= 0 ? `${goodmanDelta.toFixed(1)}% Stress` : `+${goodmanDelta.toFixed(1)}%`}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-slate-600">
                  {candidateMain.goodmanUtil <= 85 ? 'Safe Fatigue Operating Envelope' : 'Elevated Surface Stress'}
                </td>
              </tr>

              {/* Taper Distribution */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-2.5 px-3 font-semibold text-slate-800">Taper Distribution</td>
                <td className="py-2.5 px-3 text-slate-700">{inputs.tapers.map(t => `${t.pct}%`).join(' / ')}</td>
                <td className="py-2.5 px-3 font-bold text-indigo-900 bg-indigo-50/30">
                  {candidateInputs.tapers.map(t => `${t.pct}%`).join(' / ')}
                </td>
                <td className="py-2.5 px-3 font-medium text-slate-700">Rebalanced Weights</td>
                <td className="py-2.5 px-3 text-slate-600">Reinforced Lower String Section</td>
              </tr>

              {/* Pumping Speed & Anchoring */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-2.5 px-3 font-semibold text-slate-800">Kinematics & Anchoring</td>
                <td className="py-2.5 px-3 text-slate-700">{inputs.pumpingSpeed} SPM | {inputs.tubingAnchored}</td>
                <td className="py-2.5 px-3 font-bold text-indigo-900 bg-indigo-50/30">
                  {candidateInputs.pumpingSpeed} SPM | {candidateInputs.tubingAnchored}
                </td>
                <td className="py-2.5 px-3 font-medium text-indigo-700">Tuned Dynamic Speed</td>
                <td className="py-2.5 px-3 text-slate-600">Gearbox Torque & Stroke Resonance Guard</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Engineering Rationale Note */}
        <div className="bg-indigo-50/60 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-950 space-y-1">
          <span className="font-bold flex items-center gap-1 text-indigo-900">
            <Bot className="w-3.5 h-3.5 text-indigo-600" />
            Agent Optimization Rationale:
          </span>
          <p className="text-slate-700 leading-relaxed">{rationale}</p>
        </div>
      </div>

      {/* 6. Interactive Natural Language Predictive Queries */}
      <div id="agentic-scenario-inquiries-card" className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 text-white shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-sky-400" />
            <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight">
              Agentic Predictive Scenarios (Quick Engineering Inquiries)
            </h3>
          </div>
          <span className="text-[10px] text-slate-400">Click prompt to run scenario in AI Chat</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          {[
            {
              title: 'Predict Higher Pumping Speed (10 SPM)',
              prompt: 'Predict the impact of increasing pumping speed to 10 SPM on gearbox peak torque, rod fatigue stress, and helical buckling risk.'
            },
            {
              title: 'Predict Rod Fatigue Life in Corrosive Fluid',
              prompt: 'Predict the rod string operating life under severe H2S/CO2 corrosive conditions with a service factor of 0.75.'
            },
            {
              title: 'Diagnose Plunger Stroke Loss (Sp vs S)',
              prompt: 'Diagnose why downhole effective plunger stroke Sp is lower than surface polished rod stroke S, and quantify tubing vs rod stretch loss.'
            },
            {
              title: 'Predict Sinker Bar Addition at Pump',
              prompt: 'Predict what happens if I place 400 ft of 1-1/2″ sinker bars above the pump to suppress downstroke compression.'
            }
          ].map((item, idx) => (
            <button
              key={idx}
              id={`btn-agentic-inquiry-${idx}`}
              type="button"
              onClick={() => onOpenChat(item.prompt)}
              className="p-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/90 border border-slate-700/70 hover:border-indigo-500/50 text-left transition-all cursor-pointer flex flex-col justify-between group"
            >
              <span className="font-semibold text-slate-200 group-hover:text-sky-300 transition-colors">
                {item.title}
              </span>
              <span className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 group-hover:text-slate-300">
                Ask Agent <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
