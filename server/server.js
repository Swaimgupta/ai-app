const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

// --- Helper: Call Gemini API ---
async function askGemini(prompt) {
    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error?.message || "Gemini Error");
    return json.candidates[0].content.parts[0].text;
}

// --- Route 1: AI Audit ---
app.post('/api/audit', async (req, res) => {
    try {
        const { dataSample } = req.body;
        // We ask Gemini to return ONLY a JSON array
        const prompt = `Act as a data auditor. Analyze this CSV data: ${JSON.stringify(dataSample.slice(0, 20))}. 
        Find potential anomalies or data quality issues. 
        Return ONLY a JSON array of objects with "index" (number) and "reason" (string). 
        Example: [{"index": 0, "reason": "Missing value in email column"}]`;

        const rawAiResponse = await askGemini(prompt);
        // Clean the response (Gemini sometimes adds ```json blocks)
        const cleanedJson = rawAiResponse.replace(/```json|```/g, "");
        res.json(JSON.parse(cleanedJson));
    } catch (error) {
        console.error("Audit Error:", error);
        res.status(500).json({ error: "Failed to audit data" });
    }
});

// --- Route 2: AI Chat ---
app.post('/api/chat', async (req, res) => {
    try {
        const { prompt, contextData } = req.body;
        const fullPrompt = `Context Data: ${JSON.stringify(contextData)}\n\nUser Question: ${prompt}`;
        
        const aiText = await askGemini(fullPrompt);
        res.json({ text: aiText });
    } catch (error) {
        console.error("Chat Error:", error);
        res.status(500).json({ text: "I'm sorry, I encountered an error processing your request." });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));