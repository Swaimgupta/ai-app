import express from 'express';
import cors from 'cors';
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

// --- Helper: Call Gemini API ---
async function askGemini(prompt) {
    // Log to confirm key is loaded (only shows first 5 characters for safety)
    console.log("Using API Key starting with:", GEMINI_API_KEY ? GEMINI_API_KEY.substring(0, 5) : "MISSING");

    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    contents: [
      {
        parts: [
          { text: prompt }
        ]
      }
    ]
  })
});

    const json = await response.json();

    if (!response.ok) {
        console.error("GOOGLE API ERROR:", JSON.stringify(json));
        throw new Error(json.error?.message || "Gemini Error");
    }

    // Safety check: Sometimes Gemini blocks responses due to safety filters
    if (!json.candidates || !json.candidates[0] || !json.candidates[0].content) {
        console.error("GEMINI BLOCKED RESPONSE:", JSON.stringify(json));
        throw new Error("Gemini returned an empty or blocked response.");
    }

    return json.candidates[0].content.parts[0].text;
}

// --- Route 1: AI Audit ---
app.post('/api/audit', async (req, res) => {
    try {
        const { dataSample } = req.body;
        const prompt = `Act as a data auditor. Analyze this data: ${JSON.stringify(dataSample.slice(0, 20))}. 
        Find anomalies. Return ONLY a JSON array. No conversational text.
        Format: [{"index": 0, "reason": "description"}]`;

        const rawAiResponse = await askGemini(prompt);
        
        // BETTER CLEANING: Find the first '[' and last ']' to extract JSON safely
        const start = rawAiResponse.indexOf('[');
        const end = rawAiResponse.lastIndexOf(']') + 1;
        const jsonOnly = rawAiResponse.substring(start, end);

        res.json(JSON.parse(jsonOnly));
    } catch (error) {
        console.error("Audit Route Crash:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// --- Route 2: AI Chat ---
app.post('/api/chat', async (req, res) => {
    try {
        const { prompt, contextData } = req.body;
        const fullPrompt = `Context: ${JSON.stringify(contextData?.slice(0, 5))}\n\nUser: ${prompt}`;
        
        const aiText = await askGemini(fullPrompt);
        res.json({ text: aiText });
    } catch (error) {
        console.error("Chat Route Crash:", error.message);
        res.status(500).json({ text: "Error: " + error.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));