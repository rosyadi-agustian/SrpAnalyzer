import React, { useState } from 'react';
import { Compass, FileText, Upload, RefreshCw, AlertCircle } from 'lucide-react';
import { DEFAULT_SURVEY_CSV, parseSurveyCSV, TUBING } from '../data/defaultData';
import { SurveyStation, TrajectoryPoint } from '../types';

interface Props {
  surveyText: string;
  onSurveyTextChange: (val: string) => void;
  muUp: number;
  onMuUpChange: (val: number) => void;
  muDown: number;
  onMuDownChange: (val: number) => void;
  tubingId: number;
  onTubingIdChange: (val: number) => void;
  selectedTubingIndex: number;
  trajectory: TrajectoryPoint[];
}

export const WellTrajectoryInput: React.FC<Props> = ({
  surveyText,
  onSurveyTextChange,
  muUp,
  onMuUpChange,
  muDown,
  onMuDownChange,
  tubingId,
  onTubingIdChange,
  selectedTubingIndex,
  trajectory
}) => {
  const [showRawSurvey, setShowRawSurvey] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        onSurveyTextChange(text);
        setUploadError(null);
      }
    };
    reader.onerror = () => {
      setUploadError('Failed to read trajectory survey file.');
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    onSurveyTextChange(DEFAULT_SURVEY_CSV);
    setUploadError(null);
  };

  // Compute trajectory statistics
  const maxInc = trajectory.length > 0 ? Math.max(...trajectory.map(t => t.inc)) : 0;
  const maxDls = trajectory.length > 0 ? Math.max(...trajectory.map(t => t.dls)) : 0;
  const maxDlsPoint = trajectory.find(t => t.dls === maxDls);
  const totalMd = trajectory.length > 0 ? trajectory[trajectory.length - 1].md : 0;
  const totalTvd = trajectory.length > 0 ? trajectory[trajectory.length - 1].tvd : 0;
  const totalDeparture = trajectory.length > 0
    ? Math.sqrt(
        Math.pow(trajectory[trajectory.length - 1].north, 2) +
        Math.pow(trajectory[trajectory.length - 1].east, 2)
      )
    : 0;

  return (
    <div id="card-trajectory" className="card border border-slate-200 bg-white rounded-xl p-4 sm:p-5 shadow-xs transition-all">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-4">
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2 m-0">
          <Compass className="w-5 h-5 text-sky-700" />
          <span>Well Trajectory & Friction Model (Lufkin/MCM)</span>
        </h2>
        <div className="flex items-center gap-2">
          <button
            id="btn-load-sample-trajectory"
            type="button"
            onClick={handleLoadSample}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors cursor-pointer"
            title="Load default deviated survey data from Jun Xu / Lufkin paper"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Load Sample Trajectory
          </button>
        </div>
      </div>

      {/* Trajectory Quick Stats Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
        <div>
          <span className="text-slate-500 block">Total Depth (MD / TVD)</span>
          <span className="font-semibold text-slate-800 text-sm">
            {Math.round(totalMd).toLocaleString()} ft / {Math.round(totalTvd).toLocaleString()} ft
          </span>
        </div>
        <div>
          <span className="text-slate-500 block">Max Inclination</span>
          <span className="font-semibold text-sky-800 text-sm">{maxInc.toFixed(1)}°</span>
        </div>
        <div>
          <span className="text-slate-500 block">Max Dogleg Severity</span>
          <span className={`font-semibold text-sm ${maxDls > 3 ? 'text-amber-700 font-bold' : 'text-slate-800'}`}>
            {maxDls.toFixed(2)}° / 100 ft
          </span>
          {maxDlsPoint && <span className="text-[10px] text-slate-400 block">@ {Math.round(maxDlsPoint.md)} ft</span>}
        </div>
        <div>
          <span className="text-slate-500 block">Horizontal Departure</span>
          <span className="font-semibold text-slate-800 text-sm">{Math.round(totalDeparture).toLocaleString()} ft</span>
        </div>
      </div>

      {/* Friction & Tubing Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div>
          <label htmlFor="mu-up-input" className="block text-xs font-medium text-slate-600 mb-1">
            Upstroke Friction Coeff (<span className="italic font-serif">μ<sub>u</sub></span>)
          </label>
          <input
            id="mu-up-input"
            type="number"
            min="0.05"
            max="0.60"
            step="0.01"
            value={muUp}
            onChange={(e) => onMuUpChange(parseFloat(e.target.value) || 0.20)}
            className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-slate-50/50"
          />
          <span className="text-[11px] text-slate-400 mt-0.5 block">Standard bare rod: 0.20</span>
        </div>

        <div>
          <label htmlFor="mu-down-input" className="block text-xs font-medium text-slate-600 mb-1">
            Downstroke Friction Coeff (<span className="italic font-serif">μ<sub>d</sub></span>)
          </label>
          <input
            id="mu-down-input"
            type="number"
            min="0.05"
            max="0.60"
            step="0.01"
            value={muDown}
            onChange={(e) => onMuDownChange(parseFloat(e.target.value) || 0.20)}
            className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-slate-50/50"
          />
          <span className="text-[11px] text-slate-400 mt-0.5 block">Exacerbates buckling</span>
        </div>

        <div>
          <label htmlFor="tubing-id-input" className="block text-xs font-medium text-slate-600 mb-1">
            Tubing Inner Diameter (<span className="italic font-serif">d<sub>tubing,ID</sub></span> in)
          </label>
          <input
            id="tubing-id-input"
            type="number"
            min="1.0"
            max="5.0"
            step="0.001"
            value={tubingId}
            onChange={(e) => onTubingIdChange(parseFloat(e.target.value) || TUBING[selectedTubingIndex].id)}
            className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-slate-50/50"
          />
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            Nominal for {TUBING[selectedTubingIndex]?.label || 'selected'}: {TUBING[selectedTubingIndex]?.id} in
          </span>
        </div>
      </div>

      {/* Survey Data Controls & Textarea */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="survey-textarea" className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>Directional Survey Stations (MD, Inclination, Azimuth)</span>
          </label>
          
          <div className="flex items-center gap-2">
            <label
              htmlFor="survey-file-input"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 border border-slate-300 rounded-md cursor-pointer transition-colors shadow-2xs"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>Upload .csv / .txt</span>
              <input
                id="survey-file-input"
                type="file"
                accept=".csv,.txt,.dat"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <button
              type="button"
              onClick={() => setShowRawSurvey(!showRawSurvey)}
              className="text-xs text-sky-700 hover:text-sky-800 underline cursor-pointer"
            >
              {showRawSurvey ? 'Collapse Survey Text' : 'Edit CSV Survey'}
            </button>
          </div>
        </div>

        {uploadError && (
          <div className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 p-2 rounded-md border border-rose-200">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {showRawSurvey && (
          <div className="mt-2">
            <textarea
              id="survey-textarea"
              rows={7}
              value={surveyText}
              onChange={(e) => onSurveyTextChange(e.target.value)}
              placeholder="MD(ft),Inclination(deg),Azimuth(deg)&#10;0,0.0,0.0&#10;1000,2.1,30.0..."
              className="w-full font-mono text-xs p-2.5 border border-slate-300 rounded-lg bg-slate-900 text-emerald-400 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              spellCheck={false}
            />
            <span className="text-[11px] text-slate-400 block mt-1">
              Format: Measured Depth (ft), Inclination (deg), Azimuth (deg) - comma or tab separated.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
