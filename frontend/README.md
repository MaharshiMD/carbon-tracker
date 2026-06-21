# 🌱 EcoTwin AI — Frontend Client Application

This directory contains the client React application for EcoTwin AI, built with **Vite** and styled using **Vanilla CSS Variables**.

---

## 🎨 Design & UI Architecture
- **Glassmorphic Layouts:** Modern translucent panels utilizing CSS backdrop filters.
- **Custom CSS Variables:** Harmonious dark mode color palettes, subtle micro-animations, and dynamic visual state indicators.
- **Responsive Dashboard:** Flexible layout adapted for mobile and desktop screens.
- **Typography:** Uses Google Fonts (Outfit) for a polished, modern aesthetic.
- **Interactive SVG Charts:** Leverages raw inline SVG components (under `src/components/Chart.jsx`) for carbon breakdown donut visualizations and monthly emission progress bar charts.

## 📂 Key Directory Contents
- **`src/main.jsx`**: Bootstraps the React client.
- **`src/App.jsx`**: The main application controller managing views (Dashboard, EcoCoach Chat, Receipt OCR, CV Analyzer, Simulator, Future Earth, Gamification, Community Heatmap), user auth hooks, and API integration.
- **`src/App.css`**: Styling overrides.
- **`src/index.css`**: Design tokens, variables, typography, and animation definitions.
- **`src/components/Chart.jsx`**: Handles client-side SVG rendering of carbon emissions statistics.

## 🚀 Getting Started

### 1. Installation
Install workspace dependencies from the root directory:
```bash
npm install
```

### 2. Configure Environment
Create a `.env` file under the `frontend` folder:
```env
VITE_API_URL=http://localhost:5000
```
*(If left blank, frontend calls default to current window origin)*

### 3. Run Development Server
Start the frontend server from the root workspace context:
```bash
npm run dev:frontend
```
The application will launch on [http://localhost:5173](http://localhost:5173).

## 🛠️ Production Build
To compile the static production bundle to `/dist`:
```bash
npm run build:frontend
```
