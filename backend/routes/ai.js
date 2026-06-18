const express = require('express');
const router = express.Router();
const db = require('../database');
const authMiddleware = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const WASTE_LABELS = ['None', 'Low', 'Medium', 'High'];
const RECYCLE_LABELS = ['None', 'Low', 'Medium', 'High'];

// Fallback Rule-based engine if Gemini key is offline or missing
function getFallbackAdvice(question, sliders, totalCo2, breakdown, userName) {
  const q = (question || '').toLowerCase().trim();
  const cats = Object.entries(breakdown || {}).sort((a, b) => b[1] - a[1]);
  const primaryCat = cats.length > 0 ? cats[0][0] : 'energy';
  const primaryVal = cats.length > 0 ? cats[0][1] : 0;

  const carKm = sliders.carKm || 150;
  const electricityKwh = sliders.electricityKwh || 250;
  const meatMeals = sliders.meatMeals || 7;
  const shopCount = sliders.shopCount || 5;
  const recycleRatio = sliders.recycleRatio || 1;

  // Rule 5: If footprint data is missing, ask follow-up questions
  const hasData = totalCo2 > 0 || Object.values(sliders || {}).some(val => typeof val === 'number' && val > 0);
  const isGreeting = q === 'hello' || q === 'hi' || q === 'hey' || q.startsWith('hello ') || q.startsWith('hi ') || q.startsWith('hey ');

  if (!hasData && !isGreeting) {
    return `<p>It looks like we don't have enough carbon footprint data to personalize your assessment yet. Could you tell me a bit more about your lifestyle so we can get started?</p>
    <ul>
      <li>Approximately how many kilometers do you drive per week?</li>
      <li>What is your average monthly electricity consumption in kWh?</li>
      <li>How many meat-based meals do you consume in a typical week?</li>
    </ul>`;
  }

  let html = '';

  if (isGreeting) {
    const firstName = userName ? userName.split(' ')[0] : 'Maharshi';
    html += `<p>Hello ${firstName}! 👋 I'm EcoCoach. I can help analyze your carbon footprint, suggest ways to reduce emissions, compare lifestyle choices, and answer sustainability questions. What would you like to explore today?</p>`;
  }
  else if (q.includes('30-day') || q.includes('plan') || q.includes('calendar')) {
    html += `<h4>EcoCoach 30-Day Reduction Calendar Action Plan</h4>`;
    html += `<p>Based on your profile, here is a structured timeline to reduce your carbon footprint of <strong>${totalCo2} tonnes CO₂/year</strong>:</p>`;
    html += `<ul>`;
    html += `<li><strong>Week 1 (Days 1-7 - Quick Wins):</strong> Swap incandescent bulbs to LEDs. Saves approximately ~15% on lighting bills. Difficulty: Easy. Savings: ~${Math.round(electricityKwh * 0.15)} kWh/mo (~150 kg CO₂/yr).</li>`;
    if (primaryCat === 'transport') {
      html += `<li><strong>Week 2 (Days 8-15 - Commuter Focus):</strong> Substitute 3 gasoline driving trips with transit. Difficulty: Medium. Savings: ~${Math.round(carKm * 52 * 0.17 * 0.3)} kg CO₂/yr.</li>`;
    } else if (primaryCat === 'energy') {
      html += `<li><strong>Week 2 (Days 8-15 - Utility Optimization):</strong> Lower water heater thermostat to 120°F and unplug standby electronics. Difficulty: Easy. Savings: ~10% utility energy reduction.</li>`;
    } else {
      html += `<li><strong>Week 2 (Days 8-15 - Dietary Shift):</strong> Replace 3 beef meals with poultry or plant-based meals. Difficulty: Medium. Savings: ~${Math.round(meatMeals * 52 * 0.0027 * 0.3 * 1000)} kg CO₂/yr.</li>`;
    }
    html += `<li><strong>Week 3 (Days 16-22 - Waste Reduction):</strong> Elevate your recycling level from '${RECYCLE_LABELS[recycleRatio] || 'Low'}' to 'High'. Difficulty: Easy. Savings: ~200 kg CO₂/yr.</li>`;
    html += `<li><strong>Week 4 (Days 23-30 - Mindful Shopping):</strong> Group online orders to cut parcel shipping packaging. Difficulty: Easy. Savings: ~${Math.round(shopCount * 12 * 3 * 0.5)} kg CO₂/yr.</li>`;
    html += `</ul>`;
    html += `<p><strong>Milestone:</strong> Completing this 30-day plan can reduce your footprint by up to <strong>1.50 tonnes CO₂/year</strong>!</p>`;
  }
  else if (q.includes('compare ev vs petrol') || (q.includes('ev') && q.includes('petrol'))) {
    const gasYearly = (carKm * 52 * 0.17 * 0.001).toFixed(2);
    const evYearly = (carKm * 52 * 0.03 * 0.001).toFixed(2);
    const co2Savings = (carKm * 52 * 0.14 * 0.001).toFixed(2);
    const petrolCost = Math.round(carKm * 52 * 0.12);
    const evCost = Math.round(carKm * 52 * 0.03);
    const moneySavings = petrolCost - evCost;

    html += `<h4>Sustainability Comparison: Petrol vs Electric Vehicle (EV)</h4>`;
    html += `<p>Based on your weekly driving of <strong>${carKm} km</strong>, here is the direct comparison:</p>`;
    html += `<table style="width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 15px; border: 1px solid var(--border); font-size: 13px;">`;
    html += `  <thead>`;
    html += `    <tr style="background-color: var(--bg-secondary); text-align: left; border-bottom: 1px solid var(--border);">`;
    html += `      <th style="padding: 8px; border-right: 1px solid var(--border);">Metric</th>`;
    html += `      <th style="padding: 8px; border-right: 1px solid var(--border);">Petrol Vehicle</th>`;
    html += `      <th style="padding: 8px;">Electric Vehicle (EV)</th>`;
    html += `    </tr>`;
    html += `  </thead>`;
    html += `  <tbody>`;
    html += `    <tr style="border-bottom: 1px solid var(--border);">`;
    html += `      <td style="padding: 8px; border-right: 1px solid var(--border); font-weight: bold;">Carbon Emissions</td>`;
    html += `      <td style="padding: 8px; border-right: 1px solid var(--border);">${gasYearly} tonnes CO₂/yr</td>`;
    html += `      <td style="padding: 8px; color: var(--green); font-weight: bold;">${evYearly} tonnes CO₂/yr</td>`;
    html += `    </tr>`;
    html += `    <tr style="border-bottom: 1px solid var(--border);">`;
    html += `      <td style="padding: 8px; border-right: 1px solid var(--border); font-weight: bold;">Annual Fuel/Charging Cost</td>`;
    html += `      <td style="padding: 8px; border-right: 1px solid var(--border);">$${petrolCost}/yr</td>`;
    html += `      <td style="padding: 8px; color: var(--green); font-weight: bold;">$${evCost}/yr</td>`;
    html += `    </tr>`;
    html += `    <tr>`;
    html += `      <td style="padding: 8px; border-right: 1px solid var(--border); font-weight: bold;">Long-Term Impact (10 yrs)</td>`;
    html += `      <td style="padding: 8px; border-right: 1px solid var(--border);">${(gasYearly * 10).toFixed(1)} tonnes CO₂</td>`;
    html += `      <td style="padding: 8px; color: var(--green); font-weight: bold;">${(evYearly * 10).toFixed(1)} tonnes CO₂ (Saves $${moneySavings * 10})</td>`;
    html += `    </tr>`;
    html += `  </tbody>`;
    html += `</table>`;
    html += `<p><strong>Recommendation:</strong> Switching to an EV offers an 82% carbon reduction and significant fuel cost savings.</p>`;
  }
  else if (q.includes('compare') || q.includes('vs') || q.includes('solar') || q.includes('bicycle') || q.includes('motorcycle')) {
    html += `<h4>Sustainability Comparison Analysis</h4>`;
    if (q.includes('solar') || q.includes('grid') || q.includes('panel')) {
      const gridYearly = (electricityKwh * 12 * 0.001 * 0.082).toFixed(2);
      const solarYearly = (electricityKwh * 12 * 0.001 * 0.016).toFixed(2);
      const solarSavingsCo2 = (electricityKwh * 12 * 0.001 * 0.066).toFixed(2);
      const electricityCost = Math.round(electricityKwh * 12 * 0.15);
      const solarSavingsMoney = Math.round(electricityCost * 0.8);

      html += `<p><strong>Option A: Grid Electricity vs Option B: Residential Solar Panels</strong></p>`;
      html += `<ul>`;
      html += `<li><strong>Carbon Comparison:</strong> Your electricity consumption of ${electricityKwh} kWh/mo emits <strong>${gridYearly} tonnes CO₂/yr</strong> from grid sources. Installing solar panels lowers this to <strong>${solarYearly} tonnes CO₂/yr</strong>. Savings: <strong>${solarSavingsCo2} tonnes CO₂/yr</strong> (80% reduction).</li>`;
      html += `<li><strong>Cost Comparison:</strong> Grid bills total <strong>$${electricityCost}/yr</strong> at $0.15/kWh. Solar panels reduce billing by 80%, saving <strong>$${solarSavingsMoney}/yr</strong>.</li>`;
      html += `<li><strong>Long-term Environmental Impact:</strong> Over 20 years, a solar setup offsets <strong>${(solarSavingsCo2 * 20).toFixed(1)} tonnes CO₂</strong> and saves <strong>$${solarSavingsMoney * 20}</strong>.</li>`;
      html += `<li><strong>Recommendation:</strong> Install Solar Panels. Solar offsets your household electricity usage. Difficulty: Hard.</li>`;
      html += `</ul>`;
    }
    else {
      const bikeSavingsCo2 = (carKm * 52 * 0.08 * 0.001).toFixed(2);
      html += `<p><strong>Option A: Bicycle vs Option B: Motorcycle</strong></p>`;
      html += `<ul>`;
      html += `<li><strong>Carbon Comparison:</strong> A bicycle has zero carbon emissions. A motorcycle emits ~0.08 kg CO₂/km. Substituting motorcycle trips with a bicycle saves <strong>${bikeSavingsCo2} tonnes CO₂/yr</strong>.</li>`;
      html += `<li><strong>Cost Comparison:</strong> Bicycling has no fuel costs and minimal maintenance. Motorcycles require gasoline (~$0.05/km) and servicing.</li>`;
      html += `<li><strong>Long-term Environmental Impact:</strong> Cycling eliminates air pollutants and improves personal health indices.</li>`;
      html += `<li><strong>Recommendation:</strong> Use a bicycle for short distance commutes under 5 km. Difficulty: Easy/Medium.</li>`;
      html += `</ul>`;
    }
  }
  else if (q.includes('what uses the most electricity')) {
    const hvac = Math.round(electricityKwh * 0.50);
    const heater = Math.round(electricityKwh * 0.18);
    const fridge = Math.round(electricityKwh * 0.15);
    const laundry = Math.round(electricityKwh * 0.10);
    const electronics = Math.round(electricityKwh * 0.07);

    html += `<h4>Household Electricity Consumption Analysis</h4>`;
    html += `<p>In a typical home, the largest consumers of your monthly <strong>${electricityKwh} kWh</strong> consumption are:</p>`;
    html += `<ul>`;
    html += `<li><strong>Heating & Cooling (HVAC/AC):</strong> 50% (~${hvac} kWh/mo). Settings at 68°F (winter) / 78°F (summer) cut cooling costs by 10%.</li>`;
    html += `<li><strong>Water Heater:</strong> 18% (~${heater} kWh/mo). Lowering thermostat to 120°F reduces standby energy.</li>`;
    html += `<li><strong>Refrigerator:</strong> 15% (~${fridge} kWh/mo). Keep coils clean and maintain seals.</li>`;
    html += `<li><strong>Washing Machine & Dryer:</strong> 10% (~${laundry} kWh/mo). Wash on cold settings and line dry.</li>`;
    html += `<li><strong>Electronics:</strong> 7% (~${electronics} kWh/mo). Unplug "vampire loads" using smart power strips.</li>`;
    html += `</ul>`;
    html += `<p>To reduce consumption, audit these high-consumption household appliances first.</p>`;
  }
  else if (q.includes('electricity') || q.includes('drain') || q.includes('appliance') || q.includes('ac') || q.includes('refrigerator')) {
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
  else if (q.includes('analyze my footprint')) {
    const score = Math.max(10, Math.min(100, Math.round(100 - totalCo2 * 7.5)));
    let risk = 'C';
    if (totalCo2 < 2.0) risk = 'A';
    else if (totalCo2 < 4.0) risk = 'B';
    else if (totalCo2 < 7.0) risk = 'C';
    else if (totalCo2 < 12.0) risk = 'D';
    else risk = 'F';

    const obs = primaryCat === 'transport' 
      ? 'Fossil fuel transport emissions are your primary footprint driver. Commutes and flights represent a major portion of your greenhouse gas contribution.' 
      : primaryCat === 'energy' 
      ? 'Household energy usage is your leading contributor. Your utility billing and electricity/gas consumption represent your biggest area of improvement.' 
      : 'Dietary habits or retail shopping are driving your footprint. Swapping high-impact meats and consolidating purchases will lower your emissions.';

    const recs = primaryCat === 'transport'
      ? `We recommend substituting gasoline car commutes with public transport or switching to an Electric Vehicle (EV) to save up to ${(carKm * 52 * 0.14 * 0.001).toFixed(2)} tonnes CO₂/yr.`
      : primaryCat === 'energy'
      ? `We recommend retrofitting with LED lighting (saves ~150 kg CO₂/yr) and auditing heating/cooling settings to drop electricity usage.`
      : `We recommend swapping meat dishes for plant-based alternatives (saves ~${Math.round(meatMeals * 52 * 0.002 * 0.5 * 1000)} kg CO₂/yr) and reducing single-item parcel deliveries.`;

    html += `<h4>EcoCoach Carbon Footprint Analysis</h4>`;
    html += `<p>Here is your comprehensive footprint analysis:</p>`;
    html += `<ul>`;
    html += `<li><strong>Total Footprint:</strong> <strong>${totalCo2} tonnes CO₂/year</strong></li>`;
    html += `<li><strong>Largest Emission Source:</strong> <strong>${primaryCat.toUpperCase()}</strong></li>`;
    html += `<li><strong>Risk Level:</strong> Carbon Risk Level <strong>${risk}</strong></li>`;
    html += `<li><strong>Key Observations:</strong> ${obs}</li>`;
    html += `<li><strong>Personalized Recommendations:</strong> ${recs}</li>`;
    html += `</ul>`;
  }
  else if (q.includes('how am i doing')) {
    const score = Math.max(10, Math.min(100, Math.round(100 - totalCo2 * 7.5)));
    let improvementMsg = '';
    let attentionMsg = '';

    if (primaryCat === 'transport') {
      improvementMsg = 'You are maintaining moderate home utility consumption.';
      attentionMsg = 'Your transport emissions represent a major carbon contributor. Focus on reducing gasoline commutes.';
    } else if (primaryCat === 'energy') {
      improvementMsg = 'Your travel carbon footprint is relatively managed.';
      attentionMsg = 'Household utilities (electricity/gas) are your largest emission source. Focus on energy efficiency.';
    } else {
      improvementMsg = 'You are managing your home electricity and vehicle transport patterns nicely.';
      attentionMsg = 'Dietary meat intake or shopping packages are high. Consider planning plant-based meals.';
    }

    html += `<h4>EcoCoach Progress Assessment</h4>`;
    html += `<ul>`;
    html += `<li><strong>Progress Summary:</strong> Your carbon footprint is currently at <strong>${totalCo2} tonnes CO₂/year</strong>. You are taking active steps to track and simulate scenarios.</li>`;
    html += `<li><strong>Sustainability Score:</strong> <strong>${score}/100</strong></li>`;
    html += `<li><strong>Areas Improving:</strong> ${improvementMsg}</li>`;
    html += `<li><strong>Areas Needing Attention:</strong> ${attentionMsg}</li>`;
    html += `</ul>`;
  }
  else if (q.includes('footprint') || q.includes('score')) {
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
  else if (q.includes('reduce electricity by 20%') || q.includes('reduce electricity by 20') || q.includes('electricity by 20%')) {
    const savingsKwh = Math.round(electricityKwh * 0.20);
    const gridFactor = sliders.solarSavings ? 0.016 : 0.082;
    const co2Reduction = (savingsKwh * 12 * 0.001 * gridFactor).toFixed(2);
    const moneySavings = Math.round(savingsKwh * 12 * 0.15);
    const scoreImprovement = Math.min(10, Math.round(co2Reduction * 7.5));

    html += `<h4>Climate Action Scenario Simulation</h4>`;
    html += `<p>Here is the projected impact of a 20% reduction in electricity usage:</p>`;
    html += `<ul>`;
    html += `<li><strong>CO₂ Reduction:</strong> Saves <strong>${co2Reduction} tonnes CO₂/year</strong> (by cutting ${savingsKwh} kWh/month).</li>`;
    html += `<li><strong>Cost Savings:</strong> Saves approximately <strong>$${moneySavings}/year</strong> on utility billing.</li>`;
    html += `<li><strong>Score Improvement:</strong> Increases your Sustainability Score by <strong>+${scoreImprovement} points</strong>.</li>`;
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
      html += `<li><strong>Long-term Impact:</strong> Prevents <strong>${(co2Reduction * 10).toFixed(1)} tonnes CO₂</strong> over 10 years.</li>`;
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
    html += `<li><strong>Action 3 (Waste management):</strong> Raise your recycling level to '${RECYCLE_LABELS[3] || 'High'}' to reduce landfill waste emissions by <strong>0.15 tonnes CO₂/yr</strong>.</li>`;
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

  // Only show follow-up suggestions when they are relevant to the user's question.
  // Do not repeat suggested prompts after every message.
  let showFollowUps = false;
  let followUpHtml = '';

  if (isGreeting) {
    // For greetings, keep responses short and conversational, no follow-ups
  } else if (q.includes('analyze my footprint') || q.includes('how am i doing') || q.includes('footprint') || q.includes('score')) {
    showFollowUps = true;
    followUpHtml += `<li><a href="#" onclick="window.askAi('Draft a customized 30-day carbon reduction calendar action plan for me.')" style="color:var(--green); text-decoration:none; font-weight:700;">📅 &quot;Would you like a personalized 30-day action plan?&quot;</a></li>`;
  } else if (q.includes('electricity') || q.includes('what uses the most electricity') || q.includes('appliance') || q.includes('ac')) {
    showFollowUps = true;
    followUpHtml += `<li><a href="#" onclick="window.askAi('What if I reduce electricity by 20%?')" style="color:var(--green); text-decoration:none; font-weight:700;">⚡ &quot;Would you like to simulate a 20% reduction in electricity usage?&quot;</a></li>`;
  } else if (q.includes('compare ev vs petrol') || q.includes('ev') || q.includes('petrol') || q.includes('car')) {
    showFollowUps = true;
    followUpHtml += `<li><a href="#" onclick="window.askAi('Compare Solar panels vs Grid electricity')" style="color:var(--green); text-decoration:none; font-weight:700;">☀️ &quot;Compare solar panels vs grid electricity emissions.&quot;</a></li>`;
  }

  if (showFollowUps && followUpHtml) {
    html += `<hr style="border:0; border-top:1px solid var(--border); margin:1.5rem 0 1rem 0;" />`;
    html += `<p style="font-size:13px; color:var(--text-secondary); font-weight:600; margin-bottom:8px;">💡 Suggested follow-up questions:</p>`;
    html += `<ul style="font-size:12px; list-style-type:none; padding-left:0; display:flex; flex-direction:column; gap:6px;">`;
    html += followUpHtml;
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

// Cascading Gemini Caller (Tries Gemini 2.5 Flash, cascades to Gemini 3.1 Flash Lite)
async function callGeminiCascade(apiKey, options = {}) {
  const { prompt, systemInstruction, history, base64Image, mimeType } = options;
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
        const geminiHistory = history.map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }]
        }));
        const chat = model.startChat({ history: geminiHistory });
        const result = await chat.sendMessage(prompt);
        responseText = result.response.text();
      } else if (base64Image && mimeType) {
        const buffer = Buffer.from(base64Image.split(",")[1] || base64Image, 'base64');
        const imagePart = fileToGenerativePart(buffer, mimeType);
        const result = await model.generateContent([prompt, imagePart]);
        responseText = result.response.text();
      } else {
        const result = await model.generateContent(prompt);
        responseText = result.response.text();
      }

      console.log(`Gemini Query successfully resolved by model: ${modelName}`);
      return { text: responseText, modelUsed: modelName };
    } catch (e) {
      console.warn(`Gemini Model ${modelName} failed cascade check:`, e.message);
      lastError = e;
    }
  }

  throw lastError || new Error('All model attempts in cascade failed.');
}

// @route   POST /api/ai/insights
// @desc    Securely query Gemini API with chat history and metrics (EcoCoach)
router.post('/insights', authMiddleware, async (req, res) => {
  const { question, sliders, breakdown, totalCo2, history = [] } = req.body;

  if (!sliders || !breakdown || totalCo2 === undefined) {
    return res.status(400).json({ error: 'Incomplete carbon metrics provided' });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  // Query database profiles and metadata for deep context
  let sustainabilityScore = 70;
  let riskScore = 'B';
  let habitsForecast = '';
  let completedActions = [];
  let receipts = [];
  let simulation = null;

  try {
    const profile = await db.getCarbonProfile(req.user.id);
    if (profile) {
      sustainabilityScore = profile.sustainabilityScore || 70;
      riskScore = profile.riskScore || 'B';
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

  if (!apiKey || apiKey.trim() === '' || apiKey === 'YOUR_GEMINI_API_KEY') {
    const advice = getFallbackAdvice(question, sliders, totalCo2, breakdown, req.user.name);
    return res.json({
      response: `<p>Using your current footprint data, here's my assessment...</p>${advice}`,
      offline: true
    });
  }

  try {
    const systemPrompt = `
You are EcoCoach AI, a friendly, smart, professional, encouraging, and personalized conversational sustainability assistant.
Your primary goal is to answer the user's actual question naturally while using available carbon footprint data to personalize responses.

## USER DATA:
- User Name: ${req.user.name}
- Annual footprint: ${totalCo2} tonnes CO₂/year
- Energy/Utilities emissions: ${breakdown.energy || 0} tonnes/year
- Transportation emissions: ${breakdown.transport || 0} tonnes/year
- Food/Diet & Waste emissions: ${breakdown.diet || 0} tonnes/year
- Shopping emissions: ${breakdown.shopping || 0} tonnes/year
- Sustainability score: ${sustainabilityScore}/100
- Carbon risk level: ${riskScore}
- Carbon Twin predictions/forecast: ${habitsForecast || 'Initial configuration loaded.'}
- Sliders/Inputs:
  * Electricity: ${sliders.electricityKwh || 0} kWh/month (Grid is 0.082 kg/kWh, Solar reduces this by 80% to 0.016 kg/kWh)
  * Gas: ${sliders.gasCylinders || 0} cylinders/month (42.3 kg CO₂ per cylinder)
  * Water: ${sliders.waterUsage || 0} litres/month (0.3 kg CO₂ per 1000 litres)
  * Gasoline Car weekly: ${sliders.carKm || 0} km/week (0.17 kg CO₂/km)
  * Electric Vehicle (EV) weekly: ${sliders.evKm || 0} km/week (0.03 kg CO₂/km)
  * Public Transit weekly: ${sliders.transitKm || 0} km/week (0.04 kg CO₂/km)
  * Flights taken: ${sliders.flightsCount || 0} flights/year (900 kg CO₂ per flight)
  * Meat meals: ${sliders.meatMeals || 0} meals/week (2.7 kg CO₂ per meal)
  * Waste Level: ${sliders.wasteLevel || 0}/3 (0=None, 1=Low, 2=Medium, 3=High)
  * Recycle Ratio: ${sliders.recycleRatio || 0}/3 (0=None, 1=Low, 2=Medium, 3=High)
  * Clothes bought: ${sliders.clothesCount || 0} items/month (25 kg CO₂ per piece)
  * Online order parcels: ${sliders.shopCount || 0} orders/month (3 kg CO₂ per parcel)
  * Completed Action IDs: [${(completedActions || []).join(', ')}]
  * OCR scanned receipts: ${(receipts || []).slice(0, 3).map(r => `${r.receiptType} receipt - emissions: ${r.emissions || 0}t`).join(', ') || 'None'}
  * Simulation config: ${simulation ? `annual CO₂ savings: ${simulation.annualSavingsCo2 || 0}t, annual money savings: $${simulation.annualSavingsMoney || 0}` : 'None'}

## BEHAVIOR RULES:
1. Never return the same response for different questions. Do not use generic fallback reports or copy-paste templates.
2. Never force users into predefined templates. Behave like a real chat assistant, not a static report generator.
3. Always answer exactly what the user asks. If the user asks about EV vs Petrol, do not give a generic utility report; compare EV vs Petrol.
4. If footprint data is available, use it in your answer to make calculations and estimates personalized (e.g. using the user's actual weekly car km or electricity usage).
5. If footprint data is missing (e.g., all values are 0 or empty), ask follow-up questions to collect data (e.g., about their weekly driving, electricity consumption, or meat intake) rather than providing a default footprint report.
6. Do not repeat suggested prompts or follow-up questions after every message. ONLY show follow-up suggestions when they are directly relevant to the user's question.
7. Do not display API errors, Gemini errors, stack traces, or technical failures.
8. Keep response style appropriate:
   - For greetings: Keep responses short and conversational. If the user says "Hello" or similar, greet them naturally by name (e.g., "Hello ${req.user.name.split(' ')[0]}! 👋 I'm EcoCoach...") and introduce yourself.
   - For analysis: Provide structured insights.
   - For advice: Provide actionable recommendations.
   - For comparisons: Use HTML tables.
   - For plans: Provide timelines.
9. You must ONLY respond using clean, standard HTML tags (such as <p>, <ul>, <li>, <strong>, <ol>, <hr />, <table>, <thead>, <tbody>, <tr>, <th>, <td>, etc.). DO NOT use any markdown formatting (no asterisks, no hashes, no markdown tables, no markdown bullet points).

## Specific Scenario Queries:
- "Hello": Reply naturally: "Hello ${req.user.name.split(' ')[0]}! 👋 I'm EcoCoach. I can help analyze your carbon footprint, suggest ways to reduce emissions, compare lifestyle choices, and answer sustainability questions. What would you like to explore today?"
- "Analyze my footprint": Give a structured report including: Total footprint, Largest emission source, Risk level, Key observations, and Personalized recommendations.
- "Generate a 30-day plan": Create a detailed day-by-day or week-by-week plan timeline based on their actual emissions.
- "What uses the most electricity?": Answer specifically about appliances and household consumption.
- "Compare EV vs petrol": Provide: Carbon comparison, Cost comparison, and Long-term impact. Use tables.
- "How am I doing?": Provide: Progress summary, Sustainability score, areas improving, and areas needing attention.
- "What if I reduce electricity by 20%?": Perform a simulation and estimate: CO₂ reduction, cost savings, and score improvement.

## Follow-up suggestions:
At the end of your response, you may include a horizontal rule (<hr />) and a clean HTML list of 2-3 suggested follow-up questions formatted as clickable links that call window.askAi *only* if they are directly relevant to the user's question and current topic.
CRITICAL: Do NOT automatically append:
- "Would you like a personalized 30-day plan?"
- "Want me to identify your biggest emission source?"
- "Interested in renewable energy options?"
after every message. Only show follow-up suggestions when they are directly relevant to the user's question. This is what currently makes the chat feel repetitive and non-AI.
`;

    const cascadeResult = await callGeminiCascade(apiKey, {
      prompt: question || 'Give me my top carbon insights.',
      systemInstruction: systemPrompt,
      history
    });

    res.json({ response: cascadeResult.text, offline: false, model: cascadeResult.modelUsed });
  } catch (err) {
    console.error('Gemini Insights API error:', err);
    const fallback = getFallbackAdvice(question, sliders, totalCo2, breakdown, req.user.name);
    res.json({
      response: `<p>Using your current footprint data, here's my assessment...</p>${fallback}`,
      offline: true
    });
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
      const prompt = `
Analyze this receipt/bill image. Identify:
1. The type of bill (Fuel, Electricity, Food, Shopping).
2. The primary quantity value (e.g. Litres of fuel, kWh electricity, meat meals count, clothing items).
3. The total monetary cost.
Respond ONLY in JSON format like this:
{ "type": "Electricity", "quantity": 180, "unit": "kWh", "cost": 45.50, "items": ["Grid Electricity Billing"] }
`;
      const cascadeResult = await callGeminiCascade(apiKey, {
        prompt,
        base64Image,
        mimeType: 'image/png'
      });
      textResult = cascadeResult.text;
    } catch (e) {
      console.error("Gemini OCR error, falling back to mock parser:", e.message);
    }
  }

  // High fidelity OCR parser simulation if offline or key failed
  try {
    let parsedData = {};
    if (textResult) {
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

    let emissions = 0;
    if (parsedData.type === 'Fuel' || receiptType === 'Fuel') {
      emissions = (parsedData.quantity || 45) * 0.0023; 
    } else if (parsedData.type === 'Electricity' || receiptType === 'Electricity') {
      emissions = (parsedData.quantity || 280) * 0.00082; 
    } else if (parsedData.type === 'Food' || receiptType === 'Food') {
      emissions = (parsedData.quantity || 3) * 0.015; 
    } else {
      emissions = (parsedData.quantity || 4) * 0.012; 
    }
    emissions = parseFloat(emissions.toFixed(3));

    const receiptRecord = await db.addOCRReceipt(req.user.id, {
      fileName,
      receiptType,
      extractedData: parsedData,
      emissions
    });

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
      const prompt = `
Analyze this picture of an item (${itemCategory}). Identify what object/meal/appliance it is, estimate its lifecycle carbon emissions impact (in kg CO2), and suggest a green alternative.
Respond strictly in JSON format:
{ "identifiedObject": "Object Name", "carbonImpactKg": 12.5, "alternative": "Green Alternative Suggestion", "confidenceScore": 92 }
`;
      const cascadeResult = await callGeminiCascade(apiKey, {
        prompt,
        base64Image,
        mimeType: 'image/png'
      });
      textResult = cascadeResult.text;
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

    await db.updateLeaderboard(req.user.id, req.user.name, 40, 1, 0);

    await db.addActivity(req.user.id, {
      date: new Date().toISOString().substring(0, 7),
      type: itemCategory === 'Meals' ? 'food' : itemCategory === 'Vehicles' ? 'transportation' : 'shopping',
      subType: itemCategory.toLowerCase().replace(' ', '_'),
      value: 1,
      emissions: parsed.carbonImpactKg * 0.001, 
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
      const cascadeResult = await callGeminiCascade(apiKey, { prompt });
      return res.json(JSON.parse(cascadeResult.text.replace(/```json|```/gi, '').trim()));
    } catch (e) {
      console.error("Gemini Future Earth error, falling back to local simulation:", e.message);
    }
  }

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
