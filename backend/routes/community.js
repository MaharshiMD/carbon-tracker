const express = require('express');
const router = express.Router();
const db = require('../database');
const authMiddleware = require('../middleware/auth');

// @route   GET /api/community/heatmap
// @desc    Get aggregated regional datasets and metrics for community maps
router.get('/heatmap', authMiddleware, async (req, res) => {
  try {
    const data = await db.getCommunityData();
    
    // Sort regions descending by active users / participation
    const formatted = data.map(node => ({
      region: node.region,
      totalFootprint: node.totalFootprint,
      activeUsers: node.activeUsersCount,
      treePlantings: node.treePlantingsCount,
      wasteReportsCount: (node.wasteReports || []).length,
      wasteReports: node.wasteReports || []
    }));
    
    res.json(formatted);
  } catch (err) {
    console.error('Get community heatmap error:', err);
    res.status(500).json({ error: 'Server error retrieving community data' });
  }
});

// @route   POST /api/community/events/plant-tree
// @desc    Plant a tree, increment counts, and award user XP
router.post('/events/plant-tree', authMiddleware, async (req, res) => {
  const { region } = req.body;
  
  if (!region) {
    return res.status(400).json({ error: 'Region is required' });
  }

  try {
    const updatedCommunity = await db.addTreePlanting(region);
    
    // Award the user 150 XP for planting a tree!
    const updatedLeaderboard = await db.updateLeaderboard(req.user.id, req.user.name, 150, 1, 0);
    
    // Check tree planting badge
    await db.unlockAchievement(req.user.id, {
      badgeId: 'badge_tree_planter',
      title: 'Green Thumb',
      description: 'Logged a tree planting activity in your local community!',
      icon: '🌳'
    });

    res.json({
      success: true,
      message: `Successfully logged a tree planting in ${region}!`,
      treePlantingsCount: updatedCommunity.treePlantingsCount,
      xpAwarded: 150
    });
  } catch (err) {
    console.error('Plant tree event error:', err);
    res.status(500).json({ error: 'Server error logging tree plantation' });
  }
});

// @route   POST /api/community/events/report-waste
// @desc    Submit an anonymous citizen waste report to a region
router.post('/events/report-waste', authMiddleware, async (req, res) => {
  const { region, wasteType, location, description } = req.body;
  
  if (!region || !wasteType || !location) {
    return res.status(400).json({ error: 'Region, waste type, and location are required' });
  }

  try {
    const reportItem = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      wasteType,
      location,
      description: description || 'No details provided.',
      reporterName: 'Anonymous Twin Citizen',
      reportedAt: new Date().toISOString()
    };
    
    const updatedCommunity = await db.addWasteReport(region, reportItem);
    
    // Award user 50 XP for civic responsibility!
    await db.updateLeaderboard(req.user.id, req.user.name, 50, 1, 0);
    
    // Check civic champion badge
    await db.unlockAchievement(req.user.id, {
      badgeId: 'badge_civic_hero',
      title: 'Eco Guardian',
      description: 'Reported an environmental hazard to the community map.',
      icon: '🛡️'
    });

    res.json({
      success: true,
      message: `Successfully reported waste hazard at ${location} in ${region}!`,
      xpAwarded: 50,
      report: reportItem
    });
  } catch (err) {
    console.error('Report waste event error:', err);
    res.status(500).json({ error: 'Server error reporting environmental waste' });
  }
});

module.exports = router;
