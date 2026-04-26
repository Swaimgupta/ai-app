const express = require('express');
const cors = require('cors');
require('./.env').config;

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));


const GEMINI_API_KEY = "AIzaSyCUoclk58KlXlF9ynuF_cSTEZaSABXrHEg";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

async function callGemini(prompt) {
    const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' ,
            'X-goog-api-key': GEMINI_API_KEY
        },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Gemini API error');
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}
app.post('/api/chat', async (req, res) => {
    try {
        const { prompt, contextData } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'prompt is required' });
        }

         const context = Array.isArray(contextData) ? contextData.slice(0, 5) : [];
        const finalPrompt = context.length > 0
            ? `Context Data: ${JSON.stringify(context)}\n\nUser Question: ${prompt}`
            : prompt;

        const text = await callGemini(finalPrompt);
        res.json({ text });


    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/audit', async (req, res) => {
    try {
        const { dataSample } = req.body;

        if (!dataSample || !Array.isArray(dataSample)) {
            return res.status(400).json({ error: 'Valid dataSample is required' });
        }

        const promptMonitor = `
        Act as a Data Quality Auditor.
        Return ONLY a JSON array like:
        [{ "index": 0, "reason": "issue" }]
        
        Data: ${JSON.stringify(dataSample)}
        `;

        const aiResponse = await callGemini(promptMonitor);

        if (!aiResponse) {
            return res.status(500).json({ error: "Empty AI response" });
        }

        const cleaned = aiResponse
            .replace(/```json|```/g, "")
            .trim();

        try {
            const parsed = JSON.parse(cleaned);
            return res.json(parsed);
        } catch (err) {
            console.error("JSON parse failed:", cleaned);
            return res.status(500).json({
                error: 'AI returned invalid JSON',
                raw: cleaned
            });
        }

    } catch (error) {
        console.error("Audit crash:", error);
        res.status(500).json({ error: error.message });
    }
});


app.listen(5000, () => {
    console.log("Server running on port 5000 🚀");
});