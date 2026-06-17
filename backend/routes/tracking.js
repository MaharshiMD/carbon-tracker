const express = require('express');
const router = express.Router();
const db = require('../database');
const authMiddleware = require('../middleware/auth');

// Real-world action definitions
const ACTIONS_LIST = [
  { id: 'act_led', title: 'Switch to LED lighting throughout home', impact: 0.1, cat: 'Energy', level: 'low' },
  { id: 'act_meat', title: 'Reduce meat to 3 meals per week', impact: 0.5, cat: 'Diet', level: 'high' },
  { id: 'act_flight', title: 'Take 1 fewer flight this year', impact: 1.5, cat: 'Transport', level: 'high' },
  { id: 'act_transit', title: 'Use public transit for commutes', impact: 0.4, cat: 'Transport', level: 'med' },
  { id: 'act_thermostat', title: 'Install a smart thermostat', impact: 0.2, cat: 'Energy', level: 'med' },
  { id: 'act_clothes', title: 'Buy second-hand clothing', impact: 0.2, cat: 'Shopping', level: 'low' },
  { id: 'act_shop', title: 'Reduce online shopping by half', impact: 0.1, cat: 'Shopping', level: 'low' },
  { id: 'act_plant_day', title: 'Eat plant-based one full day per week', impact: 0.15, cat: 'Diet', level: 'low' },
];

// Calculation helper
function calculateCarbon(sliders, travelLogEmissions = 0) {
  const car = (sliders.carKm || 0) * 52 * 0.00017;          // 0.17 kg/km
  const flights = (sliders.flightsCount || 0) * 0.9;         // 900 kg per flight
  const transit = (sliders.transitKm || 0) * 52 * 0.00004;    // 0.04 kg/km

  const transportVal = sliders.transportInputMode === 'log'
    ? travelLogEmissions
    : (car + flights + transit);

  const electricity = (sliders.electricityKwh || 0) * 12 * 0.00082; // 0.82 kg/kWh (India coal grid)
  const gas = (sliders.gasCylinders || 0) * 12 * 0.0423;      // 42.3 kg per cylinder
  const meat = (sliders.meatMeals || 0) * 52 * 0.0027;        // 2.7 kg per meal
  const waste = (sliders.wasteLevel || 0) * 0.2;              // 0.2t per waste scale
  const clothes = (sliders.clothesCount || 0) * 12 * 0.025;   // 25 kg per piece
  const shop = (sliders.shopCount || 0) * 12 * 0.003;         // 3 kg per parcel

  const total = transportVal + electricity + gas + meat + waste + clothes + shop;
  return {
    breakdown: {
      transport: parseFloat(transportVal.toFixed(2)),
      energy: parseFloat((electricity + gas).toFixed(2)),
      diet: parseFloat((meat + waste).toFixed(2)),
      shopping: parseFloat((clothes + shop).toFixed(2)),
    },
    total: parseFloat(total.toFixed(2))
  };
}

// @route   POST /api/tracking/footprint
// @desc    Save/Update footprint for a month
router.post('/footprint', authMiddleware, async (req, res) => {
  const {
    date, // YYYY-MM
    carKm,
    flightsCount,
    transitKm,
    electricityKwh,
    gasCylinders,
    meatMeals,
    wasteLevel,
    clothesCount,
    shopCount,
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

    // Sanitize and validate numeric slider ranges
    const sliders = {
      carKm: Math.max(0, Math.min(1000, Number(carKm) || 0)),
      flightsCount: Math.max(0, Math.min(50, Number(flightsCount) || 0)),
      transitKm: Math.max(0, Math.min(1000, Number(transitKm) || 0)),
      electricityKwh: Math.max(0, Math.min(5000, Number(electricityKwh) || 0)),
      gasCylinders: Math.max(0, Math.min(20, Number(gasCylinders) || 0)),
      meatMeals: Math.max(0, Math.min(21, Number(meatMeals) || 0)),
      wasteLevel: Math.max(0, Math.min(3, Number(wasteLevel) || 0)),
      clothesCount: Math.max(0, Math.min(100, Number(clothesCount) || 0)),
      shopCount: Math.max(0, Math.min(100, Number(shopCount) || 0)),
      transportInputMode: transportInputMode === 'log' ? 'log' : 'sliders'
    };

    const calc = calculateCarbon(sliders, travelLogEmissions);

    const record = await db.saveFootprint(req.user.id, date, {
      ...sliders,
      breakdown: calc.breakdown,
      totalCo2: calc.total
    });

    res.json(record);
  } catch (err) {
    console.error('Save footprint error:', err);
    res.status(500).json({ error: 'Server error saving carbon footprint data' });
  }
});

// @route   GET /api/tracking/history
// @desc    Get historical footprints
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const records = await db.getUserFootprints(req.user.id);
    // Sort chronological ascending
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
    res.json({ actionId, completed });
  } catch (err) {
    console.error('Toggle action error:', err);
    res.status(500).json({ error: 'Server error updating action progress' });
  }
});

// --- TRAVEL LOG ROUTING ---

// @route   GET /api/tracking/travel-log
// @desc    Get travel log entries for a month
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

// @route   POST /api/tracking/travel-log
// @desc    Add a travel log entry
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
    emissions = distance * 0.00018; // ~180g CO2 per km
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

    // Automatically recalculate and update footprint if the mode is 'log'
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

// @route   DELETE /api/tracking/travel-log/:id
// @desc    Delete a travel log entry
router.delete('/travel-log/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { date } = req.query; // Need date to recalculate footprint if needed

  if (!id) {
    return res.status(400).json({ error: 'Trip log ID is required' });
  }

  try {
    const success = await db.deleteTravelLog(req.user.id, id);
    if (!success) {
      return res.status(404).json({ error: 'Travel log entry not found' });
    }

    // Automatically recalculate and update footprint if the mode is 'log' and date is provided
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
