/**
 * RAKSHAK AI – Backend Server
 * Stable + Hackathon Ready
 * Node.js + Gemini (Free Tier) + Twilio
 */

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const twilio = require("twilio");
const rateLimit = require("express-rate-limit");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --------------------------------------------------
// ENV SETUP
// --------------------------------------------------
dotenv.config({ path: path.join(__dirname, "../.env") });

const REQUIRED_ENV = [
  "GEMINI_API_KEY",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_PHONE_NUMBER",
  "EMERGENCY_CONTACT",
];

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`❌ Missing environment variable: ${key}`);
    process.exit(1);
  }
}

// --------------------------------------------------
// APP INIT
// --------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json({ limit: "10kb" }));

// --------------------------------------------------
// RATE LIMITING
// --------------------------------------------------
const analyzeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: "Too many requests, please try again later.",
});

app.use("/analyze", analyzeLimiter);

// --------------------------------------------------
// CLIENTS
// --------------------------------------------------
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ✅ ONLY model that works reliably on free tier
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// --------------------------------------------------
// UTILITIES
// --------------------------------------------------
function sanitizeString(str, maxLength = 100) {
  if (typeof str !== "string") return "";
  return str.replace(/[\n\r<>`"]/g, "").slice(0, maxLength);
}

function extractJSON(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found");
  return JSON.parse(match[0]);
}

async function sendEmergencySMS(severity, summary, location) {
  try {
    await twilioClient.messages.create({
      body: `🚨 RAKSHAK AI ALERT
SEVERITY: ${severity}
LOCATION: ${location}

SUMMARY: ${summary}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.EMERGENCY_CONTACT,
    });

    console.log("📲 Emergency SMS sent");
  } catch (err) {
    console.error("❌ Twilio error:", err.message);
  }
}

// --------------------------------------------------
// ROUTES
// --------------------------------------------------
app.post("/analyze", async (req, res) => {
  try {
    let { impact, speed, tilt, location } = req.body;

    // -------- Validation --------
    if (
      impact === undefined ||
      speed === undefined ||
      tilt === undefined ||
      typeof location !== "string" ||
      location.trim().length === 0
    ) {
      return res.status(400).json({ error: "Invalid sensor data" });
    }

    const impactVal = Number(impact);
    const speedVal = Number(speed);
    const tiltVal = Number(tilt);

    if (![impactVal, speedVal, tiltVal].every(Number.isFinite)) {
      return res.status(400).json({ error: "Sensor values must be numbers" });
    }

    const safeLocation = sanitizeString(location);

    console.log("📩 Sensor data received:", {
      impactVal,
      speedVal,
      tiltVal,
      safeLocation,
    });

    // --------------------------------------------------
    // GEMINI ANALYSIS (WITH FAIL-SAFE)
    // --------------------------------------------------
    let analysis;

    try {
      const prompt = `
You are an accident detection AI.

DATA:
Impact: ${impactVal} G
Speed: ${speedVal} km/h
Tilt: ${tiltVal} degrees
Location: ${safeLocation}

RULES:
- High impact + zero speed = dropped phone (false alarm)
- Moderate impact + speed continues = pothole
- High impact + speed drop + tilt > 45 = serious accident

Return ONLY valid JSON:
{
  "is_accident": true | false,
  "severity": "LOW" | "MEDIUM" | "CRITICAL",
  "summary": "short explanation",
  "action": "Dispatch Ambulance | Log Event | Ignore"
}
`;

      const result = await model.generateContent(prompt);
      const rawText = result.response.text();
      analysis = extractJSON(rawText);

    } catch (aiError) {
      console.error("⚠️ Gemini failed, using fallback");

      // ✅ FALLBACK (DEMO NEVER BREAKS)
      analysis = {
        is_accident: impactVal > 10 && speedVal > 30,
        severity: impactVal > 15 ? "CRITICAL" : "MEDIUM",
        summary: "Fallback rule-based accident detection",
        action: "Dispatch Ambulance",
      };
    }

    console.log("🧠 Analysis:", analysis);

    // --------------------------------------------------
    // EMERGENCY ACTION
    // --------------------------------------------------
    if (
      analysis.is_accident === true &&
      (analysis.severity === "CRITICAL" || analysis.severity === "MEDIUM")
    ) {
      console.log("⚠️ Emergency detected → SMS sent");
      await sendEmergencySMS(
        analysis.severity,
        analysis.summary,
        safeLocation
      );
    } else {
      console.log("✅ No emergency action required");
    }

    res.json({ analysis });

  } catch (err) {
    console.error("❌ Server error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("-----------------------------------------");
  console.log("🚀 RAKSHAK AI BACKEND LIVE");
  console.log(`🔗 http://localhost:${PORT}`);
  console.log("-----------------------------------------");
});