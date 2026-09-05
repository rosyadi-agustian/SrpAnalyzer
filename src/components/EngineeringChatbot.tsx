import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  User,
  Send,
  X,
  Minimize2,
  Maximize2,
  Sparkles,
  Check,
  ArrowRight,
  AlertTriangle,
  RotateCcw,
  Zap,
  HelpCircle,
  Activity,
  Sliders,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { SimulationResult, TaperConfig } from '../types';

export interface AugmentationPayload {
  tapers?: Array<{ sizeIndex: number; pct: number }>;
  pumpingSpeed?: number;
  strokeLength?: number;
  plungerDia?: number;
  tubingAnchor?: 'anchored' | 'unanchored';
  summary?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  augmentation?: AugmentationPayload | null;
  applied?: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  result: SimulationResult;
  inputs: {
    pumpDepth: number;
    tubingID: number;
    plungerDia: number;
    strokeLength: number;
    pumpingSpeed: number;
    fluidLevel: number;
    spGr: number;
    tapers: TaperConfig[];
    tubingAnchored: 'anchored' | 'unanchored';
    rodGrade: string;
    serviceFactor: number;
  };
  onApplyAugmentation: (aug: AugmentationPayload) => void;
  initialPrompt?: string;
}

const COMMON_SHORTCUT_QA = [
  {
    label: 'Diagnose Buckling Root Cause',
    icon: AlertTriangle,
    prompt: 'Why is my rod string buckling and how do I eliminate it?'
  },
  {
    label: 'Augment Taper for Compression',
    icon: Sliders,
    prompt: 'Suggest an optimal rod taper configuration to eliminate downstroke compressive buckling.'
  },
  {
    label: 'Check Gearbox Torque & Goodman',
    icon: Activity,
    prompt: 'Diagnose my pumping unit gearbox torque margin and Goodman stress fatigue envelope.'
  },
  {
    label: 'Analyze DLS Dogleg Wear',
    icon: Sparkles,
    prompt: 'Analyze dogleg severity (DLS) and high side load contact wear zones across this trajectory.'
  },
  {
    label: 'Compare Tubing Anchor Effect',
    icon: Zap,
    prompt: 'How does anchoring the tubing string impact stroke length and downhole pump efficiency?'
  },
  {
    label: 'Interpret Surface & Pump Dyno Cards',
    icon: HelpCircle,
    prompt: 'Explain the difference between the surface dynamometer card and downhole pump card for this well.'
  }
];

export const EngineeringChatbot: React.FC<Props> = ({
  isOpen,
  onClose,
  result,
  inputs,
  onApplyAugmentation,
  initialPrompt,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [appliedAugIds, setAppliedAugIds] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Initialize with greeting if empty
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'msg-init',
          role: 'assistant',
          text: `👋 Hello! I am your **Petroleum Engineering AI Assistant** specializing in API RP 11L / Gibbs Deviated Wave Equation analysis.

I continuously analyze your well model, rod string buckling thresholds, normal contact forces, and dynamometer cards.

You can ask me to **diagnose root causes**, **explain physics**, or **augment well parameters** (e.g. taper percentages, pumping speed, anchor status). Choose a shortcut below or type your question!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    }
  }, []);

  // Handle external trigger with initialPrompt
  useEffect(() => {
    if (initialPrompt && isOpen) {
      sendMessage(initialPrompt);
    }
  }, [initialPrompt, isOpen]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = async (textToSend: string) => {
    const query = textToSend.trim();
    if (!query || isLoading) return;

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Build current context for API
      const context = {
        inputs,
        buckling: {
          status: result.buckling.status,
          neutralPointDepth: result.buckling.neutralPointDepth,
          maxCompression: result.buckling.maxCompression,
          maxCompressionDepth: result.buckling.maxCompressionDepth,
          bucklingDepthRanges: result.buckling.bucklingDepthRanges,
        },
        main: {
          PPRL: result.main.PPRL,
          MPRL: result.main.MPRL,
          PT: result.main.PT,
          PRHP: result.main.PRHP,
          PD: result.main.PD,
          goodmanUtil: result.main.goodmanUtil,
          maxDragUp: result.main.maxDragUp,
          maxDragDown: result.main.maxDragDown,
        },
        trajectoryStats: {
          surveyCount: result.trajectory.length,
          maxDls: result.trajectory.length > 0 ? Math.max(...result.trajectory.map(p => p.dls)) : 0,
        }
      };

      const history = messages.slice(-5).map(m => ({
        role: m.role,
        text: m.text,
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          context,
          history,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        text: data.reply || 'Analysis completed.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        augmentation: data.augmentation || null,
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      console.error('Chatbot error:', err);
      // Fallback message
      setMessages(prev => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          role: 'assistant',
          text: `⚠️ An error occurred while communicating with the diagnostic engine. Current simulation status: **${result.buckling.status}** with peak compression **${Math.round(result.buckling.maxCompression)} lb**. Try one of the quick shortcuts above!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyAugmentation = (msgId: string, aug: AugmentationPayload) => {
    onApplyAugmentation(aug);
    setAppliedAugIds(prev => ({ ...prev, [msgId]: true }));
  };

  if (!isOpen) return null;

  return (
    <div
      id="engineering-chatbot-container"
      className={`fixed z-50 flex flex-col bg-white border border-slate-300 shadow-2xl rounded-2xl overflow-hidden transition-all duration-200 ${
        isMaximized
          ? 'inset-2 sm:inset-6'
          : 'bottom-4 right-4 w-[calc(100vw-2rem)] sm:w-[460px] h-[580px] max-h-[calc(100vh-2rem)]'
      }`}
    >
      {/* Header */}
      <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between select-none">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center shadow-xs">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-100 m-0">SRP AI Diagnostic Assistant</h3>
              <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                Active
              </span>
            </div>
            <p className="text-[10px] text-slate-400 m-0 -mt-0.5">
              Gibbs Deviated Wave Equation & API RP 11L
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-slate-300">
          <button
            type="button"
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title={isMaximized ? 'Restore size' : 'Maximize'}
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
            title="Close chatbot"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Shortcut Q&A Carousel */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 overflow-x-auto no-scrollbar select-none">
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-[10px] uppercase font-bold text-slate-400 mr-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-sky-600" />
            Quick Q&A:
          </span>
          {COMMON_SHORTCUT_QA.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={`qa-${idx}`}
                type="button"
                onClick={() => sendMessage(item.prompt)}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-white hover:bg-sky-50 text-slate-700 hover:text-sky-900 border border-slate-200 hover:border-sky-300 rounded-full transition-all cursor-pointer shadow-2xs disabled:opacity-50"
              >
                <Icon className="w-3 h-3 text-sky-600" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-100/40 text-xs">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[88%] rounded-2xl p-3.5 shadow-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-sky-800 text-white rounded-tr-none'
                  : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
              }`}
            >
              {/* Header inside bubble */}
              <div className="flex items-center gap-1.5 mb-1.5 opacity-75 text-[10px]">
                {msg.role === 'user' ? (
                  <>
                    <User className="w-3 h-3" />
                    <span>Petroleum Engineer</span>
                  </>
                ) : (
                  <>
                    <Bot className="w-3 h-3 text-sky-600" />
                    <span className="font-semibold text-sky-800">AI Lift Specialist</span>
                  </>
                )}
                <span>· {msg.timestamp}</span>
              </div>

              {/* Message text with basic Markdown parsing */}
              <div className="space-y-1.5 whitespace-pre-wrap leading-relaxed font-sans">
                {msg.text.split('\n\n').map((para, pIdx) => {
                  if (para.startsWith('### ')) {
                    return (
                      <h4 key={pIdx} className="font-bold text-slate-900 text-xs mt-2 mb-1 border-b border-slate-200 pb-0.5">
                        {para.replace('### ', '')}
                      </h4>
                    );
                  }
                  if (para.startsWith('#### ')) {
                    return (
                      <h5 key={pIdx} className="font-semibold text-slate-800 text-xs mt-1.5 mb-0.5">
                        {para.replace('#### ', '')}
                      </h5>
                    );
                  }
                  return <p key={pIdx}>{para}</p>;
                })}
              </div>

              {/* Interactive Augmentation Card */}
              {msg.augmentation && (
                <div className="mt-3 p-3 bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-xl text-slate-800 shadow-2xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="inline-flex items-center gap-1.5 font-bold text-sky-900 text-[11px]">
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      Model Augmentation Recommendation
                    </span>
                    {appliedAugIds[msg.id] && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        <Check className="w-3 h-3" /> Applied
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-600 mb-2 font-medium">
                    {msg.augmentation.summary || 'Adjust model parameters based on diagnostic optimization.'}
                  </p>

                  <div className="bg-white/80 p-2 rounded-lg border border-sky-100 mb-2.5 space-y-1 text-[10px] font-mono">
                    {msg.augmentation.tapers && (
                      <div>
                        <strong>Taper Percentages:</strong>{' '}
                        {msg.augmentation.tapers
                          .map(t => `${t.pct}% (idx ${t.sizeIndex})`)
                          .join(' / ')}
                      </div>
                    )}
                    {msg.augmentation.pumpingSpeed !== undefined && (
                      <div>
                        <strong>Pumping Speed:</strong> {msg.augmentation.pumpingSpeed} SPM
                      </div>
                    )}
                    {msg.augmentation.tubingAnchor && (
                      <div>
                        <strong>Tubing Anchor:</strong> {msg.augmentation.tubingAnchor}
                      </div>
                    )}
                    {msg.augmentation.plungerDia !== undefined && (
                      <div>
                        <strong>Plunger Diameter:</strong> {msg.augmentation.plungerDia}″
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={appliedAugIds[msg.id]}
                    onClick={() => handleApplyAugmentation(msg.id, msg.augmentation!)}
                    className={`w-full py-1.5 px-3 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      appliedAugIds[msg.id]
                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                        : 'bg-sky-700 hover:bg-sky-800 text-white shadow-xs hover:shadow'
                    }`}
                  >
                    {appliedAugIds[msg.id] ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Parameters Applied to Simulation</span>
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span>Apply Augmentation to Model</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-slate-500 bg-white p-3 rounded-xl border border-slate-200 max-w-[200px] shadow-2xs">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600" />
            <span className="text-xs font-medium">Computing diagnostics...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(inputValue);
        }}
        className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
      >
        <input
          id="chat-input-text"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask a question or request well augmentation..."
          disabled={isLoading}
          className="flex-1 bg-slate-100 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200 focus:border-sky-500 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all"
        />
        <button
          id="chat-submit-button"
          type="submit"
          disabled={isLoading || !inputValue.trim()}
          className="bg-sky-800 hover:bg-sky-900 disabled:bg-slate-200 text-white disabled:text-slate-400 p-2 rounded-xl transition-all cursor-pointer shadow-xs disabled:cursor-not-allowed"
          title="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
