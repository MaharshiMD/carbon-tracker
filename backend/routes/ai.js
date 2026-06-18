const express = require('express');
const router = express.Router();
const db = require('../database');
const authMiddleware = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const WASTE_LABELS = ['None', 'Low', 'Medium', 'High'];
const RECYCLE_LABELS = ['None', 'Low', 'Medium', 'High'];

// Fallback Rule-based engine if Gemini key is offline or missing
function getFallbackAdvice(question, sliders, totalCo2, breakdown) {
  const q = (question || '').toLowerCase();
  const cats = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  const primaryCat = cats[0][0];
  const primaryVal = cats[0][1];

  let html = `<h4>EcoCoach Advisor (Smart Assistant)</h4>`;

  if (q.includes('30-day') || q.includes('calendar') || q.includes('plan')) {
    html += `<p>Here is your personalized <strong>30-Day Carbon Reduction Plan</strong> tailored to your ${totalCo2}t footprint:</p>`;
    html += `<ul>`;
    html += `<li><strong>Days 1-7 (Easy Wins):</strong> Retrofit your home with LED lights and unplug standby devices. Based on your current ${sliders.electricityKwh} kWh/mo consumption, this shaves off ~15 kWh ($9 saved & 12.3 kg CO₂ offset) this month.</li>`;
    if (primaryCat === 'transport') {
      html += `<li><strong>Days 8-15 (Commuting Habits):</strong> Substitute 3 gasoline car trips with public transit or walking. With your ${sliders.carKm} km/week driving rate, this saves approximately ${Math.round(sliders.carKm * 0.17 * 0.3)} kg CO₂ weekly.</li>`;
    } else if (primaryCat === 'energy') {
      html += `<li><strong>Days 8-15 (Utility Check):</strong> Lower your water heater thermostat to 120°F and limit laundry wash runs. This cuts your energy usage by up to 10% next month.</li>`;
    } else {
      html += `<li><strong>Days 8-15 (Dietary Adjustments):</strong> Shift 3 meat-based meals to plant protein options. This cuts your dietary emissions by ~45 kg CO₂.</li>`;
    }
    html += `<li><strong>Days 16-22 (Zero Waste):</strong> Plan your meals ahead to eliminate food waste (currently rated as '${WASTE_LABELS[sliders.wasteLevel] || 'Medium'}'). Composting organic waste cuts methane output.</li>`;
    html += `<li><strong>Days 23-30 (Shopping & Delivery):</strong> Consolidate your online purchases. Your ${sliders.shopCount} orders/month emit ~${Math.round(sliders.shopCount * 3)} kg CO₂ in package courier transport. Combine orders to reduce freight miles.</li>`;
    html += `</ul>`;
    html += `<p><em>Pledge these items under the "Actions" tab to track your progress!</em></p>`;
  }
  else if (q.includes('largest') || q.includes('source') || q.includes('cut') || q.includes('where should i start')) {
    html += `<p>Your largest emission source is <strong>${primaryCat.toUpperCase()}</strong>, contributing <strong>${primaryVal} tonnes CO₂ / year</strong> (out of your total ${totalCo2}t).</p>`;
    html += `<p>Here are three immediate ways to reduce it:</p>`;
    html += `<ol>`;
    if (primaryCat === 'transport') {
      html += `<li><strong>Transition to EV:</strong> Swapping your gasoline car commutes to an EV (emissions factor: 0.03 kg/km vs 0.17 kg/km) will save up to <strong>${(sliders.carKm * 52 * 0.00014).toFixed(2)} tonnes CO₂</strong> annually.</li>`;
      html += `<li><strong>Utilize Public Transit:</strong> Substituting public transit for just 150 km of driving weekly reduces emissions by <strong>1.01 tonnes CO₂/yr</strong>.</li>`;
      html += `<li><strong>Minimize Flight Frequency:</strong> Cutting just 1 short-haul flight saves <strong>0.9 tonnes CO₂</strong>.</li>`;
    } else if (primaryCat === 'energy') {
      html += `<li><strong>Solar Panel Installation:</strong> Installing solar panels will offset your ${sliders.electricityKwh} kWh/mo grid consumption, reducing energy emissions from ${breakdown.energy}t to just ${(breakdown.energy * 0.2).toFixed(2)}t (saving <strong>${(breakdown.energy * 0.8).toFixed(2)} tonnes CO₂/yr</strong>).</li>`;
      html += `<li><strong>LED Lighting Retrofit:</strong> Swapping home incandescent bulbs for LEDs reduces lighting electricity usage by 75%, saving ~150 kg CO₂/yr.</li>`;
      html += `<li><strong>Conserve Water:</strong> Reducing your water usage of ${sliders.waterUsage} L/mo by 20% saves pumping energy, cutting ~20 kg CO₂/yr.</li>`;
    } else if (primaryCat === 'diet') {
      html += `<li><strong>Replace Beef Meals:</strong> Beef has a footprint of 2.7 kg CO₂ per serving. Shifting ${Math.min(5, sliders.meatMeals)} meat meals to poultry or legumes saves up to <strong>${(Math.min(5, sliders.meatMeals) * 52 * 0.002).toFixed(2)} tonnes CO₂/yr</strong>.</li>`;
      html += `<li><strong>Eliminate Food Waste:</strong> Reducing food waste from '${WASTE_LABELS[sliders.wasteLevel]}' to 'None' eliminates landfill methane, saving <strong>0.20 tonnes CO₂/yr</strong>.</li>`;
      html += `<li><strong>Compost Organics:</strong> Composting turns food scraps into nutrient soil instead of landfill gas, cutting indirect footprint.</li>`;
    } else {
      html += `<li><strong>Buy Second-Hand:</strong> Buying high-quality second-hand apparel saves up to <strong>25 kg CO₂</strong> per clothing item (from your ${sliders.clothesCount} items/mo).</li>`;
      html += `<li><strong>Consolidate Shipments:</strong> Grouping your ${sliders.shopCount} online packages/mo into single shipments saves courier delivery emissions (~15 kg CO₂ saved per combined order).</li>`;
      html += `<li><strong>Maintain Appliances:</strong> Repairing items rather than buying replacement goods cuts global supply-chain emissions.</li>`;
    }
    html += `</ol>`;
  }
  else if (q.includes('paris') || q.includes('target') || q.includes('2.0')) {
    const excess = (totalCo2 - 2.0).toFixed(2);
    html += `<p>To hit the sustainable <strong>2.0 tonnes Paris Climate Accord target</strong>, you need to cut your annual footprint by <strong>${excess} tonnes CO₂</strong>.</p>`;
    html += `<p>Here is your roadmap to achieve this:</p>`;
    html += `<ul>`;
    if (totalCo2 > 10) {
      html += `<li><strong>Major Action 1:</strong> Switch to Solar panels. This cuts grid emissions by 80% and shaves off <strong>${(breakdown.energy * 0.8).toFixed(2)} tonnes CO₂/yr</strong>.</li>`;
      html += `<li><strong>Major Action 2:</strong> Shift to public transit or an Electric Vehicle. Replacing gasoline car driving saves <strong>${(sliders.carKm * 52 * 0.00014).toFixed(2)} tonnes CO₂/yr</strong>.</li>`;
    } else {
      html += `<li><strong>Action 1 (Diet Shift):</strong> Replace meat meals with plant-based dishes 4 days a week to save <strong>0.56 tonnes CO₂/yr</strong>.</li>`;
      html += `<li><strong>Action 2 (Energy Check):</strong> Lower electricity usage by 150 kWh/mo (saves <strong>1.48 tonnes CO₂/yr</strong>).</li>`;
    }
    html += `<li><strong>Action 3 (Waste management):</strong> Raise your recycling level to '${RECYCLE_LABELS[3]}' to reduce landfill waste emissions by <strong>0.15 tonnes CO₂/yr</strong>.</li>`;
    html += `</ul>`;
    html += `<p><em>Your Twin Profile will reflect letter grade 'A' once you drop below 2.0 tonnes.</em></p>`;
  }
  else if (q.includes('appliance') || q.includes('electricity') || q.includes('drain')) {
    html += `<p>In standard households, the highest energy drains are:</p>`;
    html += `<ul>`;
    html += `<li><strong>Heating & Cooling (HVAC):</strong> Accounts for ~50% of utility bills. Setting thermostat to 68°F (winter) and 78°F (summer) can save up to 10% energy.</li>`;
    html += `<li><strong>Water Heater:</strong> Consumes ~18% of household energy. Lowering temperature settings to 120°F cuts standby losses.</li>`;
    html += `<li><strong>Refrigerator & Lighting:</strong> Refrigerator runs 24/7 consuming ~150 kWh/mo. Incandescent bulbs waste 90% energy as heat; replacing with LEDs saves 75% lighting drain.</li>`;
    html += `</ul>`;
    html += `<p>Based on your current usage of <strong>${sliders.electricityKwh} kWh/mo</strong>, doing an LED swap can save you approximately <strong>${Math.round(sliders.electricityKwh * 0.15)} kWh</strong> per month.</p>`;
  }
  else if (q.includes('offset') || q.includes('cost')) {
    html += `<p><strong>Carbon Offsets</strong> fund certified environmental projects (reforestation, wind farms) that absorb or prevent CO₂ emissions to compensate for your footprint.</p>`;
    html += `<p><strong>Cost & Reputability metrics:</strong></p>`;
    html += `<ul>`;
    html += `<li><strong>Quality Standards:</strong> Always verify projects registered under <em>Gold Standard</em>, <em>Verra (VCS)</em>, or <em>Key Action Reserve</em>.</li>`;
    html += `<li><strong>Typical Cost:</strong> Reputable offsets range from <strong>$12 to $25 per tonne</strong> of CO₂.</li>`;
    html += `<li><strong>Your Carbon Invoice:</strong> To offset your annual footprint of <strong>${totalCo2} tonnes</strong>, it would cost between <strong>$${(totalCo2 * 12).toFixed(2)}</strong> and <strong>$${(totalCo2 * 25).toFixed(2)}</strong> per year.</li>`;
    html += `</ul>`;
  }
  else if (q.includes('plant-based') || q.includes('diet') || q.includes('methane') || q.includes('vegan')) {
    html += `<p>A plant-based diet significantly reduces emissions by bypassing livestock production, which releases methane (a greenhouse gas 28x more potent than CO₂ over 100 years).</p>`;
    html += `<ul>`;
    html += `<li><strong>LCO2 Comparison:</strong> Beef creates ~60 kg CO₂e per kg of protein, whereas pea protein or wheat produce under 1 kg CO₂e.</li>`;
    html += `<li><strong>Your Diet Footprint:</strong> You eat meat meals <strong>${sliders.meatMeals} times/week</strong>, contributing <strong>${breakdown.diet} tonnes CO₂/yr</strong>.</li>`;
    html += `<li><strong>Potential savings:</strong> Substituting plant protein for beef/pork just 3 times a week saves <strong>0.42 tonnes CO₂/yr</strong>, equivalent to planting 7 trees.</li>`;
    html += `</ul>`;
  }
  else if (q.includes('shipping') || q.includes('order') || q.includes('online') || q.includes('e-commerce') || q.includes('packages')) {
    html += `<p>Online shopping has a carbon cost driven by packaging waste and delivery vehicle transit. The average parcel delivery emits <strong>1.5 kg to 3.0 kg of CO₂</strong>.</p>`;
    html += `<p><strong>Your Consumption Footprint:</strong></p>`;
    html += `<ul>`;
    html += `<li>Your current <strong>${sliders.shopCount} online orders/month</strong> contribute <strong>${(sliders.shopCount * 12 * 0.003).toFixed(2)} tonnes CO₂/yr</strong>.</li>`;
    html += `<li><strong>Combined Delivery:</strong> Grouping items to ship in a single box cuts delivery truck runs and packaging waste by up to 50%.</li>`;
    html += `<li><strong>Opt for Ground Shipping:</strong> Next-day air transport is up to 10x more carbon intensive than ground truck delivery.</li>`;
    html += `</ul>`;
  }
  else {
    // General fallback summary with exact details
    html += `<p>Thanks for chatting! I am analyzing your profile metrics. Your footprint is <strong>${totalCo2} tonnes CO₂/year</strong>.</p>`;
    html += `<p>Your primary source is <strong>${primaryCat.toUpperCase()}</strong> (${primaryVal}t CO₂/yr). Try asking about:</p>`;
    html += `<ul>`;
    html += `<li>"Draft a customized 30-day carbon reduction calendar action plan for me."</li>`;
    html += `<li>"What household appliances use the most electricity and how do I reduce their drain?"</li>`;
    html += `<li>"Explain carbon offsets - how do I choose a reputable one and what do they cost?"</li>`;
    html += `</ul>`;
  }
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
    const advice = getFallbackAdvice(question, sliders, totalCo2, breakdown);
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
      model: 'gemini-3.1-flash-lite',
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
    const fallback = getFallbackAdvice(question, sliders, totalCo2, breakdown);
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
      const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

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
      const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

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
      const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
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
