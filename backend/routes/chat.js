const express = require('express');
const router = express.Router();
const db = require('../database');
const authMiddleware = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const WASTE_LABELS = ['None', 'Low', 'Medium', 'High'];
const RECYCLE_LABELS = ['None', 'Low', 'Medium', 'High'];

function getFallbackAdvice(question, sliders, totalCo2, breakdown) {
  const q = (question || '').toLowerCase();
  const cats = Object.entries(breakdown || {}).sort((a, b) => b[1] - a[1]);
  const primaryCat = cats.length > 0 ? cats[0][0] : 'energy';
  const primaryVal = cats.length > 0 ? cats[0][1] : 0;

  const carKm = sliders.carKm || 150;
  const electricityKwh = sliders.electricityKwh || 250;
  const meatMeals = sliders.meatMeals || 7;
  const shopCount = sliders.shopCount || 5;
  const recycleRatio = sliders.recycleRatio || 1;

  let html = '';

  if (q.includes('30-day') || q.includes('7-day') || q.includes('90-day') || q.includes('calendar') || q.includes('plan')) {
    html += `<h4>EcoCoach 30-Day Calendar Action Plan</h4>`;
    html += `<p>Based on your carbon footprint of <strong>${totalCo2} tonnes CO₂/year</strong>, here is a custom plan:</p>`;
    html += `<ul>`;
    html += `<li><strong>Days 1-7:</strong> Swap incandescent bulbs to LEDs. Saves ~15% on lighting bills. (Saves ~${Math.round(electricityKwh * 0.15)} kWh/mo, offsets 150 kg CO₂/yr).</li>`;
    if (primaryCat === 'transport') {
      html += `<li><strong>Days 8-15:</strong> Substitute 3 gasoline trips with public transit. Reduces car driving (emissions: 0.17 kg/km). Savings: ~${Math.round(carKm * 52 * 0.17 * 0.3)} kg CO₂.</li>`;
    } else if (primaryCat === 'energy') {
      html += `<li><strong>Days 8-15:</strong> Set thermostat to 68°F (winter) / 78°F (summer). Cut water heater heat to 120°F. Saves ~10% utility energy.</li>`;
    } else {
      html += `<li><strong>Days 8-15:</strong> Shift 3 beef/meat meals to plant-based. Saves ~${Math.round(meatMeals * 52 * 0.0027 * 0.3 * 1000)} kg CO₂.</li>`;
    }
    html += `<li><strong>Days 16-22:</strong> Maximize recycling to offset landfill methane. Saves ~200 kg CO₂/yr.</li>`;
    html += `<li><strong>Days 23-30:</strong> Group your online packages to reduce courier miles. (Saves ~15 kg CO₂ per shipment).</li>`;
    html += `</ul>`;
  }
  else if (q.includes('compare') || q.includes('vs') || q.includes('ev') || q.includes('petrol') || q.includes('solar') || q.includes('electricity') || q.includes('bicycle') || q.includes('motorcycle')) {
    html += `<h4>Sustainability Comparison Analysis</h4>`;
    if (q.includes('ev') || q.includes('petrol') || q.includes('gasoline') || q.includes('car')) {
      const gasYearly = (carKm * 52 * 0.17 * 0.001).toFixed(2);
      const evYearly = (carKm * 52 * 0.03 * 0.001).toFixed(2);
      const co2Savings = (carKm * 52 * 0.14 * 0.001).toFixed(2);
      const petrolCost = Math.round(carKm * 52 * 0.12);
      const evCost = Math.round(carKm * 52 * 0.03);
      const moneySavings = petrolCost - evCost;

      html += `<p><strong>Option A: Gasoline/Petrol Car vs Option B: Electric Vehicle (EV)</strong></p>`;
      html += `<ul>`;
      html += `<li><strong>Carbon Comparison:</strong> Based on your weekly driving of ${carKm} km, a gasoline car emits <strong>${gasYearly} tonnes CO₂/yr</strong>. An EV emits just <strong>${evYearly} tonnes CO₂/yr</strong>. Savings: <strong>${co2Savings} tonnes CO₂/yr</strong> (82% reduction).</li>`;
      html += `<li><strong>Cost Comparison:</strong> Petrol fuel costs ~$0.12/km, totaling <strong>$${petrolCost}/yr</strong>. EV electricity charging costs ~$0.03/km, totaling <strong>$${evCost}/yr</strong>. Savings: <strong>$${moneySavings}/yr</strong>.</li>`;
      html += `<li><strong>Recommendation:</strong> Transition to an EV. Switch commutes to transit where possible. Difficulty: Hard (capital cost, high savings).</li>`;
      html += `</ul>`;
    }
    else if (q.includes('solar') || q.includes('grid') || q.includes('panel')) {
      const gridYearly = (electricityKwh * 12 * 0.001 * 0.082).toFixed(2);
      const solarYearly = (electricityKwh * 12 * 0.001 * 0.016).toFixed(2);
      const solarSavingsCo2 = (electricityKwh * 12 * 0.001 * 0.066).toFixed(2);
      const electricityCost = Math.round(electricityKwh * 12 * 0.15);
      const solarSavingsMoney = Math.round(electricityCost * 0.8);

      html += `<p><strong>Option A: Grid Electricity vs Option B: Residential Solar Panels</strong></p>`;
      html += `<ul>`;
      html += `<li><strong>Carbon Comparison:</strong> Your electricity consumption of ${electricityKwh} kWh/mo emits <strong>${gridYearly} tonnes CO₂/yr</strong> from grid sources. Installing solar panels lowers this to <strong>${solarYearly} tonnes CO₂/yr</strong>. Savings: <strong>${solarSavingsCo2} tonnes CO₂/yr</strong> (80% reduction).</li>`;
      html += `<li><strong>Cost Comparison:</strong> Grid bills total <strong>$${electricityCost}/yr</strong> at $0.15/kWh. Solar panels reduce billing by 80%, saving <strong>$${solarSavingsMoney}/yr</strong>.</li>`;
      html += `<li><strong>Recommendation:</strong> Install Solar Panels. Solar offsets your household electricity usage. Difficulty: Hard.</li>`;
      html += `</ul>`;
    }
    else {
      const bikeSavingsCo2 = (carKm * 52 * 0.08 * 0.001).toFixed(2);
      html += `<p><strong>Option A: Bicycle vs Option B: Motorcycle</strong></p>`;
      html += `<ul>`;
      html += `<li><strong>Carbon Comparison:</strong> A bicycle has zero carbon emissions. A motorcycle emits ~0.08 kg CO₂/km. Substituting motorcycle trips with a bicycle saves <strong>${bikeSavingsCo2} tonnes CO₂/yr</strong>.</li>`;
      html += `<li><strong>Cost Comparison:</strong> Bicycling has no fuel costs and minimal maintenance. Motorcycles require gasoline (~$0.05/km) and servicing.</li>`;
      html += `<li><strong>Recommendation:</strong> Use a bicycle for short distance commutes under 5 km. Difficulty: Easy/Medium.</li>`;
      html += `</ul>`;
    }
  }
  else if (q.includes('what uses the most electricity') || q.includes('electricity') || q.includes('drain') || q.includes('appliance') || q.includes('ac') || q.includes('refrigerator')) {
    const hvac = Math.round(electricityKwh * 0.50);
    const heater = Math.round(electricityKwh * 0.18);
    const fridge = Math.round(electricityKwh * 0.15);
    const laundry = Math.round(electricityKwh * 0.10);
    const electronics = Math.round(electricityKwh * 0.07);

    html += `<h4>Household Electricity Consumers Analysis</h4>`;
    html += `<p>In a typical home, the largest consumers of your monthly <strong>${electricityKwh} kWh</strong> consumption are:</p>`;
    html += `<ul>`;
    html += `<li><strong>Heating & Cooling (HVAC/AC):</strong> 50% (~${hvac} kWh/mo). Settings at 68°F (winter) / 78°F (summer) cut cooling costs by 10%. Difficulty: Easy. Savings: ~${Math.round(hvac * 0.1)} kWh/mo.</li>`;
    html += `<li><strong>Water Heater:</strong> 18% (~${heater} kWh/mo). Lowering thermostat to 120°F reduces standby energy. Difficulty: Easy. Savings: ~${Math.round(heater * 0.15)} kWh/mo.</li>`;
    html += `<li><strong>Refrigerator:</strong> 15% (~${fridge} kWh/mo). Keep coils clean and maintain seals. Difficulty: Easy.</li>`;
    html += `<li><strong>Washing Machine & Dryer:</strong> 10% (~${laundry} kWh/mo). Wash on cold settings and line dry. Difficulty: Easy. Savings: ~50 kWh/mo.</li>`;
    html += `<li><strong>Electronics:</strong> 7% (~${electronics} kWh/mo). Unplug "vampire loads" using smart power strips. Difficulty: Easy.</li>`;
    html += `</ul>`;
    html += `<p><strong>Key Savings Opportunity:</strong> Replacing standard incandescent light bulbs with LEDs reduces lighting electricity usage by 75%, saving you approximately <strong>${Math.round(electricityKwh * 0.15)} kWh</strong> per month.</p>`;
  }
  else if (q.includes('analyze my footprint') || q.includes('how am i doing') || q.includes('footprint') || q.includes('score')) {
    const score = Math.max(10, Math.min(100, Math.round(100 - totalCo2 * 7.5)));
    let risk = 'C';
    if (totalCo2 < 2.0) risk = 'A';
    else if (totalCo2 < 4.0) risk = 'B';
    else if (totalCo2 < 7.0) risk = 'C';
    else if (totalCo2 < 12.0) risk = 'D';
    else risk = 'F';

    html += `<h4>EcoCoach Carbon Footprint Analysis</h4>`;
    html += `<p>Here is your comprehensive footprint analysis:</p>`;
    html += `<ul>`;
    html += `<li><strong>Total Footprint:</strong> <strong>${totalCo2} tonnes CO₂/year</strong>.</li>`;
    html += `<li><strong>Biggest Emission Source:</strong> <strong>${primaryCat.toUpperCase()}</strong> contributing ${primaryVal} tonnes/year.</li>`;
    html += `<li><strong>Sustainability Score:</strong> <strong>${score}/100</strong>.</li>`;
    html += `<li><strong>Carbon Risk Level:</strong> <strong>${risk}</strong>.</li>`;
    html += `<li><strong>Key Observations:</strong> ${primaryCat === 'transport' ? 'Fossil fuel transport emissions are your primary footprint driver. Explore transit options.' : primaryCat === 'energy' ? 'Home energy utilities represent your highest emissions area. Switch to energy-star appliances.' : 'Dietary food patterns or consumption shopping options contribute heavily. Shift to plant-based meals.'}</li>`;
    html += `<li><strong>Improvement Opportunities:</strong> Switching your biggest source (${primaryCat}) holds the highest reduction opportunity. Swapping transportation to EV or dietary protein to plant-based could shave off up to 1.5 tonnes CO₂ annually.</li>`;
    html += `</ul>`;
  }
  else if (q.includes('what if') || q.includes('if i')) {
    html += `<h4>Climate Action Scenario Simulation</h4>`;
    if (q.includes('vegetarian') || q.includes('vegan') || q.includes('meat') || q.includes('diet')) {
      const co2Reduction = (meatMeals * 52 * 0.0027).toFixed(2);
      const moneySavings = Math.round(meatMeals * 52 * 1.50);
      const scoreImprovement = Math.min(15, Math.round(meatMeals * 52 * 0.0027 * 7.5));

      html += `<p><strong>Scenario: Switching to a fully plant-based / vegetarian diet</strong></p>`;
      html += `<ul>`;
      html += `<li><strong>Carbon Reduction:</strong> Eliminating beef and poultry meals saves <strong>${co2Reduction} tonnes CO₂/year</strong>.</li>`;
      html += `<li><strong>Cost Savings:</strong> At an estimated saving of $1.50 per serving, you save <strong>$${moneySavings}/year</strong>.</li>`;
      html += `<li><strong>Sustainability Score Improvement:</strong> Increases your score by <strong>+${scoreImprovement} points</strong>.</li>`;
      html += `<li><strong>Long-term Impact:</strong> Over 10 years, this diet shift prevents <strong>${(co2Reduction * 10).toFixed(1)} tonnes CO₂</strong>, equal to planting 25 trees.</li>`;
      html += `</ul>`;
    }
    else if (q.includes('electricity') || q.includes('reduce electricity') || q.includes('20%') || q.includes('energy')) {
      const savingsKwh = Math.round(electricityKwh * 0.20);
      const gridFactor = sliders.solarSavings ? 0.016 : 0.082;
      const co2Reduction = (savingsKwh * 12 * 0.001 * gridFactor).toFixed(2);
      const moneySavings = Math.round(savingsKwh * 12 * 0.15);
      const scoreImprovement = Math.min(10, Math.round(co2Reduction * 7.5));

      html += `<p><strong>Scenario: Reducing electricity consumption by 20%</strong></p>`;
      html += `<ul>`;
      html += `<li><strong>Carbon Reduction:</strong> Shaving off ${savingsKwh} kWh/mo cuts <strong>${co2Reduction} tonnes CO₂/year</strong>.</li>`;
      html += `<li><strong>Cost Savings:</strong> Saves approximately <strong>$${moneySavings}/year</strong> on utility billing.</li>`;
      html += `<li><strong>Sustainability Score Improvement:</strong> Increases your score by <strong>+${scoreImprovement} points</strong>.</li>`;
      html += `<li><strong>Long-term Impact:</strong> Over 10 years, this reduces household emissions by <strong>${(co2Reduction * 10).toFixed(1)} tonnes CO₂</strong>.</li>`;
      html += `</ul>`;
    }
    else if (q.includes('transit') || q.includes('bus') || q.includes('train') || q.includes('public transport') || q.includes('commute')) {
      const co2Reduction = (50 * 52 * (0.00017 - 0.00004)).toFixed(2);
      const moneySavings = Math.round(50 * 52 * 0.09);

      html += `<p><strong>Scenario: Substituting 50 km of driving weekly with public transit</strong></p>`;
      html += `<ul>`;
      html += `<li><strong>Carbon Reduction:</strong> Shifting to rail/bus cuts emissions by <strong>${co2Reduction} tonnes CO₂/year</strong>.</li>`;
      html += `<li><strong>Cost Savings:</strong> Fuel and wear savings total approximately <strong>$${moneySavings}/year</strong>.</li>`;
      html += `<li><strong>Sustainability Score Improvement:</strong> Increases your score by <strong>+${Math.round(co2Reduction * 7.5)} points</strong>.</li>`;
      html += `<li><strong>Long-term Impact:</strong> Prevents <strong>${(co2Reduction * 10).toFixed(1)} tonnes CO₂ over 10 years.</strong></li>`;
      html += `</ul>`;
    }
    else {
      html += `<p>You can run specific scenarios! Try asking:</p>`;
      html += `<ul>`;
      html += `<li>"What if I become vegetarian?"</li>`;
      html += `<li>"What if I reduce electricity by 20%?"</li>`;
      html += `<li>"What if I use public transport twice a week?"</li>`;
      html += `</ul>`;
    }
  }
  else if (q.includes('how can i reduce my carbon footprint') || q.includes('reduce my carbon footprint') || q.includes('reduce') || q.includes('how to reduce')) {
    html += `<h4>Immediate Carbon Reduction Strategies</h4>`;
    html += `<p>Your largest emission source is <strong>${primaryCat.toUpperCase()}</strong> (${primaryVal} tonnes/year).</p>`;
    html += `<p>Here are high-impact interventions to target this source:</p>`;
    html += `<ol>`;
    if (primaryCat === 'transport') {
      html += `<li><strong>Swap Gasoline Driving:</strong> Switching gasoline miles to transit or EV. Expected impact: Saves up to <strong>${(carKm * 52 * 0.14 * 0.001).toFixed(2)} tonnes CO₂/yr</strong>. Difficulty: Medium.</li>`;
      html += `<li><strong>Reduce Air Travel:</strong> Cutting 1 short-haul flight saves <strong>0.90 tonnes CO₂/yr</strong>. Difficulty: Medium.</li>`;
    } else if (primaryCat === 'energy') {
      html += `<li><strong>Residential Solar Panel:</strong> Offsets electricity usage by 80%. Expected impact: Saves up to <strong>${(electricityKwh * 12 * 0.001 * 0.066).toFixed(2)} tonnes CO₂/yr</strong>. Difficulty: Hard.</li>`;
      html += `<li><strong>LED Retrofitting:</strong> Replacing home lights saves up to 75% on lighting drain. Expected impact: Saves ~150 kg CO₂/yr. Difficulty: Easy.</li>`;
    } else if (primaryCat === 'diet') {
      html += `<li><strong>Plant-Based Meals:</strong> Swap beef serving for legumes/chicken. Expected impact: Saves up to <strong>${(meatMeals * 52 * 0.002 * 0.5).toFixed(2)} tonnes CO₂/yr</strong>. Difficulty: Medium.</li>`;
      html += `<li><strong>Eliminate Food Waste:</strong> Reducing waste saves landfill methane. Expected impact: Saves up to 0.20 tonnes CO₂/yr. Difficulty: Easy.</li>`;
    } else {
      html += `<li><strong>Consolidate Shipping:</strong> Grouping online purchases saves freight mileage. Expected impact: Saves ~20 kg CO₂ per combined box. Difficulty: Easy.</li>`;
      html += `<li><strong>Buy Eco-Friendly Thrift:</strong> Purchase second-hand garments. Expected impact: Saves up to 25 kg CO₂ per shirt. Difficulty: Easy.</li>`;
    }
    html += `</ol>`;
    html += `<p><strong>Practical Next Steps:</strong> Pick one "Easy" difficulty item above to commit to this week. Verify your metrics dynamically on the Dashboard.</p>`;
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
    html += `<li><strong>Action 3 (Waste management):</strong> Raise your recycling level to '${RECYCLE_LABELS[recycleRatio] || 'High'}' to reduce landfill waste emissions by <strong>0.15 tonnes CO₂/yr</strong>.</li>`;
    html += `</ul>`;
    html += `<p><em>Your Twin Profile will reflect letter grade 'A' once you drop below 2.0 tonnes.</em></p>`;
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
  else {
    html += `<p>Thanks for chatting! I am analyzing your profile metrics. Your footprint is <strong>${totalCo2} tonnes CO₂/year</strong>.</p>`;
    html += `<p>Your primary source is <strong>${primaryCat.toUpperCase()}</strong> (${primaryVal}t CO₂/yr). Try asking about:</p>`;
    html += `<ul>`;
    html += `<li>"Draft a customized 30-day carbon reduction calendar action plan for me."</li>`;
    html += `<li>"What household appliances use the most electricity and how do I reduce their drain?"</li>`;
    html += `<li>"Explain carbon offsets - how do I choose a reputable one and what do they cost?"</li>`;
    html += `<li>"Compare gasoline vs EV driving footprint costs."</li>`;
    html += `</ul>`;
  }

  // Follow-Up Questions Suggestion block
  html += `<hr style="border:0; border-top:1px solid var(--border); margin:1.5rem 0 1rem 0;" />`;
  html += `<p style="font-size:13px; color:var(--text-secondary); font-weight:600; margin-bottom:8px;">💡 Suggested follow-up questions:</p>`;
  html += `<ul style="font-size:12px; list-style-type:none; padding-left:0; display:flex; flex-direction:column; gap:6px;">`;
  html += `<li><a href="#" onclick="window.askAi('Draft a customized 30-day carbon reduction calendar action plan for me.')" style="color:var(--green); text-decoration:none; font-weight:700;">📅 &quot;Would you like a personalized 30-day action plan?&quot;</a></li>`;
  html += `<li><a href="#" onclick="window.askAi('Analyze my footprint')" style="color:var(--green); text-decoration:none; font-weight:700;">🔍 &quot;Want me to identify your biggest emission source?&quot;</a></li>`;
  html += `<li><a href="#" onclick="window.askAi('What if I reduce electricity by 20%?')" style="color:var(--green); text-decoration:none; font-weight:700;">⚡ &quot;Would you like to simulate a 20% reduction in electricity usage?&quot;</a></li>`;
  html += `<li><a href="#" onclick="window.askAi('Compare EV vs Petrol')" style="color:var(--green); text-decoration:none; font-weight:700;">🚗 &quot;Interested in comparing renewable energy options?&quot;</a></li>`;
  html += `</ul>`;

  return html;
}

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
    const { message, carbonProfile, sliders: reqSliders, breakdown: reqBreakdown, totalCo2: reqTotalCo2, history = [] } = req.body;

    if (!carbonProfile) {
      return res.status(400).json({ error: 'carbonProfile is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Load additional user-specific profile context
    let dbSustainabilityScore = 70;
    let dbRiskScore = 'B';
    let habitsForecast = '';
    let completedActions = [];
    let receipts = [];
    let simulation = null;

    try {
      const profile = await db.getCarbonProfile(req.user.id);
      if (profile) {
        dbSustainabilityScore = profile.sustainabilityScore || 70;
        dbRiskScore = profile.riskScore || 'B';
        habitsForecast = profile.habits || '';
      }
    } catch (e) {
      console.warn("Could not read user profile for insights context:", e.message);
    }

    try {
      completedActions = await db.getUserActions(req.user.id);
    } catch (e) {}

    try {
      receipts = await db.getOCRReceipts(req.user.id);
    } catch (e) {}

    try {
      simulation = await db.getSimulation(req.user.id);
    } catch (e) {}

    const sliders = reqSliders || {};
    const breakdown = reqBreakdown || {};
    const totalCo2 = reqTotalCo2 !== undefined ? reqTotalCo2 : (carbonProfile ? carbonProfile.annualFootprint : 0);

    if (!apiKey || apiKey.trim() === '' || apiKey === 'YOUR_GEMINI_API_KEY') {
      const advice = getFallbackAdvice(message, sliders, totalCo2, breakdown);
      return res.json({
        response: `<p>Advanced analysis is temporarily unavailable. Based on your available data, here are some recommendations.</p>${advice}`,
        offline: true
      });
    }

    // Comprehensive EcoCoach AI system prompt
    const systemPrompt = `You are EcoCoach AI, the intelligent, professional, and friendly sustainability assistant of EcoTwin AI.
Your role is to provide personalized, data-driven, and conversational guidance to help users understand, track, predict, and reduce their carbon footprint.

## User Context
- User Name: ${req.user.name}
- Carbon Footprint Score: ${totalCo2} tonnes CO₂/year
- Sustainability Score: ${dbSustainabilityScore}/100
- Carbon Risk Level: ${dbRiskScore}
- Carbon Twin Summary Forecast: ${habitsForecast || 'Initial configuration loaded.'}
- Home Energy / Utility Stats:
  * Electricity: ${sliders.electricityKwh || 0} kWh/month (Grid is 0.082 kg/kWh, Solar reduces this by 80% to 0.016 kg/kWh)
  * Gas: ${sliders.gasCylinders || 0} cylinders/month (42.3 kg CO₂ per cylinder)
  * Water: ${sliders.waterUsage || 0} litres/month (0.3 kg CO₂ per 1000 litres)
  * Total Utilities/Energy CO₂ emissions: ${breakdown.energy || 0} tonnes/year
- Transportation Stats:
  * Gasoline Car weekly: ${sliders.carKm || 0} km/week (0.17 kg CO₂/km)
  * Electric Vehicle (EV) weekly: ${sliders.evKm || 0} km/week (0.03 kg CO₂/km)
  * Public Transit weekly: ${sliders.transitKm || 0} km/week (0.04 kg CO₂/km)
  * Flights taken: ${sliders.flightsCount || 0} flights/year (900 kg CO₂ per flight)
  * Total Transportation CO₂ emissions: ${breakdown.transport || 0} tonnes/year
- Diet & Waste Stats:
  * Meat meals: ${sliders.meatMeals || 0} meals/week (2.7 kg CO₂ per meal)
  * Waste Level: ${sliders.wasteLevel || 0}/3 (0=None, 1=Low, 2=Medium, 3=High)
  * Recycle Ratio: ${sliders.recycleRatio || 0}/3 (0=None, 1=Low, 2=Medium, 3=High)
  * Total Diet & Waste CO₂ emissions: ${breakdown.diet || 0} tonnes/year
- Shopping & Apparel Stats:
  * Clothes bought: ${sliders.clothesCount || 0} items/month (25 kg CO₂ per piece)
  * Online order parcels: ${sliders.shopCount || 0} orders/month (3 kg CO₂ per parcel)
  * Total Shopping CO₂ emissions: ${breakdown.shopping || 0} tonnes/year
- Completed Actions Tracker (Completed Action IDs): [${(completedActions || []).join(', ')}]
- Recent Scanned Receipts (from OCR scanner):
${(receipts || []).slice(0, 3).map(r => `  * ${r.receiptType} receipt - Cost: $${r.extractedData.cost || 0}, quantity: ${r.extractedData.quantity || 0} ${r.extractedData.unit || ''}, emissions impact: ${r.emissions || 0}t`).join('\n') || '  * No scanned receipts logged yet.'}
- Simulation data: ${simulation ? `Annual CO₂ savings: ${simulation.annualSavingsCo2 || 0}t, Annual financial savings: $${simulation.annualSavingsMoney || 0}` : 'No simulator settings set yet.'}

## Dynamic Conversation Rules
* Always answer the user's actual question directly. Never force pre-defined scripts or rigid answers.
* Keep conversations natural, interactive, encouraging, and highly personalized using the user's name (${req.user.name}) and metrics.
* Never repeat the same advice; look at the chat history to see what was discussed.
* If user metrics/context are referenced in the question, perform accurate mathematical calculations based on the metrics above (e.g. EV vs Petrol savings, solar offset, vegetarian diet cuts).
* You must ONLY respond using clean, standard HTML tags (such as <p>, <ul>, <li>, <strong>, <ol>, <hr />, etc.). DO NOT use any markdown characters (no asterisks, no hashes, no markdown bullet points).
* Avoid showing any API logs, database objects, stack traces, or technical backend jargon.

## Specific Answer Frameworks
- "How can I reduce my carbon footprint?": Identify their largest emission source in breakdown, suggest the highest-impact improvements (e.g. switching to EV, solar, or reducing meat), estimate the exact carbon savings using their weekly/monthly values, and provide next steps.
- "Analyze my footprint": Give: Total footprint, Biggest emission source, Carbon risk level, Key observations, and Improvement opportunities.
- "Generate a plan": Create a personalized 7-day, 30-day, or 90-day action calendar/plan, with daily or weekly goals, expected carbon reductions, and milestones.
- "Compare two options" (e.g., EV vs Petrol, Solar vs Grid, Bicycle vs Motorcycle):
  * EV vs Petrol: Compare carbon (Gas is 0.17 kg/km; EV is 0.03 kg/km. Savings is 0.14 kg CO₂/km), cost (Petrol ~$0.12/km vs EV ~$0.03/km), long-term impact, and recommendation. Use their weekly carKm for custom estimates.
  * Solar vs Grid: Compare carbon (Grid is 0.082 kg/kWh; Solar is 0.016 kg/kWh. Savings is 0.066 kg CO₂/kWh), utility cost, long-term impact, and recommendation. Use their monthly electricityKwh.
- "What uses the most electricity?": Analyze HVAC/AC (~50%), Water Heater (~18%), Refrigerator (~15%), Laundry (~10%), Electronics (~7%). Identify major energy consumers and saving opportunities.
- "How am I doing?": Provide progress summary, sustainability score, carbon trend, achievements (referencing completed action IDs), and areas needing improvement.
- "What if..." questions (e.g., what if I use public transit twice a week, what if I reduce electricity by 20%, what if I become vegetarian):
  * vegetarian/vegan: calculate saving: meatMeals * 52 * 0.0027 tonnes CO₂/yr. Estimate cost savings and score increase.
  * electricity by 20%: calculate saving: electricityKwh * 0.20 * 12 * 0.001 * (solarSavings ? 0.016 : 0.082) tonnes CO₂/yr.
  * public transport twice a week (shifting 50 km/week): calculate saving: 50 * 52 * 0.00013 tonnes CO₂/yr.

## Recommendations
Every recommendation should include:
- Action
- Expected impact
- Difficulty level (Easy, Medium, Hard)
- Estimated savings (if possible)
Prioritize recommendations by impact.

## Follow-Up Behavior
At the end of your response, always include a horizontal rule (<hr />) and a clean HTML list of 3-4 suggested follow-up questions formatted as clickable links that call window.askAi:
<hr />
<p style="font-size:13px; color:var(--text-secondary); font-weight:600; margin-bottom:8px;">💡 Suggested follow-up questions:</p>
<ul style="font-size:12px; list-style-type:none; padding-left:0; display:flex; flex-direction:column; gap:6px;">
  <li><a href="#" onclick="window.askAi('Draft a customized 30-day carbon reduction calendar action plan for me.')" style="color:var(--green); text-decoration:none; font-weight:700;">📅 &quot;Would you like a personalized 30-day action plan?&quot;</a></li>
  <li><a href="#" onclick="window.askAi('Analyze my footprint')" style="color:var(--green); text-decoration:none; font-weight:700;">🔍 &quot;Want me to identify your biggest emission source?&quot;</a></li>
  <li><a href="#" onclick="window.askAi('What if I reduce electricity by 20%?')" style="color:var(--green); text-decoration:none; font-weight:700;">⚡ &quot;Would you like to simulate a 20% reduction in electricity usage?&quot;</a></li>
  <li><a href="#" onclick="window.askAi('Compare EV vs Petrol')" style="color:var(--green); text-decoration:none; font-weight:700;">🚗 &quot;Interested in comparing renewable energy options?&quot;</a></li>
</ul>
`;

    // Process history: identify current prompt and history.
    let currentMessage = message || '';
    let rawHistory = [...history];

    if (!currentMessage && rawHistory.length > 0 && rawHistory[rawHistory.length - 1].role === 'user') {
      currentMessage = rawHistory[rawHistory.length - 1].content;
      rawHistory.pop();
    } else if (currentMessage && rawHistory.length > 0 && rawHistory[rawHistory.length - 1].content === currentMessage) {
      rawHistory.pop();
    }

    // Filter rawHistory to ensure the first element is a user message (Gemini API requirement)
    let pastHistory = [];
    let hasUserMessage = false;
    for (const msg of rawHistory) {
      if (msg.role === 'user') {
        hasUserMessage = true;
      }
      if (hasUserMessage) {
        pastHistory.push(msg);
      }
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
    const fallback = getFallbackAdvice(req.body.message, req.body.sliders, req.body.totalCo2 || 0, req.body.breakdown);
    res.json({
      response: `<p>Advanced analysis is temporarily unavailable. Based on your available data, here are some recommendations.</p>${fallback}`,
      offline: true
    });
  }
});

module.exports = router;
