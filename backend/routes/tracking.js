const express = require('express');
const router = express.Router();
const db = require('../database');
const authMiddleware = require('../middleware/auth');

// Real-world action definitions
const ACTIONS_LIST = [
  { id: 'act_led', title: 'Switch to LED lighting throughout home', impact: 0.15, cat: 'Energy', level: 'low' },
  { id: 'act_meat', title: 'Reduce meat to 3 meals per week', impact: 0.65, cat: 'Diet', level: 'high' },
  { id: 'act_flight', title: 'Take 1 fewer flight this year', impact: 0.90, cat: 'Transport', level: 'high' },
  { id: 'act_transit', title: 'Use public transit for commutes', impact: 0.45, cat: 'Transport', level: 'med' },
  { id: 'act_thermostat', title: 'Install a smart thermostat', impact: 0.25, cat: 'Energy', level: 'med' },
  { id: 'act_clothes', title: 'Buy second-hand clothing', impact: 0.20, cat: 'Shopping', level: 'low' },
  { id: 'act_shop', title: 'Reduce online shopping by half', impact: 0.12, cat: 'Shopping', level: 'low' },
  { id: 'act_plant_day', title: 'Eat plant-based one full day per week', impact: 0.18, cat: 'Diet', level: 'low' },
];

// Enhanced Carbon Footprint Calculations
function calculateCarbon(sliders, travelLogEmissions = 0) {
  // 1. Transportation
  const car = (sliders.carKm || 0) * 52 * 0.00017;           // 0.17 kg/km for gas cars
  const ev = (sliders.evKm || 0) * 52 * 0.00003;             // 0.03 kg/km for electric cars
  const flights = (sliders.flightsCount || 0) * 0.9;         // 900 kg per flight
  const transit = (sliders.transitKm || 0) * 52 * 0.00004;    // 0.04 kg/km for transit

  const transportVal = sliders.transportInputMode === 'log'
    ? travelLogEmissions
    : (car + ev + flights + transit);

  // 2. Home Energy & Utilities
  // Grid electricity is 0.82 kg/kWh, Solar decreases emissions by 80% to 0.16 kg/kWh
  const gridFactor = sliders.solarSavings ? 0.016 : 0.082;
  const electricity = (sliders.electricityKwh || 0) * 12 * 0.001 * gridFactor; 
  const gas = (sliders.gasCylinders || 0) * 12 * 0.0423;      // 42.3 kg per cylinder
  const water = (sliders.waterUsage || 0) * 12 * 0.0003;       // 0.3 kg CO2 per 1000 litres
  const energyVal = electricity + gas + water;

  // 3. Diet & Waste
  const meat = (sliders.meatMeals || 0) * 52 * 0.0027;        // 2.7 kg per meal
  // Recycling offset reduces waste footprint by up to 75%
  const wasteReduction = 1 - (Math.min(3, sliders.recycleRatio || 0) * 0.25);
  const waste = (sliders.wasteLevel || 0) * 0.2 * wasteReduction; // 0.2t base per level
  const dietVal = meat + waste;

  // 4. Shopping & Apparel
  const clothes = (sliders.clothesCount || 0) * 12 * 0.025;   // 25 kg per piece
  const shop = (sliders.shopCount || 0) * 12 * 0.003;         // 3 kg per parcel
  const shoppingVal = clothes + shop;

  const total = transportVal + energyVal + dietVal + shoppingVal;
  
  return {
    breakdown: {
      transport: parseFloat(transportVal.toFixed(2)),
      energy: parseFloat(energyVal.toFixed(2)),
      diet: parseFloat(dietVal.toFixed(2)),
      shopping: parseFloat(shoppingVal.toFixed(2)),
    },
    total: parseFloat(total.toFixed(2))
  };
}

// Calculate Sustainability Score & Risk Rating
function getTwinRiskMetrics(totalCo2) {
  // Average Global is 4.7t. Paris Climate goal is 2.0t.
  // Sustainability Score: 0 to 100
  let score = Math.round(100 - (totalCo2 * 7.5));
  score = Math.max(10, Math.min(100, score));

  let risk = 'C';
  if (totalCo2 < 2.0) risk = 'A';
  else if (totalCo2 < 4.0) risk = 'B';
  else if (totalCo2 < 7.0) risk = 'C';
  else if (totalCo2 < 12.0) risk = 'D';
  else risk = 'F';

  let habitsSummary = '';
  if (totalCo2 < 2.0) {
    habitsSummary = 'Excellent! Your lifestyle is aligned with the Paris Climate Accord targets. Keep advocating sustainability!';
  } else if (totalCo2 < 4.5) {
    habitsSummary = 'Moderate carbon footprint. Small switches in daily meals and local transit can elevate you to Carbon Zero status.';
  } else if (totalCo2 < 8.0) {
    habitsSummary = 'Average emissions patterns detected. Heating fuel, high-grid electricity, and heavy meat consumption are contributing factors.';
  } else {
    habitsSummary = 'High emission alerts. Consider immediate changes in fossil fuel transport, switching to solar power, and minimizing consumption volumes.';
  }

  return { sustainabilityScore: score, riskScore: risk, habits: habitsSummary };
}

// @route   POST /api/tracking/footprint
// @desc    Save/Update footprint for a month
router.post('/footprint', authMiddleware, async (req, res) => {
  const {
    date, // YYYY-MM
    carKm,
    evKm,
    flightsCount,
    transitKm,
    electricityKwh,
    gasCylinders,
    waterUsage,
    meatMeals,
    wasteLevel,
    recycleRatio,
    clothesCount,
    shopCount,
    solarSavings,
    transportInputMode // sliders | log
  } = req.body;

  if (!date || !/^\d{4}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Date must be in YYYY-MM format' });
  }

  try {
    let travelLogEmissions = 0;
    if (transportInputMode === 'log') {
      const logs = await db.getTravelLogs(req.user.id, date);
      travelLogEmissions = logs.reduce((sum, trip) => sum + trip.emissions, 0);
    }

    // Sanitize numeric slider values
    const sliders = {
      carKm: Math.max(0, Math.min(1000, Number(carKm) || 0)),
      evKm: Math.max(0, Math.min(1000, Number(evKm) || 0)),
      flightsCount: Math.max(0, Math.min(50, Number(flightsCount) || 0)),
      transitKm: Math.max(0, Math.min(1000, Number(transitKm) || 0)),
      electricityKwh: Math.max(0, Math.min(5000, Number(electricityKwh) || 0)),
      gasCylinders: Math.max(0, Math.min(20, Number(gasCylinders) || 0)),
      waterUsage: Math.max(0, Math.min(30000, Number(waterUsage) || 0)),
      meatMeals: Math.max(0, Math.min(21, Number(meatMeals) || 0)),
      wasteLevel: Math.max(0, Math.min(3, Number(wasteLevel) || 0)),
      recycleRatio: Math.max(0, Math.min(3, Number(recycleRatio) || 0)),
      clothesCount: Math.max(0, Math.min(100, Number(clothesCount) || 0)),
      shopCount: Math.max(0, Math.min(100, Number(shopCount) || 0)),
      solarSavings: !!solarSavings,
      transportInputMode: transportInputMode === 'log' ? 'log' : 'sliders'
    };

    const calc = calculateCarbon(sliders, travelLogEmissions);

    const record = await db.saveFootprint(req.user.id, date, {
      ...sliders,
      breakdown: calc.breakdown,
      totalCo2: calc.total
    });

    // Update Digital Carbon Twin Profile metrics automatically
    const metrics = getTwinRiskMetrics(calc.total);
    await db.saveCarbonProfile(req.user.id, {
      sustainabilityScore: metrics.sustainabilityScore,
      riskScore: metrics.riskScore,
      predictedYearly: calc.total,
      habits: metrics.habits
    });

    // Award 80 XP for saving monthly tracking logs
    await db.updateLeaderboard(req.user.id, req.user.name, 80, Math.floor(metrics.sustainabilityScore / 10), 0);

    res.json({ record, twinScore: metrics.sustainabilityScore, twinRisk: metrics.riskScore });
  } catch (err) {
    console.error('Save footprint error:', err);
    res.status(500).json({ error: 'Server error saving carbon footprint data' });
  }
});

// @route   POST /api/tracking/activity
// @desc    Log a single carbon activity (Meal, Commute, Appliance Use, Waste item)
router.post('/activity', authMiddleware, async (req, res) => {
  const { type, subType, value, description, date } = req.body;

  if (!type || !subType || value === undefined) {
    return res.status(400).json({ error: 'Activity type, subType, and value are required.' });
  }

  const targetMonth = date || new Date().toISOString().substring(0, 7);

  // Calculate emissions (tonnes) for single activity instances
  let emissions = 0;
  if (type === 'food') {
    // subType: beef = 0.015t, chicken = 0.003t, vegan = -0.001t (offset offset credit)
    if (subType === 'beef') emissions = 0.015;
    else if (subType === 'chicken') emissions = 0.003;
    else if (subType === 'vegan') emissions = -0.001; // plant savings
    else emissions = 0.002;
  } else if (type === 'transportation') {
    // subType: gasCar = km * 0.00017, ev = km * 0.00003, bus = km * 0.00004
    const km = Number(value) || 0;
    if (subType === 'car') emissions = km * 0.00017;
    else if (subType === 'ev') emissions = km * 0.00003;
    else emissions = km * 0.00004;
  } else if (type === 'utilities') {
    // subType: power = kWh * 0.00082, solar = kWh * 0.00016
    const kwh = Number(value) || 0;
    if (subType === 'solar') emissions = kwh * 0.00016;
    else emissions = kwh * 0.00082;
  } else {
    emissions = Number(value) * 0.005; // general items multiplier
  }

  emissions = parseFloat(emissions.toFixed(4));

  try {
    const activityRecord = await db.addActivity(req.user.id, {
      date: targetMonth,
      type,
      subType,
      value: Number(value),
      emissions,
      description: description || `Logged ${type} activity`
    });

    // Award user 20 XP for logging an activity
    await db.updateLeaderboard(req.user.id, req.user.name, 20, 1, 0);

    // Check achievement unlock
    await db.unlockAchievement(req.user.id, {
      badgeId: 'badge_first_log',
      title: 'Action Starter',
      description: 'Logged your first granular activity into the Carbon Activity Ledger.',
      icon: '📝'
    });

    res.status(201).json(activityRecord);
  } catch (err) {
    console.error('Log activity error:', err);
    res.status(500).json({ error: 'Server error saving individual activity log' });
  }
});

// @route   GET /api/tracking/activity
// @desc    Get logged activity ledger
router.get('/activity', authMiddleware, async (req, res) => {
  try {
    const ledger = await db.getActivities(req.user.id);
    res.json(ledger);
  } catch (err) {
    console.error('Get activities ledger error:', err);
    res.status(500).json({ error: 'Server error retrieving activity ledger' });
  }
});

// @route   GET /api/tracking/history
// @desc    Get historical footprints
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const records = await db.getUserFootprints(req.user.id);
    records.sort((a, b) => a.date.localeCompare(b.date));
    res.json(records);
  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ error: 'Server error retrieving tracking logs' });
  }
});

// @route   GET /api/tracking/actions
// @desc    Get all actions and user completion state
router.get('/actions', authMiddleware, async (req, res) => {
  try {
    const completedActionIds = await db.getUserActions(req.user.id);
    const actions = ACTIONS_LIST.map(a => ({
      ...a,
      done: completedActionIds.includes(a.id)
    }));
    res.json(actions);
  } catch (err) {
    console.error('Get actions error:', err);
    res.status(500).json({ error: 'Server error fetching actions list' });
  }
});

// @route   POST /api/tracking/actions/toggle
// @desc    Toggle execution state of a footprint action
router.post('/actions/toggle', authMiddleware, async (req, res) => {
  const { actionId } = req.body;

  if (!actionId) {
    return res.status(400).json({ error: 'actionId is required' });
  }

  const validAction = ACTIONS_LIST.find(a => a.id === actionId);
  if (!validAction) {
    return res.status(400).json({ error: 'Invalid actionId' });
  }

  try {
    const completed = await db.toggleUserAction(req.user.id, actionId);
    
    // Award 40 XP for taking action
    if (completed) {
      await db.updateLeaderboard(req.user.id, req.user.name, 40, 1, 0);
      await db.unlockAchievement(req.user.id, {
        badgeId: 'badge_first_action',
        title: 'Carbon Cutter',
        description: 'Pledged and completed your first reduction action item!',
        icon: '✂️'
      });
    }

    res.json({ actionId, completed });
  } catch (err) {
    console.error('Toggle action error:', err);
    res.status(500).json({ error: 'Server error updating action progress' });
  }
});

// @route   GET /api/tracking/simulations
// @desc    Get simulation configuration
router.get('/simulations', authMiddleware, async (req, res) => {
  try {
    const sim = await db.getSimulation(req.user.id);
    res.json(sim);
  } catch (err) {
    console.error('Get simulation error:', err);
    res.status(500).json({ error: 'Server error fetching scenario simulation' });
  }
});

// @route   POST /api/tracking/simulations
// @desc    Save simulation configurations and projected carbon/financial savings
router.post('/simulations', authMiddleware, async (req, res) => {
  const { scenarios, annualSavingsCo2, annualSavingsMoney, futureImpactYears } = req.body;

  try {
    const updatedSim = await db.saveSimulation(req.user.id, {
      scenarios: scenarios || [],
      annualSavingsCo2: Number(annualSavingsCo2) || 0,
      annualSavingsMoney: Number(annualSavingsMoney) || 0,
      futureImpactYears: futureImpactYears || { 5: 0, 10: 0, 20: 0 }
    });

    // Award 50 XP for planning simulations
    await db.updateLeaderboard(req.user.id, req.user.name, 50, 1, 0);

    await db.unlockAchievement(req.user.id, {
      badgeId: 'badge_simulator',
      title: 'Future Planner',
      description: 'Simulated climate scenarios and projected multi-year savings.',
      icon: '🔮'
    });

    res.json(updatedSim);
  } catch (err) {
    console.error('Save simulation error:', err);
    res.status(500).json({ error: 'Server error saving simulation configurations' });
  }
});

// --- TRAVEL LOG ROUTING ---
router.get('/travel-log', authMiddleware, async (req, res) => {
  const { date } = req.query; // YYYY-MM
  if (!date || !/^\d{4}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Date must be in YYYY-MM format' });
  }

  try {
    const logs = await db.getTravelLogs(req.user.id, date);
    res.json(logs);
  } catch (err) {
    console.error('Get travel logs error:', err);
    res.status(500).json({ error: 'Server error retrieving travel logs' });
  }
});

router.post('/travel-log', authMiddleware, async (req, res) => {
  const { date, tripDate, mode, distance, description } = req.body;

  if (!date || !/^\d{4}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Date must be in YYYY-MM format' });
  }
  if (!tripDate || !/^\d{4}-\d{2}-\d{2}$/.test(tripDate)) {
    return res.status(400).json({ error: 'Trip date must be in YYYY-MM-DD format' });
  }
  if (!['car', 'transit', 'flight'].includes(mode)) {
    return res.status(400).json({ error: 'Mode must be car, transit, or flight' });
  }
  if (distance === undefined || isNaN(distance) || distance <= 0) {
    return res.status(400).json({ error: 'Distance must be a positive number' });
  }

  // Calculate emissions (tonnes CO2)
  let emissions = 0;
  if (mode === 'car') {
    emissions = distance * 0.00017;
  } else if (mode === 'transit') {
    emissions = distance * 0.00004;
  } else if (mode === 'flight') {
    emissions = distance * 0.00018;
  }
  emissions = parseFloat(emissions.toFixed(3));

  try {
    const newTrip = await db.addTravelLog(req.user.id, date, {
      tripDate,
      mode,
      distance: Number(distance),
      description: description || '',
      emissions
    });

    const footprint = await db.getFootprintForMonth(req.user.id, date);
    if (footprint && footprint.transportInputMode === 'log') {
      const logs = await db.getTravelLogs(req.user.id, date);
      const totalTravelEmissions = logs.reduce((sum, trip) => sum + trip.emissions, 0);
      const calc = calculateCarbon(footprint, totalTravelEmissions);
      await db.saveFootprint(req.user.id, date, {
        breakdown: calc.breakdown,
        totalCo2: calc.total
      });
    }

    res.status(201).json(newTrip);
  } catch (err) {
    console.error('Add travel log error:', err);
    res.status(500).json({ error: 'Server error saving travel log entry' });
  }
});

router.delete('/travel-log/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { date } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Trip log ID is required' });
  }

  try {
    const success = await db.deleteTravelLog(req.user.id, id);
    if (!success) {
      return res.status(404).json({ error: 'Travel log entry not found' });
    }

    if (date) {
      const footprint = await db.getFootprintForMonth(req.user.id, date);
      if (footprint && footprint.transportInputMode === 'log') {
        const logs = await db.getTravelLogs(req.user.id, date);
        const totalTravelEmissions = logs.reduce((sum, trip) => sum + trip.emissions, 0);
        const calc = calculateCarbon(footprint, totalTravelEmissions);
        await db.saveFootprint(req.user.id, date, {
          breakdown: calc.breakdown,
          totalCo2: calc.total
        });
      }
    }

    res.json({ success: true, message: 'Travel log entry deleted' });
  } catch (err) {
    console.error('Delete travel log error:', err);
    res.status(500).json({ error: 'Server error deleting travel log entry' });
  }
});

module.exports = router;
