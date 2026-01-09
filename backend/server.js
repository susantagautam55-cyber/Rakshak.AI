/**
 * RAKSHAK AI – Backend Server (FINAL MERGED VERSION)
 * Gemini Hackathon Ready
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
app.use(express.json({ limit: "10kb" })); // protect against large payloads

// --------------------------------------------------
// RATE LIMITING (PROTECT TWILIO & GEMINI)
// --------------------------------------------------
const analyzeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: "Too many analysis requests. Please try again later.",
});

app.use("/analyze", analyzeLimiter);

// --------------------------------------------------
// CLIENTS
// --------------------------------------------------
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
});

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// --------------------------------------------------
// UTIL FUNCTIONS
// --------------------------------------------------
function sanitizeString(str, maxLength = 100) {
  if (typeof str !== "string") return "";
  return str.replace(/[\n\r<>`"]/g, "").slice(0, maxLength);
}

function extractJSON(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in AI response");
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
    console.error("❌ Twilio SMS failed:", err.message);
  }
}

// --------------------------------------------------
// ROUTES
// --------------------------------------------------
app.post("/analyze", async (req, res) => {
  try {
    let { impact, speed, tilt, location } = req.body;

    // ---- Validation ----
    if (
      impact === undefined ||
      speed === undefined ||
      tilt === undefined ||
      typeof location !== "string" ||
      location.trim().length === 0
    ) {
      return res.status(400).json({ error: "Invalid or missing sensor data" });
    }

    const impactVal = Number(impact);
    const speedVal = Number(speed);
    const tiltVal = Number(tilt);

    if (![impactVal, speedVal, tiltVal].every(Number.isFinite)) {
      return res.status(400).json({ error: "Sensor values must be valid numbers" });
    }

    const safeLocation = sanitizeString(location);

    console.log("📩 Sensor data:", {
      impactVal,
      speedVal,
      tiltVal,
      safeLocation,
    });

    // ---- Gemini Prompt ----
    const prompt = `
ACT AS AN EXPERT VEHICLE ACCIDENT ANALYSIS AI.

DATA:
- Impact: ${impactVal} G
- Speed: ${speedVal} km/h
- Tilt: ${tiltVal} degrees
- Location: ${safeLocation}

RULES:
1. High impact + zero speed = dropped phone (FALSE).
2. Moderate impact + speed continues = pothole (FALSE).
3. High impact + speed drop + tilt >45 = CRITICAL accident.

OUTPUT JSON ONLY:
{
  "is_accident": boolean,
  "severity": "LOW" | "MEDIUM" | "CRITICAL",
  "confidence": number,
  "summary": "short explanation",
  "action": "Dispatch Ambulance | Log Event | Ignore"
}
`;

    const result = await model.generateContent(prompt);
    const rawText = result.response.text();

    let analysis;
    try {
      analysis = extractJSON(rawText);
    } catch (err) {
      console.error("❌ AI JSON parse error:", rawText);
      return res.status(500).json({ error: "Malformed AI response" });
    }

    console.log("🧠 Gemini Analysis:", analysis);

    // ---- Emergency Logic ----
    if (
      analysis.is_accident === true &&
      (analysis.severity === "CRITICAL" || analysis.severity === "MEDIUM")
    ) {
      console.log("⚠️ Emergency detected → Sending SMS");
      await sendEmergencySMS(
        analysis.severity,
        analysis.summary,
        safeLocation
      );
    } else {
      console.log("✅ False alarm / low severity");
    }

    res.json({ success: true, data: analysis });

  } catch (err) {
    console.error("❌ Server error:", err.message);
    res.status(500).json({ error: "Internal analysis failure" });
  }
});

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// --------------------------------------------------
// SERVER START
// --------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("-----------------------------------------");
  console.log("🚀 RAKSHAK AI BACKEND LIVE");
  console.log(`🔗 http://localhost:${PORT}`);
  console.log("-----------------------------------------");
});
