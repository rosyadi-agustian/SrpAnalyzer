import React, { useState, useMemo, useEffect } from 'react';
import {
  Compass,
  Gauge,
  Activity,
  Layers,
  Settings2,
  Printer,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronRight,
  BookOpen,
  Bot,
  Menu,
  X,
  Zap,
  Sparkles,
  ShieldCheck,
  Check
} from 'lucide-react';
import {
  RODS,
  TUBING,
  PLUNGERS,
  UNITS,
  GRADES,
  DEFAULT_SURVEY_CSV,
  parseSurveyCSV
} from './data/defaultData';
import { TaperConfig, SimulationResult } from './types';
import { calculateMCMTrajectory } from './engine/mcmTrajectory';
import { calculateDeviatedDesign, computeRodProperties, computeFluidLoad } from './engine/deviatedWaveEq';
import { WellTrajectoryInput } from './components/WellTrajectoryInput';
import { SummaryMetrics } from './components/SummaryMetrics';
import { BucklingDiagnosticPlot } from './components/BucklingDiagnosticPlot';
import { TrajectoryPlot } from './components/TrajectoryPlot';
import { DragAndSideLoadPlot } from './components/DragAndSideLoadPlot';
import { DynamometerPlot } from './components/DynamometerPlot';
import { SmartSidebar, ActiveViewTab } from './components/SmartSidebar';
import { EngineeringChatbot, AugmentationPayload } from './components/EngineeringChatbot';
import { AgenticPredictorDashboard } from './components/AgenticPredictorDashboard';
import { EngineInputs } from './engine/deviatedWaveEq';

export default function App() {
  // 1. Well Data States
  const [pumpDepth, setPumpDepth] = useState<number>(8000);
  const [fluidLevel, setFluidLevel] = useState<number>(8000);
  const [pumpedOff, setPumpedOff] = useState<boolean>(true);
  const [plungerDia, setPlungerDia] = useState<number>(1.50);
  const [densityMode, setDensityMode] = useState<'sg' | 'api'>('sg');
  const [fluidSG, setFluidSG] = useState<number>(0.90);
  const [apiGravity, setApiGravity] = useState<number>(25.7);

  // 2. Operating Conditions
  const [strokeLength, setStrokeLength] = useState<number>(144);
  const [pumpingSpeed, setPumpingSpeed] = useState<number>(8.5);
  const [tubingIndex, setTubingIndex] = useState<number>(1); // 2-7/8"
  const [tubingAnchor, setTubingAnchor] = useState<'anchored' | 'unanchored'>('anchored');

  // 3. Rod String Design
  // High-performance 3-taper string for 8000 ft deviated well
  const [tapers, setTapers] = useState<TaperConfig[]>([
    { sizeIndex: 3, pct: 35.0 }, // 1"
    { sizeIndex: 2, pct: 35.0 }, // 7/8"
    { sizeIndex: 1, pct: 30.0 }  // 3/4"
  ]);

  // 4. Surface Unit & Rod Material
  const [unitId, setUnitId] = useState<string>('C-640D-365-144');
  const [taTc, setTaTc] = useState<number>(1.00);
  const [gradeIndex, setGradeIndex] = useState<number>(1); // Grade D
  const [serviceFactor, setServiceFactor] = useState<number>(0.90);
  const [damping, setDamping] = useState<number>(0.81);

  // 5. Trajectory & Deviated Well Parameters
  const [surveyText, setSurveyText] = useState<string>(DEFAULT_SURVEY_CSV);
  const [muUp, setMuUp] = useState<number>(0.20);
  const [muDown, setMuDown] = useState<number>(0.20);
  const [tubingIdOverride, setTubingIdOverride] = useState<number>(2.441); // 2-7/8" standard ID

  // Active Main Results View Tab (moved from horizontal tabs to Smart Sidebar)
  const [activeTab, setActiveTab] = useState<ActiveViewTab>('AGENTIC');

  // AI Chatbot & Mobile Drawer States
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [chatInitialPrompt, setChatInitialPrompt] = useState<string | undefined>(undefined);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Toast auto-clear
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Parse Trajectory
  const stations = useMemo(() => parseSurveyCSV(surveyText), [surveyText]);
  const trajectory = useMemo(() => calculateMCMTrajectory(stations), [stations]);

  // Handle Density mode change
  const handleDensityModeChange = (mode: 'sg' | 'api') => {
    setDensityMode(mode);
    if (mode === 'api') {
      if (fluidSG > 0) setApiGravity(parseFloat((141.5 / fluidSG - 131.5).toFixed(1)));
    } else {
      if (apiGravity > -131.5) setFluidSG(parseFloat((141.5 / (131.5 + apiGravity)).toFixed(2)));
    }
  };

  // Taper operations
  const handleTaperPctChange = (index: number, val: number) => {
    const updated = [...tapers];
    updated[index].pct = val;
    setTapers(updated);
  };

  const handleTaperSizeChange = (index: number, sizeIdx: number) => {
    const updated = [...tapers];
    updated[index].sizeIndex = sizeIdx;
    setTapers(updated);
  };

  const handleAddTaper = () => {
    if (tapers.length < 5) {
      setTapers([...tapers, { sizeIndex: Math.max(0, tapers[tapers.length - 1].sizeIndex - 1), pct: 0 }]);
    }
  };

  const handleRemoveTaper = (index: number) => {
    if (tapers.length > 1) {
      setTapers(tapers.filter((_, i) => i !== index));
    }
  };

  const totalTaperPct = tapers.reduce((acc, t) => acc + (t.pct || 0), 0);

  // Rod Properties summary preview
  const rodPropsPreview = useMemo(() => {
    if (pumpDepth > 0 && Math.abs(totalTaperPct - 100) < 0.5) {
      return computeRodProperties(tapers, pumpDepth);
    }
    return null;
  }, [tapers, pumpDepth, totalTaperPct]);

  // Pumping unit info
  const selectedUnit = useMemo(() => UNITS.find(u => u.id === unitId), [unitId]);

  // Current Simulation Engine Inputs
  const currentSG = densityMode === 'api' ? 141.5 / (131.5 + apiGravity) : fluidSG;
  const engineInputs: EngineInputs = useMemo(() => ({
    pumpDepth,
    fluidLevel,
    pumpedOff,
    plungerDia,
    fluidSG: currentSG,
    strokeLength,
    pumpingSpeed,
    tubingIndex,
    tubingIdOverride,
    tubingAnchored: tubingAnchor,
    tapers,
    unitId,
    taTc,
    gradeIndex,
    serviceFactor,
    damping,
    muUp,
    muDown,
    trajectory
  }), [
    pumpDepth,
    fluidLevel,
    pumpedOff,
    plungerDia,
    currentSG,
    strokeLength,
    pumpingSpeed,
    tubingIndex,
    tubingIdOverride,
    tubingAnchor,
    tapers,
    unitId,
    taTc,
    gradeIndex,
    serviceFactor,
    damping,
    muUp,
    muDown,
    trajectory
  ]);

  // Execute Simulation
  const result: SimulationResult = useMemo(() => {
    return calculateDeviatedDesign(engineInputs);
  }, [engineInputs]);

  // Reset to Baseline
  const handleResetDefaults = () => {
    setPumpDepth(8000);
    setFluidLevel(8000);
    setPumpedOff(true);
    setPlungerDia(1.50);
    setDensityMode('sg');
    setFluidSG(0.90);
    setApiGravity(25.7);
    setStrokeLength(144);
    setPumpingSpeed(8.5);
    setTubingIndex(1);
    setTubingIdOverride(2.441);
    setTubingAnchor('anchored');
    setUnitId('C-640D-365-144');
    setTaTc(1.00);
    setGradeIndex(1);
    setServiceFactor(0.90);
    setDamping(0.81);
    setMuUp(0.20);
    setMuDown(0.20);
    setSurveyText(DEFAULT_SURVEY_CSV);
    setTapers([
      { sizeIndex: 3, pct: 35.0 },
      { sizeIndex: 2, pct: 35.0 },
      { sizeIndex: 1, pct: 30.0 }
    ]);
    setToastMessage('Reset well design to standard 8,000 ft Permian baseline.');
  };

  // Scenario Presets
  const handleApplyPreset = (preset: string) => {
    if (preset === 'baseline') {
      handleResetDefaults();
    } else if (preset === 'severe-buckling') {
      setPumpDepth(8500);
      setFluidLevel(8500);
      setPumpedOff(true);
      setPlungerDia(1.75);
      setPumpingSpeed(10.5);
      setStrokeLength(168);
      setTubingAnchor('unanchored');
      setMuUp(0.28);
      setMuDown(0.28);
      setTapers([
        { sizeIndex: 3, pct: 55.0 },
        { sizeIndex: 2, pct: 30.0 },
        { sizeIndex: 1, pct: 15.0 }
      ]);
      setToastMessage('Loaded Preset 2: Severe Helical Buckling Scenario (High speed, unanchored, top-heavy string).');
      setActiveTab('BUCKLING');
    } else if (preset === 'shallow-high-volume') {
      setPumpDepth(4500);
      setFluidLevel(4500);
      setPumpedOff(true);
      setPlungerDia(2.25);
      setPumpingSpeed(9.5);
      setStrokeLength(144);
      setTubingIndex(2); // 3-1/2"
      setTubingIdOverride(2.992);
      setTubingAnchor('anchored');
      setMuUp(0.18);
      setMuDown(0.18);
      setTapers([
        { sizeIndex: 3, pct: 50.0 },
        { sizeIndex: 2, pct: 50.0 }
      ]);
      setToastMessage('Loaded Preset 3: Shallow High-Volume Rod Pump (4,500 ft, 2.25″ Plunger, High PD).');
      setActiveTab('DYNA');
    } else if (preset === 'mitigated-taper') {
      setPumpDepth(8000);
      setFluidLevel(8000);
      setPumpedOff(true);
      setPlungerDia(1.50);
      setPumpingSpeed(7.5);
      setStrokeLength(144);
      setTubingAnchor('anchored');
      setMuUp(0.18);
      setMuDown(0.18);
      setTapers([
        { sizeIndex: 3, pct: 25.0 },
        { sizeIndex: 2, pct: 35.0 },
        { sizeIndex: 1, pct: 40.0 }
      ]);
      setToastMessage('Loaded Preset 4: Buckling-Mitigated String (Heavy 40% bottom taper suppresses compression).');
      setActiveTab('BUCKLING');
    }
  };

  // Quick 1-Click Augmentations
  const handleQuickAugment = (action: 'mitigate-buckling' | 'toggle-anchor' | 'tune-speed') => {
    if (action === 'mitigate-buckling') {
      setTapers([
        { sizeIndex: 3, pct: 25.0 },
        { sizeIndex: 2, pct: 35.0 },
        { sizeIndex: 1, pct: 40.0 }
      ]);
      if (pumpingSpeed > 8.0) {
        setPumpingSpeed(7.5);
      }
      setTubingAnchor('anchored');
      setToastMessage('Auto-Mitigate Applied: Rebalanced tapers with heavy 40% bottom section & moderated SPM.');
      setActiveTab('BUCKLING');
    } else if (action === 'toggle-anchor') {
      const nextAnchor = tubingAnchor === 'anchored' ? 'unanchored' : 'anchored';
      setTubingAnchor(nextAnchor);
      setToastMessage(`Tubing anchor toggled to: ${nextAnchor.toUpperCase()} (${nextAnchor === 'anchored' ? 'Zero tubing stretch' : 'Cyclic tubing stretch active'})`);
    } else if (action === 'tune-speed') {
      const newSpeed = pumpingSpeed > 8.0 ? 7.2 : 8.0;
      setPumpingSpeed(newSpeed);
      setToastMessage(`Pumping speed tuned to ${newSpeed} SPM for optimized torque and dynamic stress safety.`);
    }
  };

  // Chatbot Augmentation Callback
  const handleApplyAugmentation = (aug: AugmentationPayload) => {
    if (aug.tapers && aug.tapers.length > 0) {
      setTapers(aug.tapers.map(t => ({ sizeIndex: t.sizeIndex, pct: t.pct })));
    }
    if (aug.pumpingSpeed !== undefined) {
      setPumpingSpeed(aug.pumpingSpeed);
    }
    if (aug.strokeLength !== undefined) {
      setStrokeLength(aug.strokeLength);
    }
    if (aug.plungerDia !== undefined) {
      setPlungerDia(aug.plungerDia);
    }
    if (aug.tubingAnchor) {
      setTubingAnchor(aug.tubingAnchor);
    }
    setToastMessage(aug.summary || 'Applied AI recommendation to simulation model.');
  };

  const handleOpenChat = (prompt?: string) => {
    setChatInitialPrompt(prompt);
    setIsChatOpen(true);
    setMobileSidebarOpen(false);
  };

  // Active module view title
  const activeViewDetails = useMemo(() => {
    switch (activeTab) {
      case 'AGENTIC':
        return {
          title: 'Autonomous Agentic Performance Predictor & Diagnostic',
          subtitle: 'Multi-Objective Lufkin/Gibbs Deviated Well Synthesis & Counterfactual Optimization',
          badge: 'AI AGENT',
          icon: Sparkles
        };
      case 'BUCKLING':
        return {
          title: 'Diagnostic Sucker Rod Buckling & Axial Load Profile',
          subtitle: 'Paslay-Bogy / Lubinski / Gibbs Wave Equation Criteria',
          badge: result.buckling.status,
          icon: Activity
        };
      case 'TRAJECTORY':
        return {
          title: '3D/2D Wellbore Trajectory & Dogleg Severity (MCM)',
          subtitle: 'Minimum Curvature Method Spatial Coordinates',
          badge: 'Spatial MCM',
          icon: Compass
        };
      case 'DRAG':
        return {
          title: 'Rod-Tubing Contact Side Load & Frictional Drag Distribution',
          subtitle: 'Lufkin Normal Contact Force fn & Drag Loads',
          badge: 'Contact fn',
          icon: Layers
        };
      case 'DYNA':
        return {
          title: 'Dynamometer Cards (Wave Equation Surface & Downhole)',
          subtitle: 'Polished Rod Load vs Position Cycles',
          badge: 'Gibbs Dyno',
          icon: Gauge
        };
      case 'INTERMEDIATES':
        return {
          title: 'Equipment Integrity Checks & API RP 11L Data Sheet',
          subtitle: 'Fatigue Stress, Pumping Unit Capacity & Intermediate Parameters',
          badge: 'API Checks',
          icon: BookOpen
        };
    }
  }, [activeTab, result.buckling.status]);

  const ActiveIcon = activeViewDetails.icon;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans antialiased pb-16">
      {/* App Header */}
      <header className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white border-b border-sky-900/50 shadow-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Mobile Sidebar Toggle */}
            <button
              id="btn-toggle-mobile-sidebar"
              type="button"
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              className="xl:hidden p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Toggle Smart Control Hub"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="p-2 bg-sky-600/20 border border-sky-500/30 rounded-xl text-sky-400 shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white m-0">
                  Sucker Rod Pump Designer
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-400/30">
                  Lufkin / Gibbs Deviated Suite
                </span>
              </div>
              <p className="text-[11px] text-slate-300 m-0 hidden sm:block">
                API RP 11L Design & Diagnostic Sucker Rod Buckling Analysis per Jun Xu, Ken Nolen, Dennis Shipp & Sam Gibbs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* AI Assistant Button in Header */}
            <button
              id="btn-header-open-chat"
              type="button"
              onClick={() => handleOpenChat()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5 animate-pulse" />
              <span>AI Engineer</span>
            </button>

            <button
              id="btn-reset-top"
              type="button"
              onClick={handleResetDefaults}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
            <button
              id="btn-print"
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print Report</span>
            </button>
          </div>
        </div>
      </header>

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-3">
          <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{toastMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-emerald-700 hover:text-emerald-950 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-5">
        {/* Mobile Quick-Navigation Strip (Visible on mobile/tablet) */}
        <div className="xl:hidden mb-4 overflow-x-auto no-scrollbar flex items-center gap-1.5 bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('BUCKLING')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'BUCKLING'
                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-rose-600" />
            <span>Buckling</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('TRAJECTORY')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'TRAJECTORY'
                ? 'bg-sky-50 text-sky-800 border border-sky-200'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-sky-600" />
            <span>Trajectory</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('DRAG')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'DRAG'
                ? 'bg-sky-50 text-sky-800 border border-sky-200'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-sky-600" />
            <span>Drag & Side Load</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('DYNA')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'DYNA'
                ? 'bg-sky-50 text-sky-800 border border-sky-200'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Gauge className="w-3.5 h-3.5 text-sky-600" />
            <span>Dynamometer</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('INTERMEDIATES')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'INTERMEDIATES'
                ? 'bg-sky-50 text-sky-800 border border-sky-200'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-slate-600" />
            <span>Equipment Checks</span>
          </button>
        </div>

        {/* 3-Column Desktop Grid / Adaptive 2-Column */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ================= COLUMN 1: SMART SIDEBAR (3 Cols on XL) ================= */}
          <div className="hidden xl:block xl:col-span-3 sticky top-20">
            <SmartSidebar
              activeTab={activeTab}
              onTabChange={setActiveTab}
              result={result}
              onOpenChat={handleOpenChat}
              onApplyPreset={handleApplyPreset}
              onQuickAugment={handleQuickAugment}
              tubingAnchored={tubingAnchor}
              pumpingSpeed={pumpingSpeed}
            />
          </div>

          {/* ================= COLUMN 2: INPUT PANELS (4.5 Cols on XL / 5 Cols on LG) ================= */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-4">
            {/* Card 1: Well Data */}
            <div id="card-well-data" className="card border border-slate-200 bg-white rounded-xl p-4 sm:p-5 shadow-xs">
              <h2 className="text-sm font-semibold text-slate-800 border-b border-slate-100 pb-2.5 mb-3 flex items-center justify-between">
                <span>1 · Well Data</span>
                <span className="text-xs text-slate-400 font-normal">Fluid & Reservoir</span>
              </h2>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label htmlFor="pump-depth-in" className="block text-slate-600 font-medium mb-1">
                    Pump Setting Depth <span className="text-slate-400 font-normal">(ft MD)</span>
                  </label>
                  <input
                    id="pump-depth-in"
                    type="number"
                    min="500"
                    step="100"
                    value={pumpDepth}
                    onChange={(e) => setPumpDepth(parseFloat(e.target.value) || 1000)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 bg-slate-50/50"
                  />
                </div>

                <div>
                  <label htmlFor="fluid-level-in" className="block text-slate-600 font-medium mb-1">
                    Working Fluid Level <span className="text-slate-400 font-normal">(ft)</span>
                  </label>
                  <input
                    id="fluid-level-in"
                    type="number"
                    min="0"
                    step="100"
                    disabled={pumpedOff}
                    value={pumpedOff ? pumpDepth : fluidLevel}
                    onChange={(e) => setFluidLevel(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 bg-slate-50/50 disabled:opacity-50 disabled:bg-slate-100"
                  />
                </div>

                <div className="col-span-2 flex items-center gap-2 pt-1">
                  <input
                    id="pumped-off-check"
                    type="checkbox"
                    checked={pumpedOff}
                    onChange={(e) => setPumpedOff(e.target.checked)}
                    className="rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                  />
                  <label htmlFor="pumped-off-check" className="text-xs text-slate-700 cursor-pointer">
                    Pumped-off condition (working fluid level equals pump depth)
                  </label>
                </div>

                <div>
                  <label htmlFor="plunger-select" className="block text-slate-600 font-medium mb-1">
                    Plunger Diameter <span className="text-slate-400 font-normal">(in)</span>
                  </label>
                  <select
                    id="plunger-select"
                    value={plungerDia}
                    onChange={(e) => setPlungerDia(parseFloat(e.target.value))}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 bg-slate-50/50"
                  >
                    {PLUNGERS.map(d => (
                      <option key={d} value={d}>{d.toFixed(2)}″</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="density-mode-select" className="block text-slate-600 font-medium mb-1">
                    Fluid Density Mode
                  </label>
                  <select
                    id="density-mode-select"
                    value={densityMode}
                    onChange={(e) => handleDensityModeChange(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 bg-slate-50/50"
                  >
                    <option value="sg">Specific Gravity (SG)</option>
                    <option value="api">API Gravity (°API)</option>
                  </select>
                </div>

                <div className="col-span-2">
                  {densityMode === 'sg' ? (
                    <div>
                      <label htmlFor="fluid-sg-in" className="block text-slate-600 font-medium mb-1">
                        Fluid Specific Gravity <span className="text-slate-400 font-normal">(water = 1.0)</span>
                      </label>
                      <input
                        id="fluid-sg-in"
                        type="number"
                        min="0.5"
                        max="1.5"
                        step="0.01"
                        value={fluidSG}
                        onChange={(e) => setFluidSG(parseFloat(e.target.value) || 0.90)}
                        className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 bg-slate-50/50"
                      />
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="fluid-api-in" className="block text-slate-600 font-medium mb-1">
                        API Gravity <span className="text-slate-400 font-normal">(°API)</span>
                      </label>
                      <input
                        id="fluid-api-in"
                        type="number"
                        min="5"
                        max="70"
                        step="0.1"
                        value={apiGravity}
                        onChange={(e) => setApiGravity(parseFloat(e.target.value) || 25.7)}
                        className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 bg-slate-50/50"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Card 2: Operating Conditions */}
            <div id="card-operating-cond" className="card border border-slate-200 bg-white rounded-xl p-4 sm:p-5 shadow-xs">
              <h2 className="text-sm font-semibold text-slate-800 border-b border-slate-100 pb-2.5 mb-3 flex items-center justify-between">
                <span>2 · Operating Conditions</span>
                <span className="text-xs text-slate-400 font-normal">Kinematics & Tubing</span>
              </h2>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label htmlFor="stroke-len-in" className="block text-slate-600 font-medium mb-1">
                    Surface Stroke Length <span className="text-slate-400 font-normal">(in)</span>
                  </label>
                  <input
                    id="stroke-len-in"
                    type="number"
                    min="12"
                    step="1"
                    value={strokeLength}
                    onChange={(e) => setStrokeLength(parseFloat(e.target.value) || 54)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 bg-slate-50/50"
                  />
                </div>

                <div>
                  <label htmlFor="pumping-speed-in" className="block text-slate-600 font-medium mb-1">
                    Pumping Speed <span className="text-slate-400 font-normal">(SPM)</span>
                  </label>
                  <input
                    id="pumping-speed-in"
                    type="number"
                    min="1"
                    max="30"
                    step="0.5"
                    value={pumpingSpeed}
                    onChange={(e) => setPumpingSpeed(parseFloat(e.target.value) || 10)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 bg-slate-50/50"
                  />
                </div>

                <div>
                  <label htmlFor="tubing-size-select" className="block text-slate-600 font-medium mb-1">
                    Tubing Size
                  </label>
                  <select
                    id="tubing-size-select"
                    value={tubingIndex}
                    onChange={(e) => {
                      const idx = parseInt(e.target.value, 10);
                      setTubingIndex(idx);
                      setTubingIdOverride(TUBING[idx].id);
                    }}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 bg-slate-50/50"
                  >
                    {TUBING.map((t, idx) => (
                      <option key={idx} value={idx}>
                        {t.label} (ID {t.id}″)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="tubing-anchor-select" className="block text-slate-600 font-medium mb-1">
                    Tubing Anchor
                  </label>
                  <select
                    id="tubing-anchor-select"
                    value={tubingAnchor}
                    onChange={(e) => setTubingAnchor(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 bg-slate-50/50"
                  >
                    <option value="anchored">Anchored (No stretch)</option>
                    <option value="unanchored">Unanchored (Breathes)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Card 3: Rod String Design */}
            <div id="card-rod-string" className="card border border-slate-200 bg-white rounded-xl p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
                <h2 className="text-sm font-semibold text-slate-800 m-0">
                  3 · Rod String Taper Design
                </h2>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    Math.abs(totalTaperPct - 100) < 0.5
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {totalTaperPct.toFixed(1)}%
                </span>
              </div>

              <div className="space-y-2 mb-3">
                {tapers.map((taper, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={taper.sizeIndex}
                      onChange={(e) => handleTaperSizeChange(idx, parseInt(e.target.value, 10))}
                      className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-slate-50/50"
                    >
                      {RODS.map((r, ri) => (
                        <option key={ri} value={ri}>
                          {r.label} ({r.dia}″ OD, {r.wt} lb/ft)
                        </option>
                      ))}
                    </select>
                    <div className="w-24 relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={taper.pct}
                        onChange={(e) => handleTaperPctChange(idx, parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg text-right pr-6"
                      />
                      <span className="absolute right-2 top-2 text-slate-400 text-xs pointer-events-none">%</span>
                    </div>
                    {tapers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTaper(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title="Remove Taper"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-1 text-xs">
                <button
                  type="button"
                  onClick={handleAddTaper}
                  disabled={tapers.length >= 5}
                  className="px-2.5 py-1 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                >
                  + Add Taper
                </button>

                {rodPropsPreview && (
                  <span className="text-slate-500 font-medium">
                    Total Air Wt: <strong className="text-slate-700">{Math.round(rodPropsPreview.totalWeight).toLocaleString()} lb</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Card 4: Surface Unit & Rod Material */}
            <div id="card-surface-unit" className="card border border-slate-200 bg-white rounded-xl p-4 sm:p-5 shadow-xs">
              <h2 className="text-sm font-semibold text-slate-800 border-b border-slate-100 pb-2.5 mb-3 flex items-center justify-between">
                <span>4 · Surface Unit & Rod Material</span>
                <span className="text-xs text-slate-400 font-normal">API RP 11E / 11B</span>
              </h2>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="col-span-2">
                  <label htmlFor="unit-select" className="block text-slate-600 font-medium mb-1">
                    API Pumping Unit Designation
                  </label>
                  <select
                    id="unit-select"
                    value={unitId}
                    onChange={(e) => setUnitId(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 bg-slate-50/50"
                  >
                    {UNITS.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.id} ({u.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="rod-grade-select" className="block text-slate-600 font-medium mb-1">
                    Rod Material Grade
                  </label>
                  <select
                    id="rod-grade-select"
                    value={gradeIndex}
                    onChange={(e) => setGradeIndex(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 bg-slate-50/50"
                  >
                    {GRADES.map((g, idx) => (
                      <option key={g.id} value={idx}>
                        {g.label} ({g.tensile / 1000} ksi)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="sf-select" className="block text-slate-600 font-medium mb-1">
                    Service Factor (SF)
                  </label>
                  <select
                    id="sf-select"
                    value={serviceFactor}
                    onChange={(e) => setServiceFactor(parseFloat(e.target.value))}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 bg-slate-50/50"
                  >
                    <option value={1.0}>1.00 — Non-corrosive</option>
                    <option value={0.95}>0.95 — Very light corrosion</option>
                    <option value={0.90}>0.90 — Mildly corrosive</option>
                    <option value={0.85}>0.85 — Moderate corrosion</option>
                    <option value={0.80}>0.80 — Corrosive</option>
                    <option value={0.75}>0.75 — Severe corrosion</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="damping-in" className="block text-slate-600 font-medium mb-1">
                    Viscous Damping <span className="text-slate-400 font-normal">c (1/s)</span>
                  </label>
                  <input
                    id="damping-in"
                    type="number"
                    min="0.1"
                    max="2.5"
                    step="0.05"
                    value={damping}
                    onChange={(e) => setDamping(parseFloat(e.target.value) || 0.81)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 bg-slate-50/50"
                  />
                </div>
              </div>
            </div>

            {/* Card 5: Well Trajectory Input Component */}
            <WellTrajectoryInput
              surveyText={surveyText}
              onSurveyTextChange={setSurveyText}
              muUp={muUp}
              onMuUpChange={setMuUp}
              muDown={muDown}
              onMuDownChange={setMuDown}
              tubingId={tubingIdOverride}
              onTubingIdChange={setTubingIdOverride}
              selectedTubingIndex={tubingIndex}
              trajectory={trajectory}
            />
          </div>

          {/* ================= COLUMN 3: RESULTS & DIAGNOSTIC VISUALIZATION (5 Cols on XL / 7 Cols on LG) ================= */}
          <div className="lg:col-span-7 xl:col-span-5 space-y-4">
            {/* Summary Metrics Banner */}
            <SummaryMetrics result={result} />

            {/* Active Module Header */}
            <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-700 shrink-0">
                  <ActiveIcon className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <h3 className="text-xs font-bold text-slate-800 m-0 truncate">
                    {activeViewDetails.title}
                  </h3>
                  <span className="text-[10px] text-slate-400 block -mt-0.5">
                    {activeViewDetails.subtitle}
                  </span>
                </div>
              </div>

              <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                {activeViewDetails.badge}
              </span>
            </div>

            {/* Active Visualizer Plot */}
            {activeTab === 'AGENTIC' && (
              <AgenticPredictorDashboard
                result={result}
                inputs={engineInputs}
                onApplyAugmentation={handleApplyAugmentation}
                onOpenChat={handleOpenChat}
              />
            )}

            {activeTab === 'BUCKLING' && (
              <BucklingDiagnosticPlot buckling={result.buckling} pumpDepth={pumpDepth} />
            )}

            {activeTab === 'TRAJECTORY' && (
              <TrajectoryPlot trajectory={result.trajectory} pumpDepth={pumpDepth} />
            )}

            {activeTab === 'DRAG' && (
              <DragAndSideLoadPlot buckling={result.buckling} pumpDepth={pumpDepth} />
            )}

            {activeTab === 'DYNA' && (
              <DynamometerPlot
                cards={result.cards}
                strokeLength={strokeLength}
                pumpingSpeed={pumpingSpeed}
                taTc={taTc}
              />
            )}

            {activeTab === 'INTERMEDIATES' && (
              <div className="space-y-4">
                {/* Equipment Checks */}
                <div id="card-equipment-checks" className="card border border-slate-200 bg-white rounded-xl p-4 sm:p-5 shadow-xs">
                  <h3 className="text-sm font-semibold text-slate-800 border-b border-slate-100 pb-2 mb-3">
                    API Equipment Capacity & Operational Integrity Checks
                  </h3>
                  <div className="space-y-2.5">
                    {result.checks.map((chk, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border flex items-start gap-2.5 text-xs ${
                          chk.status === 'fail'
                            ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                            : chk.status === 'warn'
                            ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                            : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                        }`}
                      >
                        {chk.status === 'fail' ? (
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        ) : chk.status === 'warn' ? (
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <div className="font-semibold">{chk.title}</div>
                          <div className="text-slate-600 mt-0.5">{chk.text}</div>
                          {chk.util !== undefined && (
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1.5">
                              <div
                                className={`h-full rounded-full ${
                                  chk.util > 100
                                    ? 'bg-rose-600'
                                    : chk.util > 85
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-600'
                                }`}
                                style={{ width: `${Math.min(100, chk.util)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {result.notes.map((note, idx) => (
                      <div
                        key={`note-${idx}`}
                        className="p-2.5 rounded-lg border border-sky-100 bg-sky-50/60 text-sky-900 text-xs flex items-start gap-2"
                      >
                        <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                        <span>{note}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mills Cross Check */}
                <div id="card-mills-check" className="card border border-slate-200 bg-white rounded-xl p-4 sm:p-5 shadow-xs">
                  <h3 className="text-sm font-semibold text-slate-800 border-b border-slate-100 pb-2 mb-3">
                    Cross-Check: Mills Acceleration Factor Closed-Form vs Wave Equation
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
                    <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="text-slate-500 block">Mills PPRL Estimate</span>
                      <span className="font-bold text-slate-800 text-sm">
                        {Math.round(result.mills.PPRL).toLocaleString()} lb
                      </span>
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="text-slate-500 block">Mills MPRL Estimate</span>
                      <span className="font-bold text-slate-800 text-sm">
                        {Math.round(result.mills.MPRL).toLocaleString()} lb
                      </span>
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="text-slate-500 block">Deviated Wave PPRL</span>
                      <span className="font-bold text-sky-800 text-sm">
                        {Math.round(result.main.PPRL).toLocaleString()} lb
                      </span>
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="text-slate-500 block">Acceleration Factor α</span>
                      <span className="font-bold text-slate-800 text-sm">{result.mills.alpha.toFixed(3)}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 m-0">
                    Mills formulation [α = S·N² / 70,500] serves as an API RP 11L verification baseline. In deviated wells, wave equation results incorporate trajectory dogleg drag and contact forces.
                  </p>
                </div>

                {/* Intermediate Parameters Table */}
                <div id="card-intermediate-params" className="card border border-slate-200 bg-white rounded-xl p-4 sm:p-5 shadow-xs">
                  <h3 className="text-sm font-semibold text-slate-800 border-b border-slate-100 pb-2 mb-3">
                    API RP 11L & Lufkin Intermediate Design Parameters
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-1.5 font-medium">Parameter Description</th>
                          <th className="py-1.5 text-right font-medium">Computed Value</th>
                          <th className="py-1.5 text-left font-medium pl-3">Units</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {result.params.map((p, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80">
                            <td className="py-1.5 text-slate-700 font-medium">{p[0]}</td>
                            <td className="py-1.5 text-right font-mono font-semibold text-slate-900">
                              {Math.abs(p[1]) < 10
                                ? p[1].toFixed(3)
                                : Math.round(p[1]).toLocaleString()}
                            </td>
                            <td className="py-1.5 text-slate-400 pl-3">{p[2]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Off-Canvas Mobile Drawer for Smart Sidebar */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 xl:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileSidebarOpen(false)}
          />
          {/* Drawer */}
          <div className="fixed inset-y-0 left-0 max-w-xs w-full bg-white shadow-2xl p-4 overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <span className="font-bold text-sm text-slate-800">Smart Control Hub</span>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <SmartSidebar
              activeTab={activeTab}
              onTabChange={(tab) => {
                setActiveTab(tab);
                setMobileSidebarOpen(false);
              }}
              result={result}
              onOpenChat={handleOpenChat}
              onApplyPreset={(p) => {
                handleApplyPreset(p);
                setMobileSidebarOpen(false);
              }}
              onQuickAugment={(a) => {
                handleQuickAugment(a);
                setMobileSidebarOpen(false);
              }}
              tubingAnchored={tubingAnchor}
              pumpingSpeed={pumpingSpeed}
            />
          </div>
        </div>
      )}

      {/* Floating Action Button for AI Engineering Chatbot */}
      {!isChatOpen && (
        <button
          id="btn-floating-chat"
          type="button"
          onClick={() => handleOpenChat()}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-2xl border border-sky-500/40 hover:scale-105 transition-all cursor-pointer group"
          title="Open AI Petroleum Engineering Diagnostic Assistant"
        >
          <div className="relative">
            <Bot className="w-5 h-5 text-sky-400 group-hover:rotate-12 transition-transform" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400" />
          </div>
          <div className="text-left">
            <span className="text-xs font-bold text-slate-100 block">AI Lift Assistant</span>
            <span className="text-[10px] text-sky-300 block -mt-0.5">Augmentation & Q&A</span>
          </div>
        </button>
      )}

      {/* Engineering Chatbot Modal / Window */}
      <EngineeringChatbot
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        result={result}
        inputs={{
          pumpDepth,
          tubingID: tubingIdOverride,
          plungerDia,
          strokeLength,
          pumpingSpeed,
          fluidLevel,
          spGr: densityMode === 'api' ? 141.5 / (131.5 + apiGravity) : fluidSG,
          tapers,
          tubingAnchored: tubingAnchor,
          rodGrade: GRADES[gradeIndex]?.label || 'Grade D',
          serviceFactor,
        }}
        onApplyAugmentation={handleApplyAugmentation}
        initialPrompt={chatInitialPrompt}
      />

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 text-xs text-slate-400 border-t border-slate-200 mt-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-slate-600 m-0">
              Sucker Rod Pump Designer — Deviated Well Buckling Diagnostic Simulator
            </p>
            <p className="m-0 mt-0.5">
              Formulations: API RP 11L / API RP 11B &bull; Gibbs Damped Wave Equation &bull; Minimum Curvature Method (MCM) &bull; Paslay-Bogy / Lubinski Buckling Criteria &bull; Lufkin Automation (Xu, Nolen, Shipp, Cordova, Gibbs).
            </p>
          </div>
          <div className="text-[11px] text-slate-400">
            Screening & Engineering Diagnostic Tool &bull; Version 2.0 Deviated
          </div>
        </div>
      </footer>
    </div>
  );
}
