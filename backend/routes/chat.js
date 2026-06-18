const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Cascading Gemini Caller (Tries Gemini 2.5 Flash, cascades to Gemini 3.1 Flash Lite)
async function callGeminiCascade(apiKey, options = {}) {
  const { prompt, systemInstruction, history } = options;
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const modelsToTry = ['gemini-2.5-flash', 'gemini-3.1-flash-lite'];
  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      const modelConfig = { model: modelName };
      if (systemInstruction) {
        modelConfig.systemInstruction = systemInstruction;
      }
      
      const model = genAI.getGenerativeModel(modelConfig);
      let responseText = '';

      if (history && history.length > 0) {
        // Map history to Gemini's expected format (role: user/model)
        const geminiHistory = history.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        }));
        const chat = model.startChat({ history: geminiHistory });
        const result = await chat.sendMessage(prompt);
        responseText = result.response.text();
      } else {
        const result = await model.generateContent(prompt);
        responseText = result.response.text();
      }

      console.log(`Gemini Chat successfully resolved by model: ${modelName}`);
      return { text: responseText, modelUsed: modelName };
    } catch (e) {
      console.warn(`Gemini Model ${modelName} failed cascade check:`, e.message);
      lastError = e;
    }
  }

  throw lastError || new Error('All model attempts in cascade failed.');
}

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { message, carbonProfile, history = [] } = req.body;

    if (!carbonProfile) {
      return res.status(400).json({ error: 'carbonProfile is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '' || apiKey === 'YOUR_GEMINI_API_KEY') {
      return res.status(500).json({ error: 'EcoCoach is temporarily unavailable. Please try again.' });
    }

    // System Prompt according to specifications
    const systemPrompt = `You are EcoCoach AI, a professional sustainability coach.

You help users understand, track, predict, and reduce their carbon footprint.

You have access to the user's carbon profile.

Use the profile when relevant.

Answer naturally and conversationally.

Do not use fixed templates.

Do not repeat suggestions.

Do not always provide action plans.

Do not always provide follow-up questions.

Only answer what the user actually asks.

User Carbon Profile:
- Name: ${carbonProfile.name || 'Maharshi Dihora'}
- Annual Carbon Footprint: ${carbonProfile.annualFootprint !== undefined ? carbonProfile.annualFootprint : 0} tonnes CO₂/year
- Energy Emissions: ${carbonProfile.energyEmissions !== undefined ? carbonProfile.energyEmissions : 0} tonnes CO₂/year
- Transportation Emissions: ${carbonProfile.transportEmissions !== undefined ? carbonProfile.transportEmissions : 0} tonnes CO₂/year
- Food Emissions: ${carbonProfile.foodEmissions !== undefined ? carbonProfile.foodEmissions : 0} tonnes CO₂/year
- Shopping Emissions: ${carbonProfile.shoppingEmissions !== undefined ? carbonProfile.shoppingEmissions : 0} tonnes CO₂/year
- Sustainability Score: ${carbonProfile.sustainabilityScore !== undefined ? carbonProfile.sustainabilityScore : 0}/100

Examples:

If user says hello:
Respond naturally.

If user asks about carbon offsets:
Explain offsets.

If user asks for a 30-day plan:
Create a personalized plan.

If user asks what happens if they reduce electricity by 20%:
Perform the calculation using their carbon data.

If user asks to compare EV vs petrol:
Provide a detailed comparison.

Be intelligent, dynamic, and context-aware.

Act like ChatGPT specialized in sustainability.

Please format your response using standard HTML tags (such as <p>, <ul>, <li>, <strong>, <table>, <thead>, <tbody>, <tr>, <th>, <td>, etc.) rather than Markdown so that it renders correctly in the chat UI. Keep it clean and elegant.`;

    // Process history: identify current prompt and history.
    // If the last item of history is the user's new message, slice it off so it isn't duplicated in history and prompt.
    let currentMessage = message || '';
    let pastHistory = [...history];

    if (!currentMessage && pastHistory.length > 0 && pastHistory[pastHistory.length - 1].role === 'user') {
      currentMessage = pastHistory[pastHistory.length - 1].content;
      pastHistory.pop();
    } else if (currentMessage && pastHistory.length > 0 && pastHistory[pastHistory.length - 1].content === currentMessage) {
      pastHistory.pop();
    }

    if (!currentMessage) {
      return res.status(400).json({ error: 'message is required' });
    }

    const result = await callGeminiCascade(apiKey, {
      prompt: currentMessage,
      systemInstruction: systemPrompt,
      history: pastHistory
    });

    res.json({ response: result.text });
  } catch (err) {
    console.error('Chat AI endpoint error:', err);
    res.status(500).json({ error: 'EcoCoach is temporarily unavailable. Please try again.' });
  }
});

module.exports = router;
