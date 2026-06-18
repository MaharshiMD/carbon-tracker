const express = require('express');
const router = express.Router();
const db = require('../database');
const authMiddleware = require('../middleware/auth');

// @route   GET /api/gamification/status
// @desc    Get user's XP, level, badges, and streaks
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const leaderboard = await db.getLeaderboard();
    let userStats = leaderboard.find(l => l.userId === req.user.id);
    
    if (!userStats) {
      userStats = await db.updateLeaderboard(req.user.id, req.user.name, 100, 1, 1);
    }
    
    // Level formula: Level 1 = 0-999 XP, Level 2 = 1000-1999 XP, etc.
    const level = Math.floor(userStats.totalXP / 1000) + 1;
    const nextLevelXP = level * 1000;
    const prevLevelXP = (level - 1) * 1000;
    const progressXP = userStats.totalXP - prevLevelXP;
    
    const achievements = await db.getUserAchievements(req.user.id);
    
    res.json({
      xp: userStats.totalXP,
      level: level,
      progress: progressXP,
      nextLevelXP: 1000, // XP needed per level increments
      streak: userStats.streakCount || 1,
      badges: achievements
    });
  } catch (err) {
    console.error('Get gamification status error:', err);
    res.status(500).json({ error: 'Server error retrieving gamification status' });
  }
});

// @route   GET /api/gamification/challenges
// @desc    Get all daily and weekly challenges
router.get('/challenges', authMiddleware, async (req, res) => {
  try {
    const challenges = await db.getChallenges();
    // In local mode, challenges might have complete lists. We return them.
    res.json(challenges);
  } catch (err) {
    console.error('Get challenges error:', err);
    res.status(500).json({ error: 'Server error retrieving challenges' });
  }
});

// @route   POST /api/gamification/challenges/complete
// @desc    Complete a challenge, award XP, and unlock badges
router.post('/challenges/complete', authMiddleware, async (req, res) => {
  const { challengeId } = req.body;
  
  if (!challengeId) {
    return res.status(400).json({ error: 'challengeId is required' });
  }

  try {
    const challenges = await db.getChallenges();
    let challenge;
    if (db.isMongoConnected()) {
      challenge = challenges.find(c => c._id.toString() === challengeId);
    } else {
      challenge = challenges.find(c => c.id === challengeId);
    }

    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    const xpAward = challenge.xpReward || 100;
    const leaderboard = await db.getLeaderboard();
    const userStats = leaderboard.find(l => l.userId === req.user.id) || { totalXP: 100, streakCount: 1 };
    
    const oldLevel = Math.floor(userStats.totalXP / 1000) + 1;
    const newXP = userStats.totalXP + xpAward;
    const newLevel = Math.floor(newXP / 1000) + 1;
    
    // Add streak by 1 for daily challenges
    const streakAdd = challenge.duration === 'daily' ? 1 : 0;
    
    await db.updateLeaderboard(req.user.id, req.user.name, xpAward, newLevel, streakAdd);
    
    // Check achievements unlock conditions
    const notifications = [];
    
    // Achievement: Challenge Solver
    const firstChallenge = await db.unlockAchievement(req.user.id, {
      badgeId: 'badge_challenger',
      title: 'Challenge Champion',
      description: 'Completed your first carbon reduction challenge!',
      icon: '🏆'
    });
    
    // Achievement: Level Up
    if (newLevel > oldLevel) {
      await db.unlockAchievement(req.user.id, {
        badgeId: `badge_level_${newLevel}`,
        title: `Sustainability Level ${newLevel}`,
        description: `Scaled your sustainability awareness to level ${newLevel}!`,
        icon: '📈'
      });
      notifications.push(`Congratulations! You leveled up to Level ${newLevel}!`);
    }

    // Award custom badge if challenge specifies one
    if (challenge.badgeReward) {
      await db.unlockAchievement(req.user.id, {
        badgeId: challenge.badgeReward,
        title: challenge.badgeReward === 'badge_green_chef' ? 'Eco Chef' : 'Climate Hero',
        description: challenge.badgeReward === 'badge_green_chef' ? 'Ate meatless for 5 days in a row' : 'Master carbon reducer',
        icon: challenge.badgeReward === 'badge_green_chef' ? '🍳' : '🌟'
      });
      notifications.push(`You unlocked the ${challenge.badgeReward === 'badge_green_chef' ? 'Eco Chef' : 'Climate Hero'} Badge!`);
    }

    res.json({
      success: true,
      xpAwarded: xpAward,
      newTotalXP: newXP,
      levelUp: newLevel > oldLevel,
      streakUpdated: userStats.streakCount + streakAdd,
      notifications
    });
  } catch (err) {
    console.error('Complete challenge error:', err);
    res.status(500).json({ error: 'Server error completing challenge' });
  }
});

// @route   GET /api/gamification/leaderboard
// @desc    Get top users sorted by XP
router.get('/leaderboard', authMiddleware, async (req, res) => {
  try {
    const rawLeaderboard = await db.getLeaderboard();
    
    // Add sequential ranks
    const ranked = rawLeaderboard.map((user, idx) => ({
      userId: user.userId,
      name: user.name,
      totalXP: user.totalXP,
      carbonReductionLevel: user.carbonReductionLevel || Math.floor(user.totalXP / 1000) + 1,
      streakCount: user.streakCount || 0,
      rank: idx + 1
    }));
    
    res.json(ranked);
  } catch (err) {
    console.error('Get leaderboard error:', err);
    res.status(500).json({ error: 'Server error retrieving leaderboard' });
  }
});

module.exports = router;
