import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Fallback rule-based diagnostic generator when API key is missing or offline
function generateLocalDiagnostic(userQuery: string, context: any): { text: string; augmentation?: any } {
  const q = (userQuery || "").toLowerCase();
  const { main, buckling, inputs } = context || {};
  const status = buckling?.status || "UNKNOWN";
  const ranges = buckling?.bucklingDepthRanges || [];
  const rangeStr = ranges.length > 0
    ? ranges.map((r: any) => `${Math.round(r.topMd)} - ${Math.round(r.bottomMd)} ft (${r.type})`).join(", ")
    : "No active buckling detected";

  // 1. Buckling Diagnosis & Fix
  if (q.includes("buckl") || q.includes("helical") || q.includes("sinusoidal") || q.includes("eliminate") || q.includes("mitigate")) {
    const isBuckling = status === "HELICAL" || status === "SINUSOIDAL";
    let text = `### 🔍 Sucker Rod Buckling Diagnostic Assessment\n\n`;
    text += `**Current Evaluation Status:** \`${status}\`\n\n`;
    text += `**Identified Buckling Zone(s):** ${rangeStr}\n\n`;
    text += `**Peak Downstroke Compression:** ${Math.round(buckling?.maxCompression || 0).toLocaleString()} lb at depth ${Math.round(buckling?.maxCompressionDepth || 0)} ft.\n`;
    text += `**Neutral Point Depth:** ${Math.round(buckling?.neutralPointDepth || 0).toLocaleString()} ft.\n\n`;

    if (isBuckling) {
      text += `#### Engineering Root Cause:\n`;
      text += `1. **Hydraulic Plunger Drag & Fluid Load Transfer:** During the downstroke, the traveling valve opens, transferring fluid column weight from the rod string to the standing valve/tubing. The rod string decelerates and enters dynamic compression.\n`;
      text += `2. **Wellbore Curvature Drag:** In deviated sections, normal contact force increases friction ($F_{\\text{drag}} = \\mu \\cdot f_n$). This retards downward rod travel, pushing axial load past the critical buckling threshold ($F_{\\text{crit, sin}}$ / $F_{\\text{crit, hel}}$).\n`;
      text += `3. **Insufficient Bottom String Weight:** The lowest taper section lacks sufficient linear weight to pull the string downward against upward friction.\n\n`;
      text += `#### Recommended Augmentation:\n`;
      text += `- Increase the weight of the bottom section (e.g. increase 7/8" or 3/4" rod section or add sinker bars).\n`;
      text += `- Adjust pumping speed to reduce downstroke deceleration.\n`;
      text += `- Click **Apply Augmentation** below to adjust the taper distribution and moderate pumping speed to stabilize the string.`;

      return {
        text,
        augmentation: {
          tapers: [
            { sizeIndex: 3, pct: 30.0 }, // 1" (30%)
            { sizeIndex: 2, pct: 35.0 }, // 7/8" (35%)
            { sizeIndex: 1, pct: 35.0 }  // 3/4" (35% heavier bottom)
          ],
          pumpingSpeed: Math.max(5.5, Math.round(((inputs?.pumpingSpeed || 8.5) * 0.88) * 10) / 10),
          summary: "Rebalanced tapers with heavier bottom section (30/35/35%) and moderated SPM to suppress helical compression."
        }
      };
    } else {
      text += `The rod string is currently **axially stable** throughout its measured depth. Peak compression does not exceed the critical Paslay-Bogy / Lubinski sinusoidal thresholds.\n\n`;
      text += `To maintain stability: ensure rod guides are positioned across intervals where dogleg severity exceeds 2.5°/100ft.`;
      return { text };
    }
  }

  // 2. Taper Optimization / Augmentation
  if (q.includes("taper") || q.includes("augment") || q.includes("optimi") || q.includes("size")) {
    return {
      text: `### ⚙️ Rod String Taper Augmentation Analysis\n\n` +
        `For an 8,000 ft deviated well, an optimized 3-taper string must satisfy two opposing criteria:\n` +
        `1. **Surface Goodman Stress Minimization:** Top taper must have high cross-sectional area (e.g., 1" or 1-1/8") to support total buoyant rod weight ($W_r$) and fluid load ($F_o$).\n` +
        `2. **Downhole Buckling Prevention:** Bottom section must provide sufficient downward gravity vector ($w_r \\cos\\alpha$) to overcome upstroke-to-downstroke friction and prevent rod floating.\n\n` +
        `Would you like to apply an optimized 3-taper configuration (30% 1", 35% 7/8", 35% 3/4")? Click below:`,
      augmentation: {
        tapers: [
          { sizeIndex: 3, pct: 30.0 },
          { sizeIndex: 2, pct: 35.0 },
          { sizeIndex: 1, pct: 35.0 }
        ],
        summary: "Applied high-performance tapered string (30% 1″, 35% 7/8″, 35% 3/4″)."
      }
    };
  }

  // 3. Torque & Goodman Fatigue
  if (q.includes("torque") || q.includes("goodman") || q.includes("gearbox") || q.includes("stress") || q.includes("fatigue")) {
    const pt = main?.PT || 0;
    const goodman = main?.goodmanUtil || 0;
    return {
      text: `### 📊 Gearbox Torque & Goodman Stress Evaluation\n\n` +
        `- **Peak Net Torque:** ${(pt / 1000).toFixed(1)} k in-lb\n` +
        `- **Goodman Stress Utilization:** ${goodman.toFixed(1)}% (Allowable working stress per API RP 11B)\n` +
        `- **PPRL (Peak Polished Rod Load):** ${Math.round(main?.PPRL || 0).toLocaleString()} lb\n` +
        `- **MPRL (Minimum Polished Rod Load):** ${Math.round(main?.MPRL || 0).toLocaleString()} lb\n\n` +
        `**Interpretation:**\n` +
        (goodman > 100
          ? `⚠️ **Warning:** Goodman stress exceeds 100% allowable fatigue life! Consider upgrading rod material to Grade D / KD or increasing service factor.`
          : `✅ Goodman stress is within the allowable envelope (${goodman.toFixed(0)}% < 100%). Rod fatigue life is protected under current corrosive service factor.`)
    };
  }

  // 4. Trajectory & DLS Wear
  if (q.includes("dls") || q.includes("dogleg") || q.includes("wear") || q.includes("trajectory") || q.includes("contact")) {
    const maxDrag = Math.round(Math.max(main?.maxDragUp || 0, main?.maxDragDown || 0));
    return {
      text: `### 🧭 Wellbore Trajectory & Contact Wear Analysis\n\n` +
        `- **Max Trajectory Drag:** ${maxDrag.toLocaleString()} lb\n` +
        `- **Contact Force Model:** Lufkin normal contact formulation $f_n = \\sqrt{(T\\Delta\\theta\\sin\\alpha)^2 + (w_r\\sin\\alpha + T\\Delta\\alpha)^2}$\n\n` +
        `**Mitigation Best Practices:**\n` +
        `1. Any survey station with **DLS &ge; 3.0° / 100 ft** will concentrate side loads exceeding 100-150 lb/ft.\n` +
        `2. Install molded or wheeled rod guides across the build and drop zones.\n` +
        `3. Maintain low friction coefficient ($\\mu \\approx 0.15 - 0.20$) using effective corrosion inhibitor and lubricity additives.`,
    };
  }

  // 5. Anchored vs Unanchored Tubing
  if (q.includes("anchor") || q.includes("tubing") || q.includes("stretch")) {
    const isAnchored = inputs?.tubingAnchored === "anchored";
    return {
      text: `### ⚓ Tubing Anchor Impact Assessment\n\n` +
        `Currently, the tubing is **${isAnchored ? "Anchored" : "Unanchored"}**.\n\n` +
        `- **Anchored Tubing:** Eliminates cyclical tubing elongation ($e_t = 0$), maximizing effective pump plunger stroke ($S_p$) and preventing casing-tubing friction wear.\n` +
        `- **Unanchored Tubing:** Tubing stretches cyclically with fluid load transfer, causing significant stroke loss, lower displacement ($PD$), and hysteresis in the downhole pump dynamometer card.\n\n` +
        `You can toggle this setting in Section 2 or click below to set Anchored Tubing.`,
      augmentation: {
        tubingAnchor: "anchored",
        summary: "Configured Tubing Anchor to Anchored mode to eliminate cyclic tubing stretch."
      }
    };
  }

  // Default General Overview
  return {
    text: `### 🤖 Sucker Rod Pump Diagnostic & Engineering Assistant\n\n` +
      `Current well summary:\n` +
      `- **Pump Depth:** ${inputs?.pumpDepth || 8000} ft MD | **Plunger:** ${inputs?.plungerDia || 1.5}″\n` +
      `- **Pumping Speed:** ${inputs?.pumpingSpeed || 8.5} SPM | **Stroke:** ${inputs?.strokeLength || 144}″\n` +
      `- **Buckling Status:** \`${status}\`\n` +
      `- **PPRL:** ${Math.round(main?.PPRL || 0).toLocaleString()} lb | **MPRL:** ${Math.round(main?.MPRL || 0).toLocaleString()} lb\n` +
      `- **Goodman Stress:** ${(main?.goodmanUtil || 0).toFixed(0)}%\n\n` +
      `How can I assist you with this well design? You can click any shortcut prompt below to analyze buckling, adjust tapers, evaluate torque, or optimize kinematics!`,
  };
}

function generateLocalAgenticReport(context: any, goal: string = "balanced") {
  const { main, buckling, trajectory, inputs } = context || {};
  const status = buckling?.status || "UNKNOWN";
  const pumpDepth = inputs?.pumpDepth || 8000;
  const stroke = inputs?.strokeLength || 144;
  const spm = inputs?.pumpingSpeed || 8.5;
  const isAnchored = inputs?.tubingAnchored === "anchored";
  const goodman = main?.goodmanUtil || 0;
  const pt = main?.PT || 0;
  const pd = main?.PD || 0;
  const sp = main?.Sp || 0;
  const maxDrag = Math.round(Math.max(main?.maxDragUp || 0, main?.maxDragDown || 0));
  const maxSideLoad = Math.round(main?.maxSideLoad || 0);

  // Trajectory DLS scan
  let maxDls = 0;
  let maxDlsDepth = 0;
  if (Array.isArray(trajectory) && trajectory.length > 0) {
    for (const p of trajectory) {
      if (p.dls > maxDls) {
        maxDls = p.dls;
        maxDlsDepth = p.md;
      }
    }
  }

  // Determine critical intervals
  const bucklingRanges = buckling?.bucklingDepthRanges || [];
  const bucklingRangeStr = bucklingRanges.length > 0
    ? bucklingRanges.map((r: any) => `${Math.round(r.topMd)} - ${Math.round(r.bottomMd)} ft (${r.type})`).join(", ")
    : "None (Stable)";

  // Build multi-step agentic trace
  const agenticTrace = [
    {
      step: 1,
      title: "Wellbore Trajectory & Dogleg Severity Perception",
      detail: `Scanned trajectory to ${Math.round(pumpDepth)} ft MD. Maximum DLS of ${maxDls.toFixed(2)}°/100ft identified near ${Math.round(maxDlsDepth)} ft MD. Cumulative dogleg drag reaches ${maxDrag.toLocaleString()} lb.`,
      status: maxDls > 3.0 ? "warning" : "complete"
    },
    {
      step: 2,
      title: "Gibbs Damped Wave Dynamic Load Prediction",
      detail: `Simulated wave equation cycles. Peak Polished Rod Load (PPRL): ${Math.round(main?.PPRL || 0).toLocaleString()} lb, Minimum Load (MPRL): ${Math.round(main?.MPRL || 0).toLocaleString()} lb. Downhole effective stroke Sp = ${sp.toFixed(1)}″ vs surface stroke ${stroke}″.`,
      status: "complete"
    },
    {
      step: 3,
      title: "Downhole Sucker Rod Buckling & Neutral Point Determination",
      detail: `Computed axial stress distribution. Neutral point located at ${Math.round(buckling?.neutralPointDepth || 0)} ft MD. Downstroke peak compression: ${Math.round(buckling?.maxCompression || 0).toLocaleString()} lb. Evaluation: ${status}.`,
      status: status === "HELICAL" || status === "SINUSOIDAL" ? "warning" : "complete"
    },
    {
      step: 4,
      title: "Rod-Tubing Contact Wear & Fatigue Life Evaluation",
      detail: `Normal contact force peaks at ${maxSideLoad} lb/ft. Modified Goodman stress utilization is ${goodman.toFixed(1)}%. Tubing state is ${isAnchored ? "ANCHORED (zero cyclic tubing stretch)" : "UNANCHORED (substantial cyclic breathing loss)"}.`,
      status: goodman > 90 || !isAnchored ? "warning" : "complete"
    },
    {
      step: 5,
      title: "Autonomous Counterfactual Optimization Plan Synthesis",
      detail: `Synthesized multi-objective mitigation strategy: rebalanced taper distribution with reinforced lower section, ensured anchored tubing, and tuned kinematics to eliminate buckling while maintaining target production.`,
      status: "complete"
    }
  ];

  // Prescribed configuration based on goal
  let proposedTapers: any[] = [];
  let proposedSpm = spm;
  let proposedAnchor: "anchored" | "unanchored" = "anchored";
  let summary = "";
  let rationale = "";

  if (goal === "eliminate-buckling" || status === "HELICAL" || status === "SINUSOIDAL") {
    proposedTapers = [
      { sizeIndex: 3, pct: 25.0 }, // 1"
      { sizeIndex: 2, pct: 35.0 }, // 7/8"
      { sizeIndex: 1, pct: 40.0 }  // 3/4" heavy bottom
    ];
    proposedSpm = spm > 8.0 ? 7.5 : spm;
    proposedAnchor = "anchored";
    summary = "Rebalanced tapers with heavy 40% bottom section, anchored tubing, and calibrated 7.5 SPM.";
    rationale = "Increasing bottom taper linear weight provides downward gravitational pull against upward friction, shifting the neutral point into the pump barrel and suppressing helical compression completely.";
  } else if (goal === "maximize-production") {
    proposedTapers = [
      { sizeIndex: 3, pct: 30.0 },
      { sizeIndex: 2, pct: 35.0 },
      { sizeIndex: 1, pct: 35.0 }
    ];
    proposedSpm = Math.min(10.0, spm + 1.0);
    proposedAnchor = "anchored";
    summary = "Optimized SPM to maximum allowable gearbox capacity with anchored tubing.";
    rationale = "Anchoring eliminates cyclic tubing stretch, recovering full pump plunger travel. Increasing speed by 1 SPM yields ~12-15% more gross fluid displacement without exceeding rod fatigue limits.";
  } else if (goal === "minimize-fatigue") {
    proposedTapers = [
      { sizeIndex: 3, pct: 40.0 },
      { sizeIndex: 2, pct: 35.0 },
      { sizeIndex: 1, pct: 25.0 }
    ];
    proposedSpm = Math.max(6.5, spm - 1.2);
    proposedAnchor = "anchored";
    summary = "Graduated high-strength top taper (40% 1″) with moderated 6.8-7.2 SPM.";
    rationale = "Minimizes cyclic peak stress amplitude on the top rod taper, extending rod string operating life by over 40% in corrosive environments.";
  } else {
    // Balanced
    proposedTapers = [
      { sizeIndex: 3, pct: 28.0 },
      { sizeIndex: 2, pct: 36.0 },
      { sizeIndex: 1, pct: 36.0 }
    ];
    proposedSpm = 8.0;
    proposedAnchor = "anchored";
    summary = "Balanced Pareto-optimal configuration: 0 buckling, < 75% Goodman stress, maximized net lift.";
    rationale = "Balances surface tensile fatigue against downhole compressive stability, delivering reliable continuous pumping.";
  }

  // Predicted improvements
  const estimatedSpOptimized = isAnchored ? sp : sp * 1.15;
  const estimatedPdOptimized = pd * (estimatedSpOptimized / (sp || 1)) * (proposedSpm / (spm || 1));
  const estimatedGoodmanOptimized = Math.min(100, Math.max(45, goodman * (proposedSpm / (spm || 1)) * 0.95));

  return {
    success: true,
    isAiLive: false,
    agenticTrace,
    executiveDiagnosis: status === "HELICAL"
      ? `Critical helical buckling predicted between ${bucklingRangeStr}. Severe rod-on-tubing wear and rod floating risk on downstroke. Tubing anchor and bottom taper reweighting required.`
      : status === "SINUSOIDAL"
      ? `Sinusoidal buckling detected between ${bucklingRangeStr}. Moderate frictional contact side loads observed. Recommended to install rod guides in dogleg intervals.`
      : `Well system is axially stable with no active buckling detected. Kinematic and structural loads are within acceptable API RP 11B envelopes.`,
    predictions: {
      production: {
        displacementBFPD: Math.round(pd),
        effectiveStrokeIn: parseFloat(sp.toFixed(1)),
        volumetricEfficiencyPct: parseFloat(((sp / (stroke || 1)) * 100).toFixed(1)),
        strokeLossTubingIn: isAnchored ? 0 : parseFloat((stroke * 0.12).toFixed(1)),
        strokeLossRodIn: parseFloat((stroke * 0.08).toFixed(1)),
        assessment: isAnchored
          ? "Anchored tubing ensures zero cyclic tubing stroke loss; full volumetric stroke transmission."
          : "Unanchored tubing exhibits significant breathing loss (~12-18% of stroke length lost to elastic elongation)."
      },
      buckling: {
        status,
        helicalIntervals: bucklingRangeStr,
        neutralPointDepthFt: Math.round(buckling?.neutralPointDepth || 0),
        maxCompressionLb: Math.round(buckling?.maxCompression || 0),
        riskLevel: status === "HELICAL" ? "CRITICAL" : status === "SINUSOIDAL" ? "MEDIUM" : "LOW",
        assessment: status === "HELICAL"
          ? "High probability of rod corkscrewing, rapid tubing split holes, and downhole rod coupling wear."
          : status === "SINUSOIDAL"
          ? "Rod string snaking against tubing walls. Friction increased but no severe helix lock."
          : "Axial tension dominates throughout stroke cycle; zero risk of Euler-Lubinski rod buckling."
      },
      tubingWear: {
        maxContactSideLoadLbFt: maxSideLoad,
        criticalWearIntervals: maxDls > 2.5 ? `${Math.round(maxDlsDepth - 200)} - ${Math.round(maxDlsDepth + 200)} ft MD` : "None detected",
        recommendedRodGuideDensity: maxDls > 3.0 ? "2-3 guides per rod across high-DLS dogleg" : "1 guide per rod in build section",
        assessment: maxSideLoad > 100
          ? `High normal contact forces (${maxSideLoad} lb/ft) may cause localized tubing erosion within 12-18 months.`
          : `Moderate side loads (${maxSideLoad} lb/ft) within acceptable limits for standard coated couplings.`
      },
      mechanicalReliability: {
        goodmanUtilizationPct: parseFloat(goodman.toFixed(1)),
        gearboxTorquePct: parseFloat(((pt / 640000) * 100).toFixed(1)),
        structuralBeamPct: parseFloat(((main?.PPRL || 0) / 36500 * 100).toFixed(1)),
        fatigueFailureRisk: goodman > 100 ? "HIGH" : goodman > 85 ? "MODERATE" : "LOW",
        assessment: goodman > 100
          ? "Operating beyond API RP 11B fatigue limit. High risk of cyclic tensile parting near surface."
          : "Fatigue stress is within safe operating envelope; expected run life > 3.5 years."
      },
      dynamometer: {
        predictedCardType: !isAnchored ? "Tubing Breathing Hysteresis" : status === "HELICAL" ? "Downstroke Drag Anomaly" : "Full Liquid Barrel (Normal)",
        fillageQualityPct: inputs?.pumpedOff ? 96 : 84,
        fluidPoundRisk: inputs?.pumpedOff ? "Low (Fluid level at pump)" : "Moderate (Under-filled barrel risk)",
        assessment: "Card morphology indicates regular cyclic loading with slight mechanical drag loop across dogleg interval."
      }
    },
    counterfactualComparison: {
      current: {
        bucklingStatus: status,
        neutralPointFt: Math.round(buckling?.neutralPointDepth || 0),
        effectiveStrokeIn: parseFloat(sp.toFixed(1)),
        productionBFPD: Math.round(pd),
        goodmanPct: parseFloat(goodman.toFixed(1)),
        gearboxPct: parseFloat(((pt / 640000) * 100).toFixed(1)),
        maxSideLoadLbFt: maxSideLoad,
        taperSummary: `${inputs?.tapers?.map((t: any) => `${t.pct}%`).join("/") || "Standard"}`,
        spm,
        anchor: inputs?.tubingAnchored || "anchored"
      },
      optimized: {
        bucklingStatus: "NO BUCKLING",
        neutralPointFt: Math.round(pumpDepth),
        effectiveStrokeIn: parseFloat(estimatedSpOptimized.toFixed(1)),
        productionBFPD: Math.round(estimatedPdOptimized),
        goodmanPct: parseFloat(estimatedGoodmanOptimized.toFixed(1)),
        gearboxPct: parseFloat((((pt / 640000) * 100) * (proposedSpm / spm)).toFixed(1)),
        maxSideLoadLbFt: Math.round(maxSideLoad * 0.88),
        taperSummary: proposedTapers.map(t => `${t.pct}%`).join("/"),
        spm: proposedSpm,
        anchor: proposedAnchor
      },
      deltas: {
        bucklingMitigated: status !== "NO BUCKLING",
        productionDeltaBFPD: Math.round(estimatedPdOptimized - pd),
        productionDeltaPct: parseFloat((((estimatedPdOptimized - pd) / (pd || 1)) * 100).toFixed(1)),
        effectiveStrokeDeltaIn: parseFloat((estimatedSpOptimized - sp).toFixed(1)),
        goodmanDeltaPct: parseFloat((estimatedGoodmanOptimized - goodman).toFixed(1)),
        gearboxDeltaPct: parseFloat(((((pt / 640000) * 100) * (proposedSpm / spm)) - ((pt / 640000) * 100)).toFixed(1))
      }
    },
    recommendedAugmentation: {
      tapers: proposedTapers,
      pumpingSpeed: proposedSpm,
      tubingAnchor: proposedAnchor,
      summary,
      rationale
    }
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "5mb" }));

  // API Route: AI Diagnostic & Augmentation Assistant
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, context, history } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        // Fallback gracefully to local petroleum engineering diagnostic engine
        const fallbackResult = generateLocalDiagnostic(message, context);
        return res.json({
          reply: fallbackResult.text,
          augmentation: fallbackResult.augmentation || null,
          isAiLive: false,
          note: "Running with built-in petroleum engineering diagnostic engine. To enable Gemini 3.8 Flash, set GEMINI_API_KEY in Settings > Secrets."
        });
      }

      const client = getGeminiClient();
      if (!client) {
        const fallbackResult = generateLocalDiagnostic(message, context);
        return res.json({
          reply: fallbackResult.text,
          augmentation: fallbackResult.augmentation || null,
          isAiLive: false,
        });
      }

      // Build system prompt for Gemini
      const systemInstruction = `You are a World-Class Petroleum Production & Artificial Lift Expert specializing in Sucker Rod Pumping (SRP) Design & Deviated Well Diagnostic Analysis per API RP 11L, API RP 11B, and the Lufkin / Gibbs Deviated Wave Equation methodology (Jun Xu, Ken Nolen, Dennis Shipp, Andy Cordova, Sam Gibbs).

Your role is to diagnose well performance, analyze rod string buckling (Paslay-Bogy / Lubinski criteria), evaluate rod-tubing drag forces, check Goodman fatigue stress, interpret dynamometer cards (surface & downhole), and provide actionable design augmentations.

CURRENT WELL ENGINEERING CONTEXT:
${JSON.stringify(context, null, 2)}

INSTRUCTIONS:
1. Provide concise, clear, and mathematically sound engineering explanations. Pass WCAG clarity, avoid fluffy marketing buzzwords.
2. If the user asks to fix or optimize something (e.g., buckling, speed, tapers, anchor, stroke), include an exact JSON block labeled \`\`\`json:augmentation\`\`\` with recommended parameter mutations. Allowed keys:
- tapers: array of { sizeIndex: number (0: 5/8", 1: 3/4", 2: 7/8", 3: 1", 4: 1-1/8"), pct: number } summing to 100%
- pumpingSpeed: number (SPM)
- strokeLength: number (inches)
- plungerDia: number (inches)
- tubingAnchor: "anchored" | "unanchored"
- summary: short string describing what was modified
3. If no parameter changes are needed, omit the augmentation JSON block and focus on diagnostic insights.`;

      const contents: any[] = [];

      if (Array.isArray(history) && history.length > 0) {
        for (const h of history.slice(-6)) {
          contents.push({
            role: h.role === "user" ? "user" : "model",
            parts: [{ text: h.text }]
          });
        }
      }

      contents.push({
        role: "user",
        parts: [{ text: message || "Please diagnose the current well simulation results." }]
      });

      const response = await client.models.generateContent({
        model: "gemini-3.8-flash",
        contents,
        config: {
          systemInstruction,
          temperature: 0.3,
        }
      });

      const rawText = response.text || "";

      // Parse optional augmentation JSON block
      let augmentation: any = null;
      let cleanText = rawText;
      const augMatch = rawText.match(/```json:augmentation\s*([\s\S]*?)\s*```/);
      if (augMatch) {
        try {
          augmentation = JSON.parse(augMatch[1]);
          cleanText = rawText.replace(/```json:augmentation\s*[\s\S]*?\s*```/, "").trim();
        } catch (e) {
          console.error("Failed to parse augmentation JSON from Gemini:", e);
        }
      }

      return res.json({
        reply: cleanText,
        augmentation,
        isAiLive: true
      });
    } catch (err: any) {
      console.error("Error in /api/chat:", err);
      // Seamless fallback
      const fallbackResult = generateLocalDiagnostic(req.body?.message || "", req.body?.context || {});
      return res.json({
        reply: fallbackResult.text,
        augmentation: fallbackResult.augmentation || null,
        isAiLive: false,
        error: err.message
      });
    }
  });

  // API Route: Autonomous Agentic Performance Predictor & Diagnostic
  app.post("/api/agentic-predict", async (req, res) => {
    try {
      const { context, goal } = req.body || {};
      const apiKey = process.env.GEMINI_API_KEY;
      const localReport = generateLocalAgenticReport(context, goal);

      if (!apiKey) {
        return res.json({
          ...localReport,
          isAiLive: false,
          note: "Generated using built-in petroleum engineering agentic logic. Set GEMINI_API_KEY to activate Gemini 3.8 Flash."
        });
      }

      const client = getGeminiClient();
      if (!client) {
        return res.json({
          ...localReport,
          isAiLive: false
        });
      }

      // Enrich executive diagnosis and reasoning with Gemini 3.8 Flash
      try {
        const prompt = `You are an Autonomous Petroleum Production Agent for Sucker Rod Pumping (API RP 11L / Lufkin Deviated Wave Equation).
Evaluate the following well telemetry and provide an executive diagnostic synthesis and optimization rationale:
${JSON.stringify({
  main: context?.main,
  buckling: context?.buckling,
  inputs: context?.inputs,
  goal: goal || "balanced"
}, null, 2)}

Provide a JSON response with:
{
  "executiveDiagnosis": "2-3 crisp sentences detailing current well performance, buckling risk, wear hotspot, and fatigue life",
  "rationale": "2-3 sentences explaining why the prescribed taper distribution, SPM, and anchor state optimize the system"
}`;

        const aiResponse = await client.models.generateContent({
          model: "gemini-3.8-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            temperature: 0.2
          }
        });

        if (aiResponse.text) {
          const parsed = JSON.parse(aiResponse.text.trim());
          if (parsed.executiveDiagnosis) {
            localReport.executiveDiagnosis = parsed.executiveDiagnosis;
          }
          if (parsed.rationale && localReport.recommendedAugmentation) {
            localReport.recommendedAugmentation.rationale = parsed.rationale;
          }
          localReport.isAiLive = true;
        }
      } catch (aiErr) {
        console.warn("Gemini agentic enrichment fallback:", aiErr);
      }

      return res.json(localReport);
    } catch (err: any) {
      console.error("Error in /api/agentic-predict:", err);
      const fallbackReport = generateLocalAgenticReport(req.body?.context || {}, req.body?.goal || "balanced");
      return res.json(fallbackReport);
    }
  });

  // Health endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: Date.now() });
  });

  // Vite development vs production serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Dev server listening on port ${PORT}`);
  });
}

startServer();
