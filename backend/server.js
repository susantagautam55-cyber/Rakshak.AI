/**
 * RAKSHAK AI – Stable Backend (NO AI DEPENDENCY)
 * Deterministic Accident Detection Engine
 */

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const twilio = require("twilio");

// --------------------------------------------------
// ENV SETUP
// --------------------------------------------------
dotenv.config({ path: path.join(__dirname, "../.env") });

const REQUIRED_ENV = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_PHONE_NUMBER",
  "EMERGENCY_CONTACT",
];

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`❌ Missing env var: ${key}`);
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
// TWILIO
// --------------------------------------------------
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// --------------------------------------------------
// CORE ACCIDENT LOGIC (NO AI)
// --------------------------------------------------
function analyzeAccident({ impact, speed, tilt }) {
  // False alarm
  if (impact < 2 && speed < 5) {
    return {
      is_accident: false,
      severity: "LOW",
      summary: "Minor vibration detected",
      action: "Ignore",
    };
  }

  // Pothole / sudden brake
  if (impact >= 3 && impact < 8 && speed > 20 && tilt < 20) {
    return {
      is_accident: false,
      severity: "LOW",
      summary: "Likely pothole or hard braking",
      action: "Log Event",
    };
  }

  // Medium accident
  if (impact >= 8 && speed >= 40) {
    return {
      is_accident: true,
      severity: "MEDIUM",
      summary: "Possible collision detected",
      action: "Notify Emergency Contact",
    };
  }

  // Severe crash
  if (impact >= 12 && speed >= 60 && tilt >= 45) {
    return {
      is_accident: true,
      severity: "CRITICAL",
      summary: "Severe accident detected",
      action: "Dispatch Ambulance",
    };
  }

  return {
    is_accident: false,
    severity: "LOW",
    summary: "Unclear sensor pattern",
    action: "Log Event",
  };
}

// --------------------------------------------------
// SMS
// --------------------------------------------------
async function sendEmergencySMS(result, location) {
  try {
    await twilioClient.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.EMERGENCY_CONTACT,
      body: `🚨 RAKSHAK AI ALERT

Severity: ${result.severity}
Location: ${location}

${result.summary}`,
    });

    console.log("📲 Emergency SMS sent");
  } catch (err) {
    console.error("❌ SMS failed:", err.message);
  }
}

// --------------------------------------------------
// ROUTES
// --------------------------------------------------
app.post("/analyze", async (req, res) => {
  try {
    const { impact, speed, tilt, location } = req.body;

    if (
      typeof impact !== "number" ||
      typeof speed !== "number" ||
      typeof tilt !== "number" ||
      !location
    ) {
      return res.status(400).json({ error: "Invalid sensor data" });
    }

    console.log("📩 Sensor data received:", req.body);

    const result = analyzeAccident({ impact, speed, tilt });

    console.log("🧠 Analysis result:", result);

    if (result.is_accident && result.severity !== "LOW") {
      await sendEmergencySMS(result, location);
    }

    res.json({ success: true, data: result });

  } catch (err) {
    console.error("❌ Server error:", err.message);
    res.status(500).json({ error: "Internal error" });
  }
});

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
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
