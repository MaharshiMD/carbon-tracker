# 🌱 EcoTwin AI — Backend API Service

This directory houses the backend REST API for EcoTwin AI, built with **Node.js**, **Express**, **JWT**, and **Google Gemini AI**.

---

## 🛠️ Key Architectural Subsystems

### 1. Unified Router Architecture
- **Auth Routes (`routes/auth.js`)**: Registration, secure password hashing (bcrypt), login validation, and profile sessions.
- **Tracking Routes (`routes/tracking.js`)**: Real-time user logs, travel ledger entries, and profile activity history.
- **Chat Routes (`routes/chat.js`)**: Coordinates context-rich conversations with EcoCoach AI.
- **AI/Insights Routes (`routes/ai.js`)**: Orchestrates the CV analyzer, receipt OCR scanning, Digital Twin descriptions, and Future Earth forecasts.
- **Gamification Routes (`routes/gamification.js`)**: Manages streaks, experience points, badge checks, and leaderboards.
- **Community Routes (`routes/community.js`)**: Handles tree planting goals and waste pollution reports.

### 💾 2. Dual-Layer Database Controller (`database.js`)
Offers a highly resilient dual database storage strategy:
- **MongoDB (Mongoose):** Engages production-grade schema structures when `MONGO_URI` is provided.
- **Offline JSON Fallback:** Persists data locally under `backend/data/*.json` if MongoDB is omitted or unreachable, enabling a zero-dependency development sandbox.

### 🛡️ 3. Throttling, Security & CORS Controls
- **Helmet:** Hardens HTTP headers to mitigate cross-site scripting (XSS) and clickjacking.
- **Rate-Limiting:** Strict rate limit rules are enforced per-IP to defend authentication endpoints, API services, and AI calls from misuse or scraping.
- **CORS Normalization:** Sanitizer middleware trims trailing slashes from allowed origins to prevent double-slash connection faults.

### 🧠 4. Robust Gemini Model Cascade
- Tries querying `gemini-2.5-flash` for requests, with automatic failover to `gemini-3.1-flash-lite` if the API encounters 503/429 limits or key errors.
- Integrates a smart, local, rule-based advisory engine that serves as a fallback advice system when offline or when no Gemini API key is configured.

---

## 🚀 Getting Started

### 1. Installation
Install workspace dependencies from the root directory:
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file under the `backend` folder:
```env
PORT=5000
JWT_SECRET=your_jwt_secret_key_here
GEMINI_API_KEY=your_gemini_api_key_here
MONGO_URI=your_mongodb_connection_uri_here
FRONTEND_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173
```
*(If `MONGO_URI` is omitted, the server dynamically runs on local JSON database files. If `GEMINI_API_KEY` is omitted, the local rule-based advisor fallbacks are activated.)*

### 3. Run Development Server
Start the Express API server from the root workspace context:
```bash
npm run dev:backend
```
The backend service will launch on [http://localhost:5000](http://localhost:5000).
