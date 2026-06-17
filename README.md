# 🌱 Carbon Footprint Tracker — AI-Powered Sustainability Advisor

An interactive, premium web application designed to help users calculate their annual carbon footprint, visualize category-wise emission sources, track reduction progress, and receive customized sustainability advice. Powered by **Express** and **React (Vite)**, with intelligent insights driven by the **Gemini AI API** (and a localized rule-based fallback advisor).

---

## ✨ Features

- **📊 Dynamic Dashboard:** Instantly visualizes emissions breakdown via a beautiful, custom SVG donut chart. Displays carbon trends over months with color-coded comparison indicators.
- **⚙️ Precise lifestyle tracking:** Allows users to adjust granular sliders representing transportation (car, transit, flights), home energy consumption (electricity, LPG gas), diet (meat consumption, food waste), and shopping habits.
- **✅ Action checklist:** Pledge specific real-world sustainability habits (like swapping to LEDs or adopting plant-based days) and track real-time offsets against your total emissions.
- **💬 Gemini AI panel:** Ask custom carbon questions to a virtual sustainability advisor tailored directly to your current metric levels.
- **🔒 Secure Auth & Rate-Limiting:** Incorporates secure bcrypt password hashing, JSON Web Token (JWT) sessions, Helmet header security, and multi-tier IP rate limits (strict auth limits, global API throttling, and AI request protection).
- **🎨 Sleek, modern aesthetics:** Features custom typography (Outfit font), rich CSS gradients, glassmorphism card panels, automatic Light/Dark system theme detection, and micro-animations.

---

## 🛠️ Tech Stack & Architecture

- **Root Monorepo:** Orchestrated via NPM Workspaces for simplified workspace dependency management.
- **Backend:** Node.js, Express, bcryptjs (cryptographic password security), jsonwebtoken (secure authentication), express-rate-limit (API security), helmet (header hardening), and the `@google/generative-ai` SDK.
- **Frontend:** React, Vite, CSS Variables (highly customized styling with no heavy UI framework dependencies), dynamic interactive SVGs.
- **Database:** Flat JSON database file system located in `backend/data/`—making development zero-dependency and hosting incredibly easy.

---

## 🚀 Local Development Setup

### 📋 Prerequisites
- **Node.js** v18.0.0 or higher
- **NPM** v9.0.0 or higher

### 1. Clone & Install dependencies
Install all root, frontend, and backend packages with a single command from the root folder (leveraging npm workspaces):
```bash
npm install
```

### 2. Configure Environment variables
Navigate to the `backend/` directory, create a `.env` file from the example template, and add your configurations:
```bash
cd backend
cp .env.example .env
```
Open the newly created `backend/.env` file and populate it:
```env
PORT=5000
JWT_SECRET=your_secure_jwt_signing_key_here
GEMINI_API_KEY=your_gemini_api_key_here
```
*(Note: If you leave `GEMINI_API_KEY` blank, the app will automatically fall back to its local rule-based advisory system, allowing full offline usage!)*

### 3. Run the application
Start both the Express backend and the Vite frontend dev client simultaneously from the root directory:
```bash
npm run dev
```
- **Backend Server:** running on [http://localhost:5000](http://localhost:5000)
- **Frontend Client:** running on [http://localhost:5173](http://localhost:5173)

---

## 🌐 Production Deployment Guide

The application is structured to support both **monolithic (single-service)** and **decoupled (split-service)** hosting out of the box.

### Option A: Monolithic Hosting (Recommended)
This approach serves both the built frontend static assets and the backend API from a single Node.js web server. This is cost-efficient and avoids CORS issues entirely.

**Target platforms:** Render, Railway, Heroku, Fly.io, etc.

1. Create a new Node.js web service on your provider and link your GitHub repository.
2. Configure the following deployment commands at the **root level**:
   - **Build Command:** `npm install && npm run build` (This installs monorepo dependencies and builds frontend static assets to `frontend/dist`).
   - **Start Command:** `npm run start:backend` (This starts the Express server from the root workspace context).
3. Set the following Environment Variables in the cloud provider's console:
   - `NODE_ENV=production` (This prompts Express to serve the built static assets from `frontend/dist`).
   - `PORT=5000` (Or use the port provided by the host).
   - `JWT_SECRET=your_production_secret_key`
   - `GEMINI_API_KEY=your_google_gemini_key`

---

### Option B: Decoupled Hosting
If you prefer hosting the React client separately (e.g. for global CDN distribution) and the backend API on a server.

**Target platforms:** Frontend on Vercel/Netlify; Backend on Render/Railway.

#### 1. Deploy the Backend API
1. Deploy the `backend/` project as a Node.js web service.
2. Set backend Environment Variables:
   - `NODE_ENV=production`
   - `JWT_SECRET=your_production_secret_key`
   - `GEMINI_API_KEY=your_google_gemini_key`
   - `FRONTEND_URL=https://your-frontend-app.vercel.app` (The URL of your deployed frontend to allow CORS access).
   - `CORS_ORIGIN=https://your-frontend-app.vercel.app`

#### 2. Deploy the Frontend Client
1. Deploy the `frontend/` project as a Static site on Vercel/Netlify.
2. In the Build settings, specify:
   - **Root directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output directory:** `dist`
3. Configure the following frontend Environment Variable:
   - `VITE_API_URL=https://your-backend-api.onrender.com` (The URL of your deployed backend service).

---

## 🔒 Security Practices Built-In

- **Credentials Safety:** A root `.gitignore` ensures that backend `.env` variables and local user-profile JSON databases are never committed to version control.
- **HTTP Header Protection:** Express utilizes `helmet` to block common browser-based vectors (e.g. clickjacking, cross-site scripting).
- **API Throttling:** Multi-tier rate-limit engines prevent brute-force attacks on sensitive endpoints and protect Gemini API usage from scraping abuse.

---

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.
