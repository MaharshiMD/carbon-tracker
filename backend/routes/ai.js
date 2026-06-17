const express = require('express');
const router = express.Router();
const db = require('../database');
const authMiddleware = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Rule-based fallback advisory engine for offline/no-key usage
function getFallbackAdvice(sliders, totalCo2, breakdown) {
  const cats = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  const primaryCat = cats[0][0];
  const primaryVal = cats[0][1];

  let responseHTML = ``;
  responseHTML += `<h4>Local Carbon Analysis Report (Offline Mode)</h4>`;
  responseHTML += `<p>Your estimated annual carbon footprint is <strong>${totalCo2} tonnes CO₂</strong>. For context, the global average is 4.7t, the average in India is 1.9t, and the Paris Agreement target to prevent critical warming is 2.0t per person.</p>`;
  responseHTML += `<p>Your highest emissions category is <strong>${primaryCat.toUpperCase()}</strong>, contributing <strong>${primaryVal}t CO₂/yr</strong>. Here is your personalized action plan:</p>`;
  responseHTML += `<ul>`;

  if (primaryCat === 'transport') {
    responseHTML += `<li><strong>Optimize Travel:</strong> Your driving of ${sliders.carKm} km/week represents a significant footprint. Sharing rides, switching to public transit (train/bus), or combining trips could save up to ${Math.min(1.2, parseFloat((sliders.carKm * 52 * 0.00017 * 0.5).toFixed(2)))} tonnes annually.</li>`;
    if (sliders.flightsCount > 0) {
      responseHTML += `<li><strong>Reduce Flight Frequency:</strong> Taking ${sliders.flightsCount} flights a year is a heavy emitter. Cutting just one medium flight saves roughly 0.9 tonnes of CO₂. Consider video conferencing or taking trains for medium distances.</li>`;
    } else {
      responseHTML += `<li><strong>Walk & Cycle:</strong> For short trips under 3km, opt for zero-emission active transit like cycling or walking to improve health and shave off emissions.</li>`;
    }
  } else if (primaryCat === 'energy') {
    responseHTML += `<li><strong>Improve Home Insulation & Heating:</strong> High power usage (${sliders.electricityKwh} kWh/mo) in grid systems that rely on coal produces high indirect emissions. Swapping incandescent bulbs for LEDs can reduce lighting energy by 75%.</li>`;
    if (sliders.gasCylinders > 2) {
      responseHTML += `<li><strong>Efficient Cooking habits:</strong> Using lid covers, pressure cookers, and cooking multiple meals in batches can optimize LPG consumption (${sliders.gasCylinders} cylinders/mo) and extend cylinder lifetimes.</li>`;
    } else {
      responseHTML += `<li><strong>Phantom Loads:</strong> Unplug electronic items (TV, gaming consoles, chargers) when not in use. "Standby power" accounts for up to 10% of standard household electricity bills.</li>`;
    }
  } else if (primaryCat === 'diet') {
    responseHTML += `<li><strong>Shift Your Diet:</strong> Consuming meat meals ${sliders.meatMeals} times/week contributes heavily. Replacing beef or pork with plant-based alternatives or poultry just 3 times a week can cut your dietary emissions by ~35%.</li>`;
    if (sliders.wasteLevel > 1) {
      responseHTML += `<li><strong>Minimise Food Waste:</strong> You reported food waste as ${sliders.wasteLevel === 3 ? 'High' : 'Medium'}. Roughly one-third of all food produced is wasted globally. Meal planning, freezing leftovers, and composting can eliminate this waste.</li>`;
    } else {
      responseHTML += `<li><strong>Buy Local & Seasonal:</strong> Shipping food long distances creates massive transport emissions. Purchasing locally harvested food reduces supply chain carbon footprints.</li>`;
    }
  } else {
    responseHTML += `<li><strong>Slow Fashion:</strong> Buying ${sliders.clothesCount} new items of clothing/month has a high manufacturing footprint. Opting for high-quality, durable garments or buying second-hand saves up to 25kg CO₂ per article.</li>`;
    if (sliders.shopCount > 5) {
      responseHTML += `<li><strong>Combine Deliveries:</strong> Having ${sliders.shopCount} online shipments/month increases courier delivery emissions. Grouping purchases into single orders reduces packaging waste and transport miles.</li>`;
    } else {
      responseHTML += `<li><strong>Repair & Repurpose:</strong> Instead of purchasing new goods, explore repairs, reuse networks, and tool libraries in your local community.</li>`;
    }
  }

  responseHTML += `<li><strong>Easy Win:</strong> Check out the 'Actions' tab and activate 'Switch to LED lighting throughout home' or 'Install a smart thermostat' to start shaving down your daily power load immediately.</li>`;
  responseHTML += `</ul>`;
  responseHTML += `<p><em>Note: To enable full conversational AI features powered by Gemini, please specify a valid <code>GEMINI_API_KEY</code> in the backend environmental configuration.</em></p>`;

  return responseHTML;
}

// @route   POST /api/ai/insights
// @desc    Securely query Gemini API with chat history and metrics or fallback
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
You are a friendly, highly professional carbon footprint expert and sustainability advisor named Gemini Carbon Expert.
You are helping a user who wants to track and reduce their emissions.

Here are the user's details:
- User Name: ${req.user.name}
- Total Footprint: ${totalCo2} tonnes CO₂ / year.
- Breakdown of categories (tonnes CO₂/year):
  * Transport: ${breakdown.transport}t (using ${sliders.transportInputMode || 'sliders'} mode)
  * Energy: ${breakdown.energy}t
  * Diet: ${breakdown.diet}t
  * Shopping & consumption: ${breakdown.shopping}t
- Lifestyle details (inputs):
  * Drives: ${sliders.carKm} km/week
  * Flights: ${sliders.flightsCount} flights/year
  * Transit: ${sliders.transitKm} km/week
  * Electricity: ${sliders.electricityKwh} kWh/month
  * Gas Cylinders: ${sliders.gasCylinders} cylinders/month
  * Meat Meals: ${sliders.meatMeals} meals/week
  * Food Waste Level: ${sliders.wasteLevel} (0=None, 1=Low, 2=Medium, 3=High)
  * New Clothes: ${sliders.clothesCount} items/month
  * Online orders: ${sliders.shopCount} deliveries/month

For context: India average is ~1.9t/year, global average is ~4.7t/year, and the sustainable Paris Agreement target is 2.0t/year per person.

Provide a conversational, highly helpful, encouraging response. Keep your advice structured, accurate, and tailored to the numbers above. Format your response using clean, simple HTML elements (like <p>, <ul>, <li>, <strong>, etc.) so it displays nicely in our dashboard card. Do not write markdown. Keep the response to 2-3 concise paragraphs max. If the user asks follow-up questions, respond in context of the previous conversations.
`;

    // Map conversation history to Gemini roles
    const geminiHistory = history.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: systemPrompt
    });

    const chat = model.startChat({
      history: geminiHistory
    });

    const result = await chat.sendMessage(question || 'What are the top 3 ways I can reduce my emissions?');
    const responseText = result.response.text();
    res.json({ response: responseText, offline: false });
  } catch (err) {
    console.error('Gemini API Integration error:', err);
    const fallbackAdvice = getFallbackAdvice(sliders, totalCo2, breakdown);
    res.json({
      response: `<p style="color:#993C1D;">Notice: Gemini API returned an error (${err.message}). Showing local carbon report instead.</p>` + fallbackAdvice,
      offline: true
    });
  }
});

module.exports = router;
