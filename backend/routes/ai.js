const express = require('express');
const router = express.Router();
const db = require('../database');
const authMiddleware = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Fallback Rule-based engine if Gemini key is offline or missing
function getFallbackAdvice(sliders, totalCo2, breakdown) {
  const cats = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  const primaryCat = cats[0][0];
  const primaryVal = cats[0][1];

  let html = `<h4>Local Carbon Advisory (Offline Mode)</h4>`;
  html += `<p>Your estimated annual footprint is <strong>${totalCo2} tonnes CO₂</strong>.</p>`;
  html += `<p>Your primary emissions source is <strong>${primaryCat.toUpperCase()}</strong> (${primaryVal}t CO₂/yr). Here is your automated advice:</p>`;
  html += `<ul>`;

  if (primaryCat === 'transport') {
    html += `<li><strong>Commutes:</strong> Swap driving (${sliders.carKm || 0} km/wk) for public transit to cut up to 45% of transport emissions.</li>`;
    if ((sliders.flightsCount || 0) > 0) {
      html += `<li><strong>Flights:</strong> Cutting one flight this year saves roughly 0.9 tonnes of CO₂.</li>`;
    }
  } else if (primaryCat === 'energy') {
    html += `<li><strong>Grid Energy:</strong> Your electricity consumption (${sliders.electricityKwh || 0} kWh) relies on carbon-heavy grid grids. Consider installing Solar panels.</li>`;
  } else if (primaryCat === 'diet') {
    html += `<li><strong>Diet habits:</strong> Meat meals (${sliders.meatMeals || 0} /wk) emit heavy greenhouse gases. Replace beef or pork with plant-based alternatives.</li>`;
  } else {
    html += `<li><strong>Shopping:</strong> Buying ${sliders.clothesCount || 0} clothing items per month creates manufacturing waste. Try slow-fashion second-hand outlets.</li>`;
  }
  html += `</ul>`;
  return html;
}

// Helper to compile Gemini Multi-modal format
function fileToGenerativePart(buffer, mimeType) {
  return {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType
    },
  };
}

// @route   POST /api/ai/insights
// @desc    Securely query Gemini API with chat history and metrics (EcoCoach)
router.post('/insights', authMiddleware, async (req, res) => {
  const { question, sliders, breakdown, totalCo2, history = [] } = req.body;

  if (!sliders || !breakdown || totalCo2 === undefined) {
    return res.status(400).json({ error: 'Incomplete carbon metrics provided' });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === '' || apiKey === 'YOUR_GEMINI_API_KEY') {
    const advice = getFallbackAdvice(sliders, totalCo2, breakdown);
    return res.json({ response: advice, offline: true });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const systemPrompt = `
You are EcoCoach, a friendly, extremely knowledgeable sustainability bot.
You analyze the user's carbon metrics:
- User: ${req.user.name}
- Total Carbon Footprint: ${totalCo2} tonnes CO₂/yr
- Breakdown: Transport ${breakdown.transport}t, Energy ${breakdown.energy}t, Diet ${breakdown.diet}t, Shopping ${breakdown.shopping}t
- Habits: Drives ${sliders.carKm || 0}km/wk, EV drives ${sliders.evKm || 0}km/wk, Flights ${sliders.flightsCount || 0}/yr, Electricity ${sliders.electricityKwh || 0}kWh/mo, Gas ${sliders.gasCylinders || 0} cylinders/mo, Water ${sliders.waterUsage || 0}L/mo, Meat meals ${sliders.meatMeals || 0}/wk, Food waste ${sliders.wasteLevel || 0}/3, Recycle ${sliders.recycleRatio || 0}/3.

Provide actionable, encouraging, and exact advice based on these numbers. Respond in clean HTML tags (<p>, <ul>, <li>, <strong>). Do not use markdown. Keep details concise and under 3 paragraphs.
`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: systemPrompt
    });

    const geminiHistory = history.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessage(question || 'Give me my top carbon insights.');
    const responseText = result.response.text();
    res.json({ response: responseText, offline: false });
  } catch (err) {
    console.error('Gemini Insights API error:', err);
    const fallback = getFallbackAdvice(sliders, totalCo2, breakdown);
    res.json({ response: `<p style="color:var(--coral);">Gemini error: using fallback report.</p>` + fallback, offline: true });
  }
});

// @route   POST /api/ai/ocr
// @desc    Scan receipt bill text/image and convert to carbon emissions
router.post('/ocr', authMiddleware, async (req, res) => {
  const { fileName, receiptType, base64Image } = req.body;

  if (!receiptType || !fileName) {
    return res.status(400).json({ error: 'fileName and receiptType are required.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  let textResult = '';

  // If Gemini API Key is available and a real image is sent, analyze it
  if (apiKey && apiKey.trim() !== '' && base64Image) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const buffer = Buffer.from(base64Image.split(",")[1], 'base64');
      const imagePart = fileToGenerativePart(buffer, "image/png");

      const prompt = `
Analyze this receipt/bill image. Identify:
1. The type of bill (Fuel, Electricity, Food, Shopping).
2. The primary quantity value (e.g. Litres of fuel, kWh electricity, meat meals count, clothing items).
3. The total monetary cost.
Respond ONLY in JSON format like this:
{ "type": "Electricity", "quantity": 180, "unit": "kWh", "cost": 45.50, "items": ["Grid Electricity Billing"] }
`;

      const result = await model.generateContent([prompt, imagePart]);
      textResult = result.response.text();
    } catch (e) {
      console.error("Gemini OCR error, falling back to mock parser:", e.message);
    }
  }

  // High fidelity OCR parser simulation if offline or key failed
  try {
    let parsedData = {};
    if (textResult) {
      // clean json
      const cleaned = textResult.replace(/```json|```/gi, '').trim();
      parsedData = JSON.parse(cleaned);
    } else {
      // Mock scanner parsing based on selected receipt
      if (receiptType === 'Fuel') {
        parsedData = { type: 'Fuel', quantity: 45, unit: 'litres', cost: 65.00, items: ['Petrol unleaded Octane 95'] };
      } else if (receiptType === 'Electricity') {
        parsedData = { type: 'Electricity', quantity: 280, unit: 'kWh', cost: 42.00, items: ['Residential Grid billing'] };
      } else if (receiptType === 'Food') {
        parsedData = { type: 'Food', quantity: 3, unit: 'meals', cost: 85.00, items: ['Sirloin Beef steak', 'Pork ribs', 'Chicken wings'] };
      } else {
        parsedData = { type: 'Shopping', quantity: 4, unit: 'items', cost: 120.00, items: ['Fast-fashion jacket', 'Polyester trousers', 'Online shipping packaging'] };
      }
    }

    // Convert extracted data into carbon emissions (tonnes)
    let emissions = 0;
    if (parsedData.type === 'Fuel' || receiptType === 'Fuel') {
      emissions = (parsedData.quantity || 45) * 0.0023; // 2.3 kg per litre
    } else if (parsedData.type === 'Electricity' || receiptType === 'Electricity') {
      emissions = (parsedData.quantity || 280) * 0.00082; // 0.82 kg per kWh
    } else if (parsedData.type === 'Food' || receiptType === 'Food') {
      emissions = (parsedData.quantity || 3) * 0.015; // beef/meat meals
    } else {
      emissions = (parsedData.quantity || 4) * 0.012; // Shopping parcels
    }
    emissions = parseFloat(emissions.toFixed(3));

    const receiptRecord = await db.addOCRReceipt(req.user.id, {
      fileName,
      receiptType,
      extractedData: parsedData,
      emissions
    });

    // Automatically add this as a carbon activity item!
    await db.addActivity(req.user.id, {
      date: new Date().toISOString().substring(0, 7),
      type: receiptType.toLowerCase() === 'fuel' ? 'transportation' : receiptType.toLowerCase() === 'electricity' ? 'utilities' : receiptType.toLowerCase(),
      subType: receiptType.toLowerCase() === 'fuel' ? 'car' : receiptType.toLowerCase() === 'electricity' ? 'power' : 'purchase',
      value: parsedData.quantity || 1,
      emissions,
      description: `Scanned Receipt: ${fileName} (${parsedData.cost ? '$' + parsedData.cost : 'Scanned'})`
    });

    res.json({ success: true, record: receiptRecord, parsed: parsedData });
  } catch (err) {
    console.error('Scan OCR error:', err);
    res.status(500).json({ error: 'Server error scanning receipt invoice' });
  }
});

// @route   POST /api/ai/vision
// @desc    Perform image identification & carbon footprint impact estimation (CV Carbon Analyzer)
router.post('/vision', authMiddleware, async (req, res) => {
  const { fileName, itemCategory, base64Image } = req.body;

  if (!itemCategory || !fileName) {
    return res.status(400).json({ error: 'fileName and itemCategory are required.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  let textResult = '';

  if (apiKey && apiKey.trim() !== '' && base64Image) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const buffer = Buffer.from(base64Image.split(",")[1], 'base64');
      const imagePart = fileToGenerativePart(buffer, "image/png");

      const prompt = `
Analyze this picture of an item (${itemCategory}). Identify what object/meal/appliance it is, estimate its lifecycle carbon emissions impact (in kg CO2), and suggest a green alternative.
Respond strictly in JSON format:
{ "identifiedObject": "Object Name", "carbonImpactKg": 12.5, "alternative": "Green Alternative Suggestion", "confidenceScore": 92 }
`;

      const result = await model.generateContent([prompt, imagePart]);
      textResult = result.response.text();
    } catch (e) {
      console.error("Gemini CV error, using mock parser:", e.message);
    }
  }

  try {
    let parsed = {};
    if (textResult) {
      const cleaned = textResult.replace(/```json|```/gi, '').trim();
      parsed = JSON.parse(cleaned);
    } else {
      // Mock computer vision results
      if (itemCategory === 'Meals') {
        parsed = { identifiedObject: 'Double Beef Burger & Fries', carbonImpactKg: 6.8, alternative: 'Plant-based soy burger (saves 85% emissions)', confidenceScore: 94 };
      } else if (itemCategory === 'Vehicles') {
        parsed = { identifiedObject: 'SUV Gasoline Vehicle', carbonImpactKg: 120.0, alternative: 'Electric Vehicle or Train ride (saves 90% emissions)', confidenceScore: 89 };
      } else if (itemCategory === 'Appliances') {
        parsed = { identifiedObject: 'Old Incandescent Refrigerator', carbonImpactKg: 85.0, alternative: 'Energy-star certified model (saves 65% emissions)', confidenceScore: 91 };
      } else if (itemCategory === 'Waste Items') {
        parsed = { identifiedObject: 'Cardboard Shipping Box & Plastic wrappers', carbonImpactKg: 1.2, alternative: 'Recycle cardboard, reuse wrapper packaging (saves 75%)', confidenceScore: 95 };
      } else {
        parsed = { identifiedObject: 'Fast-Fashion Polyester T-shirt', carbonImpactKg: 8.5, alternative: 'Organic Cotton or second-hand thrift clothing (saves 80%)', confidenceScore: 88 };
      }
    }

    // Award 40 XP for uploading vision scans
    await db.updateLeaderboard(req.user.id, req.user.name, 40, 1, 0);

    // Save activity
    await db.addActivity(req.user.id, {
      date: new Date().toISOString().substring(0, 7),
      type: itemCategory === 'Meals' ? 'food' : itemCategory === 'Vehicles' ? 'transportation' : 'shopping',
      subType: itemCategory.toLowerCase().replace(' ', '_'),
      value: 1,
      emissions: parsed.carbonImpactKg * 0.001, // convert kg to tonnes
      description: `CV Carbon Scan: Identified ${parsed.identifiedObject}`
    });

    await db.unlockAchievement(req.user.id, {
      badgeId: 'badge_visionary',
      title: 'Eye of the Twin',
      description: 'Used CV Carbon Analyzer to scan objects and review their lifecycle impact.',
      icon: '👁️'
    });

    res.json({ success: true, parsed });
  } catch (err) {
    console.error('Vision analysis error:', err);
    res.status(500).json({ error: 'Server error performing image recognition' });
  }
});

// @route   GET /api/ai/twin
// @desc    Generate a Digital Carbon Twin description & risk summary
router.get('/twin', authMiddleware, async (req, res) => {
  try {
    const profile = await db.getCarbonProfile(req.user.id);
    
    // Generate AI twin representation status details
    let avatarState = 'healthy_green';
    let summaryText = '';
    
    if (profile.predictedYearly < 2.0) {
      avatarState = 'lush_oasis';
      summaryText = 'Your EcoTwin is thriving in a lush, biodiverse sanctuary. Canopy cover is thick and energy is fully renewable.';
    } else if (profile.predictedYearly < 5.0) {
      avatarState = 'healthy_green';
      summaryText = 'Your EcoTwin has moderate clean air and energy, but small pockets of carbon stress exist in transit nodes.';
    } else if (profile.predictedYearly < 10.0) {
      avatarState = 'carbon_stressed';
      summaryText = 'Your EcoTwin is showing signs of carbon haze. The sky has a faint smoggy tint, and water reserves are dropping.';
    } else {
      avatarState = 'smoggy_industrial';
      summaryText = 'Your EcoTwin is in severe distress. Factory smog blankets the city, forest coverage is dry, and waste heaps are high.';
    }

    res.json({
      profile,
      avatarState,
      avatarSummary: summaryText,
      twinId: `twin_${req.user.id.substring(0, 5)}`
    });
  } catch (err) {
    console.error('Get twin profile error:', err);
    res.status(500).json({ error: 'Server error retrieving twin AI' });
  }
});

// @route   POST /api/ai/future-earth
// @desc    Generate future timeline carbon forecasts for 5, 10, and 20 years
router.post('/future-earth', authMiddleware, async (req, res) => {
  const { currentFootprint } = req.body;
  const fp = Number(currentFootprint) || 5.0;

  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey.trim() !== '' && apiKey !== 'YOUR_GEMINI_API_KEY') {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const prompt = `
Generate a narrative warning / positive projection describing a city environment in 5, 10, and 20 years if a person maintains a carbon footprint of ${fp} tonnes CO2/yr.
Keep descriptions vivid, highlighting forest cover, temperature increases, air quality, and financial strain. Respond strictly in JSON structure:
{
  "y5": "5-year description (2 sentences)",
  "y10": "10-year description (2 sentences)",
  "y20": "20-year description (2 sentences)",
  "globalTempRise": 1.2
}
`;
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const cleaned = text.replace(/```json|```/gi, '').trim();
      return res.json(JSON.parse(cleaned));
    } catch (e) {
      console.error("Gemini Future Earth error, falling back to local simulation:", e.message);
    }
  }

  // Fallback simulator text
  let y5 = '', y10 = '', y20 = '', temp = 1.1;
  if (fp < 2.0) {
    y5 = 'Your city is breathable and vibrant. Clean solar grids have slashed summer cooling costs by 30%.';
    y10 = 'Community parks are extensive. Renewable public transport grids make traffic noise a relic of the past.';
    y20 = 'Local wildlife is returning. Ground-level ozone is negligible, and municipal carbon tax is at zero.';
    temp = 1.1;
  } else if (fp < 6.0) {
    y5 = 'Summer heatwaves feel slightly longer. Air alerts are rare but present during dry weeks.';
    y10 = 'Energy prices have risen by 25% due to carbon taxes. Water conservation drills are held quarterly.';
    y20 = 'Your city has lost 15% of its perimeter tree cover. Seasonal respiratory allergies have doubled.';
    temp = 1.6;
  } else {
    y5 = 'Smog limits visibility to 1km in winter. Carbon taxes drive up utility bills by 40% annually.';
    y10 = 'Severe water rationing is enforced every summer. Forest fires are common in neighbouring hills.';
    y20 = 'Air purifiers are mandatory in all rooms. Summer temperatures routinely cross 45°C with severe heat stroke warnings.';
    temp = 2.4;
  }

  res.json({ y5, y10, y20, globalTempRise: temp });
});

module.exports = router;
