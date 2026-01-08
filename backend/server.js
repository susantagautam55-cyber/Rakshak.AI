const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');
const twilio = require('twilio');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Clients
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// --- Emergency SMS Function ---
async function sendEmergencySMS(severity, details, location) {
    try {
        const message = await twilioClient.messages.create({
            body: `🚨 RAKSHAK AI ALERT!\nSEVERITY: ${severity}\nLOCATION: ${location}\nAI ANALYSIS: ${details.substring(0, 100)}...`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: process.env.EMERGENCY_CONTACT
        });
        console.log("📲 SMS Sent! SID:", message.sid);
    } catch (error) {
        console.error("❌ Twilio Error:", error.message);
    }
}

// --- Analyze Route ---
app.post('/analyze', async (req, res) => {
    console.log("📩 Received accident data for analysis...");
    
    try {
        const { impact, speed, tilt, location } = req.body;
        
        // Use gemini-1.5-flash for the best balance of speed and cost
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        const prompt = `
            ACT AS AN EMERGENCY RESPONSE AI. 
            DATA: Impact ${impact}G, Speed ${speed}mph, Tilt ${tilt}°. Location: ${location}.
            Analyze if this is a real emergency or a false alarm (e.g., phone dropped).
            Respond with:
            1. SEVERITY: (Low, Medium, or Critical)
            2. SUMMARY: (10 words max)
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        console.log("✅ Analysis complete:", responseText);

        // Logic: Trigger SMS if severity is Medium or Critical
        if (responseText.toUpperCase().includes("CRITICAL") || responseText.toUpperCase().includes("MEDIUM")) {
            console.log("⚠️ High Severity! Sending SMS...");
            await sendEmergencySMS("HIGH", responseText, location);
        }

        res.json({ analysis: responseText });

    } catch (error) {
        console.error("❌ Server Error:", error.message);
        res.status(500).json({ error: "Analysis failed." });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log("-----------------------------------------");
    console.log(`🚀 RAKSHAK AI SERVER IS LIVE`);
    console.log(`🔗 Listening on: http://localhost:${PORT}`);
    console.log("-----------------------------------------");
});