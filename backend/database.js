const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const FOOTPRINTS_FILE = path.join(DATA_DIR, 'footprints.json');
const ACTIONS_FILE = path.join(DATA_DIR, 'actions.json');
const TRAVEL_LOG_FILE = path.join(DATA_DIR, 'travel_logs.json');

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

// MongoDB Schemas & Models
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
  transportInputMode: { type: String, default: 'sliders' }, // 'sliders' | 'log'
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
  date: { type: String, required: true }, // YYYY-MM
  tripDate: { type: String, required: true }, // YYYY-MM-DD
  mode: { type: String, required: true, enum: ['car', 'transit', 'flight'] },
  distance: { type: Number, required: true }, // km
  description: { type: String, default: '' },
  emissions: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

let User, Footprint, Action, TravelLog;
let useMongo = false;

// Database Methods
const db = {
  async initDB() {
    const mongoUri = process.env.MONGO_URI;
    if (mongoUri && mongoUri.trim() !== '' && mongoUri !== 'YOUR_MONGO_URI') {
      try {
        await mongoose.connect(mongoUri);
        console.log('=============================================');
        console.log('MongoDB connected successfully.');
        console.log('=============================================');
        
        // Register Models
        User = mongoose.model('User', userSchema);
        Footprint = mongoose.model('Footprint', footprintSchema);
        Action = mongoose.model('Action', actionSchema);
        TravelLog = mongoose.model('TravelLog', travelLogSchema);
        
        useMongo = true;
      } catch (err) {
        console.error('MongoDB connection error. Falling back to local JSON files:', err.message);
        useMongo = false;
      }
    } else {
      console.log('No MONGO_URI provided. Running on local JSON storage mode.');
      useMongo = false;
    }
  },

  isMongoConnected() {
    return useMongo;
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
  }
};

module.exports = db;
