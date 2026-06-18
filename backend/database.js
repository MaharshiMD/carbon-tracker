const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// File Paths for JSON Fallback
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const FOOTPRINTS_FILE = path.join(DATA_DIR, 'footprints.json');
const ACTIONS_FILE = path.join(DATA_DIR, 'actions.json');
const TRAVEL_LOG_FILE = path.join(DATA_DIR, 'travel_logs.json');

const CARBON_PROFILES_FILE = path.join(DATA_DIR, 'carbon_profiles.json');
const ACTIVITIES_FILE = path.join(DATA_DIR, 'activities.json');
const OCR_RECEIPTS_FILE = path.join(DATA_DIR, 'ocr_receipts.json');
const RECOMMENDATIONS_FILE = path.join(DATA_DIR, 'recommendations.json');
const SIMULATIONS_FILE = path.join(DATA_DIR, 'simulations.json');
const CHALLENGES_FILE = path.join(DATA_DIR, 'challenges.json');
const ACHIEVEMENTS_FILE = path.join(DATA_DIR, 'achievements.json');
const COMMUNITY_FILE = path.join(DATA_DIR, 'community.json');
const LEADERBOARDS_FILE = path.join(DATA_DIR, 'leaderboards.json');

// File IO Helpers
function readJsonFile(filePath, defaultData = []) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content || JSON.stringify(defaultData));
  } catch (e) {
    console.error(`Error reading database file ${filePath}:`, e);
    return defaultData;
  }
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error(`Error writing database file ${filePath}:`, e);
    return false;
  }
}

// MongoDB Schemas
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const footprintSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  date: { type: String, required: true }, // YYYY-MM
  carKm: { type: Number, default: 0 },
  flightsCount: { type: Number, default: 0 },
  transitKm: { type: Number, default: 0 },
  electricityKwh: { type: Number, default: 0 },
  gasCylinders: { type: Number, default: 0 },
  meatMeals: { type: Number, default: 0 },
  wasteLevel: { type: Number, default: 0 },
  clothesCount: { type: Number, default: 0 },
  shopCount: { type: Number, default: 0 },
  transportInputMode: { type: String, default: 'sliders' },
  breakdown: {
    transport: { type: Number, default: 0 },
    energy: { type: Number, default: 0 },
    diet: { type: Number, default: 0 },
    shopping: { type: Number, default: 0 }
  },
  totalCo2: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});
footprintSchema.index({ userId: 1, date: 1 }, { unique: true });

const actionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  actionId: { type: String, required: true },
  completedAt: { type: Date, default: Date.now }
});
actionSchema.index({ userId: 1, actionId: 1 }, { unique: true });

const travelLogSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  date: { type: String, required: true },
  tripDate: { type: String, required: true },
  mode: { type: String, required: true, enum: ['car', 'transit', 'flight'] },
  distance: { type: Number, required: true },
  description: { type: String, default: '' },
  emissions: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

// New Schemas for EcoTwin AI
const carbonProfileSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  sustainabilityScore: { type: Number, default: 70 },
  riskScore: { type: String, default: 'B' }, // A, B, C, D, F
  predictedYearly: { type: Number, default: 0 },
  habits: { type: String, default: 'Learning patterns...' },
  updatedAt: { type: Date, default: Date.now }
});

const activitySchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  date: { type: String, required: true },
  type: { type: String, required: true }, // transportation, food, utilities, shopping, waste
  subType: { type: String, required: true },
  value: { type: Number, default: 0 },
  emissions: { type: Number, default: 0 },
  description: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const ocrReceiptSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  fileName: { type: String, required: true },
  receiptType: { type: String, required: true }, // Fuel, Electricity, Food, Shopping
  extractedData: { type: Object, default: {} },
  emissions: { type: Number, default: 0 },
  scannedAt: { type: Date, default: Date.now }
});

const aiRecommendationSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  actionId: { type: String, required: true },
  title: { type: String, required: true },
  impact: { type: Number, required: true },
  category: { type: String, required: true },
  advisoryText: { type: String, required: true },
  sentAt: { type: Date, default: Date.now }
});

const carbonSimulationSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  scenarios: { type: Array, default: [] },
  annualSavingsCo2: { type: Number, default: 0 },
  annualSavingsMoney: { type: Number, default: 0 },
  futureImpactYears: { type: Object, default: { 5: 0, 10: 0, 20: 0 } }
});

const challengeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true }, // Transport, Energy, Diet, Consumption
  xpReward: { type: Number, default: 100 },
  duration: { type: String, default: 'daily' }, // daily, weekly
  badgeReward: { type: String, default: '' }
});

const achievementSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  badgeId: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  icon: { type: String, default: '🏅' },
  unlockedAt: { type: Date, default: Date.now }
});

const communityDataSchema = new mongoose.Schema({
  region: { type: String, required: true, unique: true },
  totalFootprint: { type: Number, default: 0 },
  activeUsersCount: { type: Number, default: 0 },
  treePlantingsCount: { type: Number, default: 0 },
  wasteReports: { type: Array, default: [] }
});

const leaderboardSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  totalXP: { type: Number, default: 0 },
  rank: { type: Number, default: 1 },
  carbonReductionLevel: { type: Number, default: 1 },
  streakCount: { type: Number, default: 0 }
});

let User, Footprint, Action, TravelLog;
let CarbonProfile, CarbonActivity, OcrReceipt, AiRecommendation, CarbonSimulation, Challenge, Achievement, Community, Leaderboard;
let useMongo = false;

// Database Methods
const db = {
  async initDB() {
    const mongoUri = process.env.MONGO_URI;
    if (mongoUri && mongoUri.trim() !== '' && mongoUri !== 'YOUR_MONGO_URI') {
      try {
        await mongoose.connect(mongoUri);
        console.log('=============================================');
        console.log('MongoDB connected successfully for EcoTwin AI.');
        console.log('=============================================');
        
        // Register Models
        User = mongoose.model('User', userSchema);
        Footprint = mongoose.model('Footprint', footprintSchema);
        Action = mongoose.model('Action', actionSchema);
        TravelLog = mongoose.model('TravelLog', travelLogSchema);
        
        CarbonProfile = mongoose.model('CarbonProfile', carbonProfileSchema);
        CarbonActivity = mongoose.model('CarbonActivity', activitySchema);
        OcrReceipt = mongoose.model('OcrReceipt', ocrReceiptSchema);
        AiRecommendation = mongoose.model('AiRecommendation', aiRecommendationSchema);
        CarbonSimulation = mongoose.model('CarbonSimulation', carbonSimulationSchema);
        Challenge = mongoose.model('Challenge', challengeSchema);
        Achievement = mongoose.model('Achievement', achievementSchema);
        Community = mongoose.model('Community', communityDataSchema);
        Leaderboard = mongoose.model('Leaderboard', leaderboardSchema);
        
        useMongo = true;
        await this.seedInitialChallenges();
      } catch (err) {
        console.error('MongoDB connection error. Falling back to local JSON files:', err.message);
        useMongo = false;
        this.seedInitialChallengesSync();
      }
    } else {
      console.log('No MONGO_URI provided. Running on local JSON storage mode.');
      useMongo = false;
      this.seedInitialChallengesSync();
    }
  },

  isMongoConnected() {
    return useMongo;
  },

  // Seed default challenges if empty
  async seedInitialChallenges() {
    const initialChallenges = [
      { title: 'Public Transit Day', description: 'Take a bus or train to work/school instead of driving.', category: 'Transport', xpReward: 120, duration: 'daily' },
      { title: 'Zero Food Waste', description: 'Ensure all meals cooked today are completely consumed or stored safely without disposal.', category: 'Diet', xpReward: 100, duration: 'daily' },
      { title: 'Unplug the Vampires', description: 'Unplug all chargers, monitors, and devices before bed to eliminate standby power drain.', category: 'Energy', xpReward: 80, duration: 'daily' },
      { title: 'Local Produce Feast', description: 'Prepare a meal sourcing only local and seasonal farm ingredients.', category: 'Diet', xpReward: 150, duration: 'weekly' },
      { title: 'Meatless Weekdays', description: 'Go entirely vegetarian or vegan from Monday through Friday.', category: 'Diet', xpReward: 300, duration: 'weekly', badgeReward: 'badge_green_chef' },
      { title: 'Fast-Fashion Boycott', description: 'Do not purchase any new commercial garments for the next 7 days.', category: 'Consumption', xpReward: 200, duration: 'weekly' }
    ];

    if (useMongo) {
      const count = await Challenge.countDocuments();
      if (count === 0) {
        await Challenge.insertMany(initialChallenges);
      }
    }
  },

  seedInitialChallengesSync() {
    const fileData = readJsonFile(CHALLENGES_FILE, []);
    if (fileData.length === 0) {
      const initialChallenges = [
        { id: 'ch_transit', title: 'Public Transit Day', description: 'Take a bus or train to work/school instead of driving.', category: 'Transport', xpReward: 120, duration: 'daily' },
        { id: 'ch_waste', title: 'Zero Food Waste', description: 'Ensure all meals cooked today are stored or eaten without disposal.', category: 'Diet', xpReward: 100, duration: 'daily' },
        { id: 'ch_unplug', title: 'Unplug the Vampires', description: 'Unplug all unused appliances and chargers before bed.', category: 'Energy', xpReward: 80, duration: 'daily' },
        { id: 'ch_local', title: 'Local Produce Feast', description: 'Prepare a meal sourcing only local farm ingredients.', category: 'Diet', xpReward: 150, duration: 'weekly' },
        { id: 'ch_meatless', title: 'Meatless Weekdays', description: 'Go entirely vegetarian or vegan from Monday through Friday.', category: 'Diet', xpReward: 300, duration: 'weekly', badgeReward: 'badge_green_chef' },
        { id: 'ch_fast', title: 'Fast-Fashion Boycott', description: 'Do not purchase any new clothing for the next 7 days.', category: 'Consumption', xpReward: 200, duration: 'weekly' }
      ];
      writeJsonFile(CHALLENGES_FILE, initialChallenges);
    }
  },

  // --- USERS ---
  async getUsers() {
    if (useMongo) {
      return await User.find({});
    } else {
      return readJsonFile(USERS_FILE, []);
    }
  },

  async findUserByEmail(email) {
    if (useMongo) {
      return await User.findOne({ email: email.toLowerCase().trim() });
    } else {
      const users = await this.getUsers();
      return users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
    }
  },

  async findUserById(id) {
    if (useMongo) {
      return await User.findById(id);
    } else {
      const users = await this.getUsers();
      return users.find(u => u.id === id);
    }
  },

  async createUser(user) {
    if (useMongo) {
      const newUser = new User(user);
      await newUser.save();
      // Initialize corresponding CarbonProfile and Leaderboard
      await this.saveCarbonProfile(newUser._id.toString(), {
        sustainabilityScore: 70,
        riskScore: 'B',
        predictedYearly: 4.8,
        habits: 'Initial configuration loaded.'
      });
      await this.updateLeaderboard(newUser._id.toString(), newUser.name, 100, 1, 1);
      return newUser;
    } else {
      const users = await this.getUsers();
      const newUser = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        createdAt: new Date().toISOString(),
        ...user
      };
      users.push(newUser);
      writeJsonFile(USERS_FILE, users);
      // Initialize corresponding CarbonProfile and Leaderboard
      await this.saveCarbonProfile(newUser.id, {
        sustainabilityScore: 70,
        riskScore: 'B',
        predictedYearly: 4.8,
        habits: 'Initial configuration loaded.'
      });
      await this.updateLeaderboard(newUser.id, newUser.name, 100, 1, 1);
      return newUser;
    }
  },

  // --- FOOTPRINTS ---
  async getFootprints() {
    if (useMongo) {
      return await Footprint.find({});
    } else {
      return readJsonFile(FOOTPRINTS_FILE, []);
    }
  },

  async getUserFootprints(userId) {
    if (useMongo) {
      return await Footprint.find({ userId });
    } else {
      const footprints = await this.getFootprints();
      return footprints.filter(f => f.userId === userId);
    }
  },

  async getFootprintForMonth(userId, dateStr) {
    if (useMongo) {
      return await Footprint.findOne({ userId, date: dateStr });
    } else {
      const footprints = await this.getFootprints();
      return footprints.find(f => f.userId === userId && f.date === dateStr);
    }
  },

  async saveFootprint(userId, dateStr, data) {
    if (useMongo) {
      return await Footprint.findOneAndUpdate(
        { userId, date: dateStr },
        { $set: { userId, date: dateStr, updatedAt: new Date(), ...data } },
        { new: true, upsert: true }
      );
    } else {
      const footprints = await this.getFootprints();
      const index = footprints.findIndex(f => f.userId === userId && f.date === dateStr);

      const record = {
        userId,
        date: dateStr,
        updatedAt: new Date().toISOString(),
        ...data
      };

      if (index !== -1) {
        footprints[index] = { ...footprints[index], ...record };
      } else {
        record.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        footprints.push(record);
      }

      writeJsonFile(FOOTPRINTS_FILE, footprints);
      return record;
    }
  },

  // --- ACTIONS ---
  async getUserActions(userId) {
    if (useMongo) {
      const actions = await Action.find({ userId });
      return actions.map(a => a.actionId);
    } else {
      const actions = readJsonFile(ACTIONS_FILE, []);
      return actions.filter(a => a.userId === userId).map(a => a.actionId);
    }
  },

  async toggleUserAction(userId, actionId) {
    if (useMongo) {
      const existing = await Action.findOne({ userId, actionId });
      if (existing) {
        await Action.deleteOne({ _id: existing._id });
        return false;
      } else {
        const completed = new Action({ userId, actionId });
        await completed.save();
        return true;
      }
    } else {
      let actions = readJsonFile(ACTIONS_FILE, []);
      const index = actions.findIndex(a => a.userId === userId && a.actionId === actionId);
      let completed = false;

      if (index !== -1) {
        actions.splice(index, 1);
        completed = false;
      } else {
        actions.push({
          userId,
          actionId,
          completedAt: new Date().toISOString()
        });
        completed = true;
      }

      writeJsonFile(ACTIONS_FILE, actions);
      return completed;
    }
  },

  // --- TRAVEL LOG ---
  async getTravelLogs(userId, dateStr) {
    if (useMongo) {
      return await TravelLog.find({ userId, date: dateStr }).sort({ tripDate: 1 });
    } else {
      const logs = readJsonFile(TRAVEL_LOG_FILE, []);
      return logs
        .filter(l => l.userId === userId && l.date === dateStr)
        .sort((a, b) => a.tripDate.localeCompare(b.tripDate));
    }
  },

  async addTravelLog(userId, dateStr, tripData) {
    if (useMongo) {
      const newTrip = new TravelLog({
        userId,
        date: dateStr,
        ...tripData
      });
      return await newTrip.save();
    } else {
      const logs = readJsonFile(TRAVEL_LOG_FILE, []);
      const newTrip = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        userId,
        date: dateStr,
        createdAt: new Date().toISOString(),
        ...tripData
      };
      logs.push(newTrip);
      writeJsonFile(TRAVEL_LOG_FILE, logs);
      return newTrip;
    }
  },

  async deleteTravelLog(userId, logId) {
    if (useMongo) {
      const res = await TravelLog.deleteOne({ _id: logId, userId });
      return res.deletedCount > 0;
    } else {
      let logs = readJsonFile(TRAVEL_LOG_FILE, []);
      const initialLength = logs.length;
      logs = logs.filter(l => !(l.id === logId && l.userId === userId));
      writeJsonFile(TRAVEL_LOG_FILE, logs);
      return logs.length < initialLength;
    }
  },

  // --- CARBON TWIN PROFILE ---
  async getCarbonProfile(userId) {
    if (useMongo) {
      let profile = await CarbonProfile.findOne({ userId });
      if (!profile) {
        profile = new CarbonProfile({ userId });
        await profile.save();
      }
      return profile;
    } else {
      const profiles = readJsonFile(CARBON_PROFILES_FILE, []);
      let profile = profiles.find(p => p.userId === userId);
      if (!profile) {
        profile = {
          userId,
          sustainabilityScore: 70,
          riskScore: 'B',
          predictedYearly: 4.8,
          habits: 'Initial profile initialized. Analyze activities to refine insights.',
          updatedAt: new Date().toISOString()
        };
        profiles.push(profile);
        writeJsonFile(CARBON_PROFILES_FILE, profiles);
      }
      return profile;
    }
  },

  async saveCarbonProfile(userId, data) {
    if (useMongo) {
      return await CarbonProfile.findOneAndUpdate(
        { userId },
        { $set: { userId, updatedAt: new Date(), ...data } },
        { new: true, upsert: true }
      );
    } else {
      const profiles = readJsonFile(CARBON_PROFILES_FILE, []);
      const index = profiles.findIndex(p => p.userId === userId);
      const record = {
        userId,
        updatedAt: new Date().toISOString(),
        ...data
      };
      if (index !== -1) {
        profiles[index] = { ...profiles[index], ...record };
      } else {
        profiles.push(record);
      }
      writeJsonFile(CARBON_PROFILES_FILE, profiles);
      return record;
    }
  },

  // --- CARBON ACTIVITIES ---
  async getActivities(userId) {
    if (useMongo) {
      return await CarbonActivity.find({ userId }).sort({ createdAt: -1 });
    } else {
      const activities = readJsonFile(ACTIVITIES_FILE, []);
      return activities.filter(a => a.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
  },

  async addActivity(userId, activityData) {
    if (useMongo) {
      const act = new CarbonActivity({
        userId,
        ...activityData
      });
      return await act.save();
    } else {
      const activities = readJsonFile(ACTIVITIES_FILE, []);
      const newAct = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        userId,
        createdAt: new Date().toISOString(),
        ...activityData
      };
      activities.push(newAct);
      writeJsonFile(ACTIVITIES_FILE, activities);
      return newAct;
    }
  },

  // --- OCR RECEIPTS ---
  async getOCRReceipts(userId) {
    if (useMongo) {
      return await OcrReceipt.find({ userId }).sort({ scannedAt: -1 });
    } else {
      const receipts = readJsonFile(OCR_RECEIPTS_FILE, []);
      return receipts.filter(r => r.userId === userId).sort((a, b) => b.scannedAt.localeCompare(a.scannedAt));
    }
  },

  async addOCRReceipt(userId, receiptData) {
    if (useMongo) {
      const rec = new OcrReceipt({
        userId,
        ...receiptData
      });
      return await rec.save();
    } else {
      const receipts = readJsonFile(OCR_RECEIPTS_FILE, []);
      const newRec = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        userId,
        scannedAt: new Date().toISOString(),
        ...receiptData
      };
      receipts.push(newRec);
      writeJsonFile(OCR_RECEIPTS_FILE, receipts);
      return newRec;
    }
  },

  // --- CARBON SIMULATIONS ---
  async getSimulation(userId) {
    if (useMongo) {
      let sim = await CarbonSimulation.findOne({ userId });
      if (!sim) {
        sim = new CarbonSimulation({ userId });
        await sim.save();
      }
      return sim;
    } else {
      const sims = readJsonFile(SIMULATIONS_FILE, []);
      let sim = sims.find(s => s.userId === userId);
      if (!sim) {
        sim = {
          userId,
          scenarios: [],
          annualSavingsCo2: 0,
          annualSavingsMoney: 0,
          futureImpactYears: { 5: 0, 10: 0, 20: 0 }
        };
        sims.push(sim);
        writeJsonFile(SIMULATIONS_FILE, sims);
      }
      return sim;
    }
  },

  async saveSimulation(userId, simData) {
    if (useMongo) {
      return await CarbonSimulation.findOneAndUpdate(
        { userId },
        { $set: { userId, ...simData } },
        { new: true, upsert: true }
      );
    } else {
      const sims = readJsonFile(SIMULATIONS_FILE, []);
      const index = sims.findIndex(s => s.userId === userId);
      const record = {
        userId,
        ...simData
      };
      if (index !== -1) {
        sims[index] = { ...sims[index], ...record };
      } else {
        sims.push(record);
      }
      writeJsonFile(SIMULATIONS_FILE, sims);
      return record;
    }
  },

  // --- CHALLENGES ---
  async getChallenges() {
    if (useMongo) {
      return await Challenge.find({});
    } else {
      return readJsonFile(CHALLENGES_FILE, []);
    }
  },

  // --- ACHIEVEMENTS & GAMIFICATION STATUS ---
  async getUserAchievements(userId) {
    if (useMongo) {
      return await Achievement.find({ userId });
    } else {
      const achievements = readJsonFile(ACHIEVEMENTS_FILE, []);
      return achievements.filter(a => a.userId === userId);
    }
  },

  async unlockAchievement(userId, achievementData) {
    if (useMongo) {
      const exists = await Achievement.findOne({ userId, badgeId: achievementData.badgeId });
      if (exists) return exists;
      const newAch = new Achievement({
        userId,
        ...achievementData
      });
      return await newAch.save();
    } else {
      const achievements = readJsonFile(ACHIEVEMENTS_FILE, []);
      const exists = achievements.find(a => a.userId === userId && a.badgeId === achievementData.badgeId);
      if (exists) return exists;
      const newAch = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        userId,
        unlockedAt: new Date().toISOString(),
        ...achievementData
      };
      achievements.push(newAch);
      writeJsonFile(ACHIEVEMENTS_FILE, achievements);
      return newAch;
    }
  },

  async getLeaderboard() {
    if (useMongo) {
      return await Leaderboard.find({}).sort({ totalXP: -1 });
    } else {
      const boards = readJsonFile(LEADERBOARDS_FILE, []);
      return boards.sort((a, b) => b.totalXP - a.totalXP);
    }
  },

  async updateLeaderboard(userId, name, xpToAdd = 0, level = 1, streakToAdd = 0) {
    if (useMongo) {
      let record = await Leaderboard.findOne({ userId });
      if (!record) {
        record = new Leaderboard({ userId, name, totalXP: xpToAdd, carbonReductionLevel: level, streakCount: streakToAdd });
      } else {
        record.totalXP += xpToAdd;
        record.carbonReductionLevel = level || record.carbonReductionLevel;
        record.streakCount += streakToAdd;
      }
      await record.save();
      return record;
    } else {
      const boards = readJsonFile(LEADERBOARDS_FILE, []);
      const index = boards.findIndex(b => b.userId === userId);
      let record;
      if (index !== -1) {
        record = boards[index];
        record.totalXP += xpToAdd;
        record.carbonReductionLevel = level || record.carbonReductionLevel;
        record.streakCount += streakToAdd;
        boards[index] = record;
      } else {
        record = {
          userId,
          name,
          totalXP: xpToAdd,
          rank: 1,
          carbonReductionLevel: level,
          streakCount: streakToAdd
        };
        boards.push(record);
      }
      writeJsonFile(LEADERBOARDS_FILE, boards);
      return record;
    }
  },

  // --- COMMUNITY ---
  async getCommunityData() {
    const defaultCommunities = [
      { region: 'San Francisco Bay Area', totalFootprint: 1450, activeUsersCount: 320, treePlantingsCount: 18, wasteReports: [] },
      { region: 'Mumbai District', totalFootprint: 2150, activeUsersCount: 450, treePlantingsCount: 34, wasteReports: [] },
      { region: 'Greater London', totalFootprint: 1890, activeUsersCount: 280, treePlantingsCount: 22, wasteReports: [] },
      { region: 'Tokyo Metro', totalFootprint: 1720, activeUsersCount: 410, treePlantingsCount: 29, wasteReports: [] }
    ];

    if (useMongo) {
      const count = await Community.countDocuments();
      if (count === 0) {
        await Community.insertMany(defaultCommunities);
      }
      return await Community.find({});
    } else {
      const data = readJsonFile(COMMUNITY_FILE, []);
      if (data.length === 0) {
        writeJsonFile(COMMUNITY_FILE, defaultCommunities);
        return defaultCommunities;
      }
      return data;
    }
  },

  async addTreePlanting(region) {
    if (useMongo) {
      return await Community.findOneAndUpdate(
        { region },
        { $inc: { treePlantingsCount: 1 } },
        { new: true, upsert: true }
      );
    } else {
      const data = readJsonFile(COMMUNITY_FILE, []);
      const index = data.findIndex(c => c.region === region);
      if (index !== -1) {
        data[index].treePlantingsCount += 1;
      } else {
        data.push({ region, totalFootprint: 100, activeUsersCount: 1, treePlantingsCount: 1, wasteReports: [] });
      }
      writeJsonFile(COMMUNITY_FILE, data);
      return index !== -1 ? data[index] : data[data.length - 1];
    }
  },

  async addWasteReport(region, report) {
    if (useMongo) {
      return await Community.findOneAndUpdate(
        { region },
        { $push: { wasteReports: report } },
        { new: true, upsert: true }
      );
    } else {
      const data = readJsonFile(COMMUNITY_FILE, []);
      const index = data.findIndex(c => c.region === region);
      if (index !== -1) {
        data[index].wasteReports = data[index].wasteReports || [];
        data[index].wasteReports.push(report);
      } else {
        data.push({ region, totalFootprint: 100, activeUsersCount: 1, treePlantingsCount: 0, wasteReports: [report] });
      }
      writeJsonFile(COMMUNITY_FILE, data);
      return index !== -1 ? data[index] : data[data.length - 1];
    }
  }
};

module.exports = db;
