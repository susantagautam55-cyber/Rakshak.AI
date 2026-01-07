# Rakshak.AI
An IoT-based accident detection system that uses Gemini AI to analyze sensor data, reduce false alarms, and trigger intelligent emergency responses in critical situations.
# Rakshak AI – Intelligent Accident Detection & Emergency Response

**Rakshak AI** is a Gemini-powered emergency intelligence system designed to reduce response times during road accidents. By combining simulated IoT sensor data with Large Language Model (LLM) reasoning, Rakshak AI bridges the critical first 60 seconds after a crash when every second matters.

## 🚀 The Problem
Road accidents often become fatal due to delayed or incorrect emergency responses. Traditional automated systems rely on fixed thresholds (like a simple G-force spike), which often lead to:
* **False Alarms:** Triggering for minor bumps or dropped sensors.
* **Lack of Context:** Not knowing the difference between a high-speed highway crash and a low-speed parking bump.

## 🧠 The Gemini Solution
Rakshak AI uses the **Gemini 1.5 Flash** model as a context-aware "intelligence layer". Instead of simple "if/then" rules, Gemini analyzes patterns across multiple sensor inputs simultaneously:
* **Impact Force** (G-force)
* **Vehicle Speed**
* **Tilt Angle** (detecting rollovers)
* **Location Context**

## 🛠️ How It Works (Backend-First Architecture)
1. **Data Ingestion:** A Node.js backend receives simulated IoT sensor data.
2. **AI Reasoning:** The data is sent to the Gemini API with a structured prompt.
3. **Decision Engine:** Gemini classifies the severity (Low, Medium, or Critical) and filters out false positives.
4. **Action Plan:** The system generates a human-readable emergency plan for dispatchers.

## 💻 Tech Stack
* **AI:** Google Gemini API
* **Runtime:** Node.js
* **Backend Framework:** Express.js
* **Frontend:** HTML/CSS (Live Dashboard)

## 🛠️ Setup Instructions
1. Clone the repository:
   ```bash
   git clone [https://github.com/susantagautam55-cyber/Rakshak.AI]