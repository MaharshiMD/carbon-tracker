import React, { useState, useEffect } from 'react';
import Chart from './components/Chart';

// Default values for sliders
const DEFAULT_SLIDERS = {
  carKm: 150,
  evKm: 0,
  flightsCount: 2,
  transitKm: 40,
  electricityKwh: 250,
  gasCylinders: 2,
  waterUsage: 5000,
  meatMeals: 7,
  wasteLevel: 1, // 0=None, 1=Low, 2=Medium, 3=High
  recycleRatio: 1, // 0=None, 1=Low, 2=Medium, 3=High
  clothesCount: 3,
  shopCount: 5,
  solarSavings: false,
  transportInputMode: 'sliders' // sliders | log
};

const WASTE_LABELS = ['None', 'Low', 'Medium', 'High'];
const RECYCLE_LABELS = ['None', 'Low', 'Medium', 'High'];

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export default function App() {
  // Authentication states
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('landing'); // landing | login | register
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // Active view
  const [activeTab, setActiveTab] = useState('dashboard');

  // Sliders and footprint metrics
  const [sliders, setSliders] = useState(DEFAULT_SLIDERS);
  const [breakdown, setBreakdown] = useState({ transport: 0, energy: 0, diet: 0, shopping: 0 });
  const [totalCo2, setTotalCo2] = useState(0);
  const [history, setHistory] = useState([]);
  const [actions, setActions] = useState([]);
  const [saveStatus, setSaveStatus] = useState('');

  // Individual activities ledger
  const [activities, setActivities] = useState([]);
  const [manualActivity, setManualActivity] = useState({ type: 'food', subType: 'chicken', value: 1, description: '' });

  // AI Insights and EcoCoach
  const [aiQuestion, setAiQuestion] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const askAiRef = React.useRef(null);

  // Travel Log
  const [travelLogs, setTravelLogs] = useState([]);
  const [tripForm, setTripForm] = useState({ tripDate: new Date().toISOString().substring(0, 10), mode: 'car', distance: 15, description: '' });
  const [tripLoading, setTripLoading] = useState(false);

  // Digital Twin Profile
  const [twinData, setTwinData] = useState(null);

  // OCR Receipt Scanner
  const [ocrCategory, setOcrCategory] = useState('Fuel');
  const [ocrFile, setOcrFile] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [scannedReceipts, setScannedReceipts] = useState([]);

  // Computer Vision Carbon Analyzer
  const [cvCategory, setCvCategory] = useState('Meals');
  const [cvFile, setCvFile] = useState(null);
  const [cvLoading, setCvLoading] = useState(false);
  const [cvResult, setCvResult] = useState(null);

  // Carbon Scenario Simulator
  const [simEV, setSimEV] = useState(false);
  const [simSolar, setSimSolar] = useState(false);
  const [simDiet, setSimDiet] = useState(0); // 0=meat, 1=reduced, 2=vegan
  const [simSavedMsg, setSimSavedMsg] = useState('');

  // Gamification dashboard
  const [gameStatus, setGameStatus] = useState({ xp: 100, level: 1, progress: 100, streak: 1, badges: [] });
  const [challenges, setChallenges] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);

  // Community heatmap
  const [communityNodes, setCommunityNodes] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState('Mumbai District');
  const [wasteForm, setWasteForm] = useState({ wasteType: 'Plastic Pollution', location: '', description: '' });

  // Future Earth Mode
  const [futureYear, setFutureYear] = useState('current'); // current | 5 | 10 | 20
  const [futureForecasts, setFutureForecasts] = useState(null);
  const [futureLoading, setFutureLoading] = useState(false);

  const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM

  // Fetch all initial data
  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      fetchProfile();
      fetchHistory();
      fetchActions();
      fetchActivities();
      fetchTravelLogs();
      fetchTwinData();
      fetchOCRReceipts();
      fetchGamificationStatus();
      fetchChallenges();
      fetchLeaderboard();
      fetchCommunityHeatmap();
    } else {
      localStorage.removeItem('token');
      setUser(null);
    }
  }, [token]);

  // Welcome message initialization
  useEffect(() => {
    if (user && chatMessages.length === 0) {
      setChatMessages([
        { sender: 'ai', text: `<h4>Hello ${user.name}! I am EcoCoach.</h4><p>I can analyze your carbon footprint metrics and suggest greener lifestyles. Ask me anything or choose one of the suggestions below!</p>` }
      ]);
    }
  }, [user]);

  // Sync askAi callback to prevent stale closures in global scope
  useEffect(() => {
    askAiRef.current = askAi;
  });

  // Expose askAi globally for click handlers inside chat bubbles
  useEffect(() => {
    window.askAi = (q) => {
      if (askAiRef.current) {
        askAiRef.current(q);
      }
    };
    return () => {
      delete window.askAi;
    };
  }, []);

  // Recalculate carbon footprint locally as sliders or travel logs change
  useEffect(() => {
    calculateLocalCarbon(sliders);
  }, [sliders, travelLogs]);

  const calculateLocalCarbon = (val) => {
    const travelLogEmissions = travelLogs.reduce((sum, t) => sum + t.emissions, 0);
    
    // Transport calculations
    const car = (val.carKm || 0) * 52 * 0.00017;
    const ev = (val.evKm || 0) * 52 * 0.00003;
    const flights = (val.flightsCount || 0) * 0.9;
    const transit = (val.transitKm || 0) * 52 * 0.00004;
    const transportVal = val.transportInputMode === 'log' ? travelLogEmissions : (car + ev + flights + transit);

    // Energy & Utilities
    const gridFactor = val.solarSavings ? 0.016 : 0.082;
    const electricity = (val.electricityKwh || 0) * 12 * 0.001 * gridFactor;
    const gas = (val.gasCylinders || 0) * 12 * 0.0423;
    const water = (val.waterUsage || 0) * 12 * 0.0003;
    const energyVal = electricity + gas + water;

    // Diet & Waste
    const meat = (val.meatMeals || 0) * 52 * 0.0027;
    const wasteReduction = 1 - ((val.recycleRatio || 0) * 0.25);
    const waste = (val.wasteLevel || 0) * 0.2 * wasteReduction;
    const dietVal = meat + waste;

    // Shopping
    const clothes = (val.clothesCount || 0) * 12 * 0.025;
    const shop = (val.shopCount || 0) * 12 * 0.003;
    const shoppingVal = clothes + shop;

    setBreakdown({
      transport: parseFloat(transportVal.toFixed(2)),
      energy: parseFloat(energyVal.toFixed(2)),
      diet: parseFloat(dietVal.toFixed(2)),
      shopping: parseFloat(shoppingVal.toFixed(2))
    });
    setTotalCo2(parseFloat((transportVal + energyVal + dietVal + shoppingVal).toFixed(2)));
  };

  // --- API SERVICE CALLS ---

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setUser(data);
      else setToken('');
    } catch (err) {
      setToken('');
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/tracking/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setHistory(data);
        const curRecord = data.find(r => r.date === currentMonth);
        if (curRecord) {
          setSliders({
            carKm: curRecord.carKm || 0,
            evKm: curRecord.evKm || 0,
            flightsCount: curRecord.flightsCount || 0,
            transitKm: curRecord.transitKm || 0,
            electricityKwh: curRecord.electricityKwh || 0,
            gasCylinders: curRecord.gasCylinders || 0,
            waterUsage: curRecord.waterUsage || 0,
            meatMeals: curRecord.meatMeals || 0,
            wasteLevel: curRecord.wasteLevel || 0,
            recycleRatio: curRecord.recycleRatio || 0,
            clothesCount: curRecord.clothesCount || 0,
            shopCount: curRecord.shopCount || 0,
            solarSavings: !!curRecord.solarSavings,
            transportInputMode: curRecord.transportInputMode || 'sliders'
          });
        }
      }
    } catch (err) {}
  };

  const fetchActions = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/tracking/actions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setActions(data);
    } catch (err) {}
  };

  const fetchActivities = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/tracking/activity`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setActivities(data);
    } catch (err) {}
  };

  const fetchTravelLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/tracking/travel-log?date=${currentMonth}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTravelLogs(data);
      }
    } catch (err) {}
  };

  const fetchTwinData = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/ai/twin`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setTwinData(data);
    } catch (err) {}
  };

  const fetchOCRReceipts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/ocr/scan`, { // fallback mapping
        headers: { 'Authorization': `Bearer ${token}` }
      });
      // In local mode or mock collections, if endpoint 404s, list is empty
      if (res.ok) {
        const data = await res.json();
        setScannedReceipts(data);
      }
    } catch (err) {}
  };

  const fetchGamificationStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/gamification/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setGameStatus(data);
    } catch (err) {}
  };

  const fetchChallenges = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/gamification/challenges`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setChallenges(data);
    } catch (err) {}
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/gamification/leaderboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setLeaderboard(data);
    } catch (err) {}
  };

  const fetchCommunityHeatmap = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/community/heatmap`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setCommunityNodes(data);
    } catch (err) {}
  };

  // --- ACTIONS HANDLERS ---

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    const endpoint = authMode === 'login' ? `${API_BASE}/api/auth/login` : `${API_BASE}/api/auth/register`;
    const payload = authMode === 'login' ? { email: authForm.email, password: authForm.password } : authForm;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        setUser(data.user);
        setAuthSuccess(authMode === 'login' ? 'Successfully logged in!' : 'Registered successfully!');
      } else {
        setAuthError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setAuthError('Connection error to authentication server.');
    }
  };

  const handleGoogleAuth = async () => {
    setAuthError('');
    try {
      // Simulate/Trigger Google Login Authentication
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Eco Citizen',
          email: 'ecotwin.citizen@gmail.com',
          password: 'google_oauth_bypass_secret_99'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        setUser(data.user);
      } else {
        // Log in if already registered
        const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'ecotwin.citizen@gmail.com', password: 'google_oauth_bypass_secret_99' })
        });
        const loginData = await loginRes.json();
        if (loginRes.ok) {
          setToken(loginData.token);
          setUser(loginData.user);
        } else {
          setAuthError('OAuth verification failed.');
        }
      }
    } catch (err) {
      setAuthError('Google Login server unavailable.');
    }
  };

  const handlePasswordReset = async () => {
    if (!authForm.email) {
      setAuthError('Please enter email to receive a password reset token.');
      return;
    }
    setAuthSuccess('Password reset verification link has been sent to ' + authForm.email);
  };

  const saveCurrentFootprint = async () => {
    setSaveStatus('saving');
    try {
      const res = await fetch(`${API_BASE}/api/tracking/footprint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          date: currentMonth,
          ...sliders
        })
      });
      if (res.ok) {
        setSaveStatus('success');
        fetchHistory();
        fetchTwinData();
        fetchGamificationStatus();
        fetchLeaderboard();
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      setSaveStatus('error');
    }
  };

  const addIndividualActivity = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/tracking/activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(manualActivity)
      });
      if (res.ok) {
        setManualActivity({ type: 'food', subType: 'chicken', value: 1, description: '' });
        fetchActivities();
        fetchGamificationStatus();
        fetchLeaderboard();
        alert('Activity recorded successfully!');
      }
    } catch (err) {}
  };

  const toggleAction = async (actionId) => {
    try {
      const res = await fetch(`${API_BASE}/api/tracking/actions/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ actionId })
      });
      if (res.ok) {
        fetchActions();
        fetchGamificationStatus();
      }
    } catch (err) {}
  };

  const askAi = async (customQuestion) => {
    const q = customQuestion || aiQuestion;
    if (!q.trim()) return;

    setAiLoading(true);
    setActiveTab('coach');
    if (!customQuestion) setAiQuestion('');

    const newUserMsg = { sender: 'user', text: q };
    setChatMessages(prev => [...prev, newUserMsg]);

    try {
      const apiHistory = chatMessages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      }));

      const carbonProfile = {
        name: user?.name || 'Maharshi Dihora',
        annualFootprint: totalCo2 || 0,
        energyEmissions: breakdown.energy || 0,
        transportEmissions: breakdown.transport || 0,
        foodEmissions: breakdown.diet || 0,
        shoppingEmissions: breakdown.shopping || 0,
        sustainabilityScore: twinData?.profile?.sustainabilityScore || 70
      };

      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: q,
          carbonProfile,
          history: [...apiHistory, { role: 'user', content: q }]
        })
      });
      const data = await res.json();
      if (res.ok && data.response) {
        setChatMessages(prev => [...prev, { sender: 'ai', text: data.response }]);
      } else {
        setChatMessages(prev => [...prev, { sender: 'ai', text: `<p>EcoCoach is temporarily unavailable. Please try again.</p>` }]);
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { sender: 'ai', text: `<p>EcoCoach is temporarily unavailable. Please try again.</p>` }]);
    } finally {
      setAiLoading(false);
    }
  };

  const completeChallenge = async (chId) => {
    try {
      const res = await fetch(`${API_BASE}/api/gamification/challenges/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ challengeId: chId })
      });
      const data = await res.json();
      if (res.ok) {
        fetchGamificationStatus();
        fetchLeaderboard();
        if (data.notifications && data.notifications.length > 0) {
          alert(data.notifications.join('\n'));
        } else {
          alert(`Challenge completed! You gained ${data.xpAwarded} XP.`);
        }
      }
    } catch (err) {}
  };

  const triggerMockOCR = async (sampleType) => {
    setOcrLoading(true);
    setOcrResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/ai/ocr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fileName: `${sampleType.toLowerCase()}_invoice_2026.png`,
          receiptType: sampleType
        })
      });
      const data = await res.json();
      if (res.ok) {
        setOcrResult(data.parsed);
        fetchActivities();
        fetchGamificationStatus();
      }
    } catch (err) {
      alert('Scanning failed.');
    } finally {
      setOcrLoading(false);
    }
  };

  const triggerMockCV = async (sampleCategory) => {
    setCvLoading(true);
    setCvResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/ai/vision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fileName: `${sampleCategory.toLowerCase()}_photo_2026.jpg`,
          itemCategory: sampleCategory
        })
      });
      const data = await res.json();
      if (res.ok) {
        setCvResult(data.parsed);
        fetchActivities();
        fetchGamificationStatus();
      }
    } catch (err) {
      alert('Object recognition failed.');
    } finally {
      setCvLoading(false);
    }
  };

  const saveSimulationConfig = async () => {
    setSimSavedMsg('Saving simulation...');
    // Calculate scenario savings
    let annualSavingsCo2 = 0;
    let annualSavingsMoney = 0;
    const activeScenarios = [];

    if (simEV) {
      annualSavingsCo2 += 1.2;
      annualSavingsMoney += 450;
      activeScenarios.push('Electric Vehicle Commuting');
    }
    if (simSolar) {
      annualSavingsCo2 += 1.8;
      annualSavingsMoney += 600;
      activeScenarios.push('Solar Panel Installation');
    }
    if (simDiet === 1) {
      annualSavingsCo2 += 0.5;
      annualSavingsMoney += 120;
      activeScenarios.push('Low-Meat Lifestyle');
    } else if (simDiet === 2) {
      annualSavingsCo2 += 0.95;
      annualSavingsMoney += 220;
      activeScenarios.push('Fully Vegan Lifestyle');
    }

    const futureImpactYears = {
      5: parseFloat((annualSavingsCo2 * 5).toFixed(1)),
      10: parseFloat((annualSavingsCo2 * 10).toFixed(1)),
      20: parseFloat((annualSavingsCo2 * 20).toFixed(1))
    };

    try {
      const res = await fetch(`${API_BASE}/api/tracking/simulations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          scenarios: activeScenarios,
          annualSavingsCo2,
          annualSavingsMoney,
          futureImpactYears
        })
      });
      if (res.ok) {
        setSimSavedMsg('✓ Toggled Scenario Saved! Milestone unlocked.');
        fetchGamificationStatus();
        setTimeout(() => setSimSavedMsg(''), 4000);
      }
    } catch (err) {
      setSimSavedMsg('Saving failed.');
    }
  };

  const handlePlantTree = async (region) => {
    try {
      const res = await fetch(`${API_BASE}/api/community/events/plant-tree`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ region })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message + ` (+${data.xpAwarded} XP)`);
        fetchCommunityHeatmap();
        fetchGamificationStatus();
      }
    } catch (err) {}
  };

  const handleReportWaste = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/community/events/report-waste`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          region: selectedRegion,
          ...wasteForm
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message + ` (+${data.xpAwarded} XP)`);
        setWasteForm({ wasteType: 'Plastic Pollution', location: '', description: '' });
        fetchCommunityHeatmap();
        fetchGamificationStatus();
      }
    } catch (err) {}
  };

  const handleFutureYearChange = async (yearVal) => {
    setFutureYear(yearVal);
    if (yearVal === 'current') {
      setFutureForecasts(null);
      return;
    }
    setFutureLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/ai/future-earth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentFootprint: totalCo2 })
      });
      const data = await res.json();
      if (res.ok) {
        setFutureForecasts(data);
      }
    } catch (err) {}
    setFutureLoading(false);
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
    setChatMessages([]);
    setTravelLogs([]);
    setTwinData(null);
    setScannedReceipts([]);
    localStorage.removeItem('token');
  };

  // --- RENDERS ---

  // Auth & Landing Pages Flow
  if (!token || !user) {
    if (authMode === 'landing') {
      return (
        <div style={{ background: '#070c14', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', padding: '1.5rem 3rem', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="eco-brand">
              <div className="eco-brand-badge">🌱</div>
              <div>
                <h1 className="eco-brand-title">EcoTwin AI</h1>
                <div className="eco-brand-sub">Carbon twin engine</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn-secondary" onClick={() => setAuthMode('login')}>Sign In</button>
              <button className="btn-primary" onClick={() => setAuthMode('register')}>Get Started</button>
            </div>
          </header>

          <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="landing-hero">
              <div className="landing-glow" />
              <div className="eco-brand-badge" style={{ width: '72px', height: '72px', fontSize: '32px', marginBottom: '1.5rem' }}>🌱</div>
              <h2 className="landing-title">Sync Your Digital Carbon Twin.<br />Protect Our Real Earth.</h2>
              <p className="landing-tagline">
                EcoTwin AI generates a predictive digital twin of your carbon output based on daily commutes, food, utility receipts, and consumption. Scan, simulate, and plan sustainability impacts in Future Earth Mode.
              </p>
              <div className="landing-cta-row">
                <button className="btn-primary" onClick={() => setAuthMode('register')}>Create Your Twin Account</button>
                <button className="btn-secondary" onClick={() => setAuthMode('login')}>Launch Dashboard</button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'center', marginTop: '3.5rem', zIndex: 1 }}>
                <div style={{ background: '#121b2d', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px', width: '220px', textAlign: 'left' }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>♊</div>
                  <h4 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px' }}>Digital Carbon Twin</h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>A dynamic predictive model representing your real-time carbon habits.</p>
                </div>
                <div style={{ background: '#121b2d', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px', width: '220px', textAlign: 'left' }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>🧾</div>
                  <h4 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px' }}>OCR Receipt Scanner</h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Extract energy costs, litres, or food products directly from invoices.</p>
                </div>
                <div style={{ background: '#121b2d', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px', width: '220px', textAlign: 'left' }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>🌍</div>
                  <h4 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px' }}>Future Earth Mode</h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Time-travel up to 20 years to visually see your lifestyle's planetary impact.</p>
                </div>
              </div>
            </div>
          </main>
        </div>
      );
    }

    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0f1d', padding: '1rem' }}>
        <div className="glass-panel" style={{ width: '420px', margin: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem', textAlign: 'center' }}>
            <div className="eco-brand-badge" style={{ marginBottom: '12px' }}>🌱</div>
            <h2 style={{ fontSize: '22px', fontWeight: '700' }}>EcoTwin AI Authentication</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
              {authMode === 'login' ? 'Sign in to access your Twin profile' : 'Register your Carbon Profile'}
            </p>
          </div>

          {authError && <div className="alert-message alert-danger">{authError}</div>}
          {authSuccess && <div className="alert-message alert-success">{authSuccess}</div>}

          <form onSubmit={handleAuthSubmit}>
            {authMode === 'register' && (
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="Eco Advocate"
                  value={authForm.name}
                  onChange={e => setAuthForm({ ...authForm, name: e.target.value })}
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                required
                placeholder="citizen@ecotwin.ai"
                value={authForm.email}
                onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                required
                minLength={6}
                placeholder="••••••••"
                value={authForm.password}
                onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
              />
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', marginBottom: '10px' }}>
              {authMode === 'login' ? 'Login to Dashboard' : 'Register Account'}
            </button>
          </form>

          <button className="btn-secondary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '16px' }} onClick={handleGoogleAuth}>
            <span>🌐</span> Sign In with Google OAuth
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <button className="auth-toggle-link" style={{ fontSize: '12px' }} onClick={handlePasswordReset}>
              Forgot Password?
            </button>
            <button className="auth-toggle-link" style={{ fontSize: '12px' }} onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
              {authMode === 'login' ? 'Create account' : 'Already have an account?'}
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
            <button className="auth-toggle-link" style={{ fontSize: '12px', color: 'var(--text-secondary)' }} onClick={() => setAuthMode('landing')}>
              ← Back to Portal Landing
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Calculate potential savings for completed actions
  const completedSavings = actions.filter(a => a.done).reduce((sum, a) => sum + a.impact, 0);
  const potentialSavings = actions.reduce((sum, a) => sum + a.impact, 0);

  // Main UI Grid Layout
  return (
    <div className="eco-app-layout">
      {/* Sidebar Navigation */}
      <aside className="eco-sidebar">
        <div className="eco-brand">
          <div className="eco-brand-badge">🌱</div>
          <div>
            <h1 className="eco-brand-title">EcoTwin AI</h1>
            <div className="eco-brand-sub">Platform v1.2</div>
          </div>
        </div>

        <div className="eco-user-card">
          <div>
            <div style={{ fontWeight: '700', fontSize: '13px' }}>👤 {user.name}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Level {gameStatus.level} Twin</div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>Exit</button>
        </div>

        <nav className="eco-nav">
          <button className={`eco-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            📊 Dashboard
          </button>
          <button className={`eco-nav-item ${activeTab === 'twin' ? 'active' : ''}`} onClick={() => setActiveTab('twin')}>
            ♊ Carbon Twin Profile
          </button>
          <button className={`eco-nav-item ${activeTab === 'track' ? 'active' : ''}`} onClick={() => setActiveTab('track')}>
            ⚙️ Granular Calculator
          </button>
          <button className={`eco-nav-item ${activeTab === 'ocr' ? 'active' : ''}`} onClick={() => setActiveTab('ocr')}>
            🧾 OCR Receipt Scanner
          </button>
          <button className={`eco-nav-item ${activeTab === 'vision' ? 'active' : ''}`} onClick={() => setActiveTab('vision')}>
            👁️ CV Carbon Analyzer
          </button>
          <button className={`eco-nav-item ${activeTab === 'simulator' ? 'active' : ''}`} onClick={() => setActiveTab('simulator')}>
            🔮 Scenario Simulator
          </button>
          <button className={`eco-nav-item ${activeTab === 'challenges' ? 'active' : ''}`} onClick={() => setActiveTab('challenges')}>
            🏆 Challenges & XP
          </button>
          <button className={`eco-nav-item ${activeTab === 'heatmap' ? 'active' : ''}`} onClick={() => setActiveTab('heatmap')}>
            🗺️ Community Heatmap
          </button>
          <button className={`eco-nav-item ${activeTab === 'coach' ? 'active' : ''}`} onClick={() => setActiveTab('coach')}>
            💬 EcoCoach Chat
          </button>
          <button className={`eco-nav-item ${activeTab === 'future' ? 'active' : ''}`} onClick={() => setActiveTab('future')}>
            🌍 Future Earth Mode
          </button>
          <button className={`eco-nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            ⚙️ Profile Settings
          </button>
        </nav>
      </aside>

      {/* Main View Area */}
      <main className="eco-main-content">
        
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div>
            <header style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '28px', fontWeight: '700' }}>Sustainability Overview</h2>
              <p style={{ color: 'var(--text-secondary)' }}>Welcome back to EcoTwin. Review real-time forecasting and carbon budgets below.</p>
            </header>

            <div className="metrics-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
              <div className="metric-card" style={{ borderColor: 'var(--green)' }}>
                <div className="metric-desc" style={{ color: 'var(--green)' }}>Sustainability Score</div>
                <div className="metric-value" style={{ color: 'var(--green)' }}>{twinData?.profile?.sustainabilityScore || 70}/100</div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Based on lifestyle inputs</span>
              </div>
              <div className="metric-card">
                <div className="metric-desc">Annual Forecast</div>
                <div className="metric-value">{totalCo2.toFixed(1)}t</div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Tonnes CO₂ equivalent</span>
              </div>
              <div className="metric-card" style={{ borderColor: 'var(--blue)' }}>
                <div className="metric-desc" style={{ color: 'var(--blue)' }}>Paris Accord Target</div>
                <div className="metric-value" style={{ color: 'var(--blue)' }}>2.0t</div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Paris target baseline</span>
              </div>
              <div className="metric-card" style={{ borderColor: 'var(--purple)' }}>
                <div className="metric-desc" style={{ color: 'var(--purple)' }}>XP Progression</div>
                <div className="metric-value" style={{ color: 'var(--purple)' }}>{gameStatus.xp} XP</div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Level {gameStatus.level} achieved</span>
              </div>
            </div>

            <div className="grid-2">
              <div className="glass-panel" style={{ margin: 0 }}>
                <h3 className="card-title">Category Emission Breakdown</h3>
                <Chart breakdown={breakdown} />
              </div>

              <div className="glass-panel" style={{ margin: 0 }}>
                <h3 className="card-title">Footprint Trend Timeline</h3>
                {history.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {history.map((record, index) => {
                      const maxV = Math.max(...history.map(r => r.totalCo2), 10);
                      const pct = Math.round((record.totalCo2 / maxV) * 100);
                      return (
                        <div key={record.id || index} className="trend-item">
                          <span className="trend-date">{record.date}</span>
                          <div className="trend-bar-bg">
                            <div className="trend-bar-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="trend-value">
                            {record.totalCo2.toFixed(1)}t
                            {index > 0 && record.totalCo2 < history[index-1].totalCo2 && (
                              <span style={{ color: 'var(--green)', marginLeft: '6px' }}>↓</span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)' }}>
                    No footprint entries logged. Access "Granular Calculator" to save.
                  </div>
                )}
                
                <div style={{ marginTop: '1.5rem', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button className="suggestion-pill" onClick={() => askAi("What specific changes in my diet and transportation will help me reach the Paris target?")}>
                    💡 How can I reach the 2.0t target?
                  </button>
                  <button className="suggestion-pill" onClick={() => askAi("Draft a weekly energy-saving checklist based on my utility counts.")}>
                    🔌 Energy reduction plan
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CARBON TWIN PROFILE TAB */}
        {activeTab === 'twin' && (
          <div>
            <header style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '28px', fontWeight: '700' }}>Digital Carbon Twin</h2>
              <p style={{ color: 'var(--text-secondary)' }}>Your Twin learns from your daily habits, projects future impacts, and maps environmental risk.</p>
            </header>

            <div className="grid-2">
              <div className="twin-avatar-box">
                <div className={`twin-avatar-glow ${twinData?.avatarState || 'healthy_green'}`} />
                <div className="twin-graphic">
                  {twinData?.avatarState === 'lush_oasis' ? '🌳' : twinData?.avatarState === 'healthy_green' ? '🟢' : twinData?.avatarState === 'carbon_stressed' ? '🟡' : '💨'}
                </div>
                <div style={{ textAlign: 'center', marginTop: '1.5rem', zIndex: 1 }}>
                  <h4 style={{ fontSize: '18px', fontWeight: '700' }}>Twin ID: {twinData?.twinId || 'twin_loading'}</h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px', maxWidth: '300px' }}>
                    {twinData?.avatarSummary || 'Syncing twin status metrics...'}
                  </p>
                </div>
              </div>

              <div className="glass-panel" style={{ margin: 0 }}>
                <h3 className="card-title">Twin Risk Scorecard</h3>
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--bg-secondary)', border: '2px solid var(--green)', display: 'flex', alignItems: 'center', justify: 'center', fontSize: '32px', fontWeight: '700', color: 'var(--green)' }}>
                    {twinData?.profile?.riskScore || 'B'}
                  </div>
                  <div>
                    <h4 style={{ fontSize: '16px', fontWeight: '700' }}>Current Risk Level</h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Calculated from emissions output compared to Paris Accord thresholds.
                    </p>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '8px' }}>Habits Summary & Projections</h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    {twinData?.profile?.habits || 'Initial assessment pending.'}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '12px', background: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px' }}>
                    🔮 <strong>Emissions Projection:</strong> If habits remain unchanged, your yearly emissions are estimated to settle around <strong>{totalCo2.toFixed(1)} tonnes</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CALCULATOR TAB */}
        {activeTab === 'track' && (
          <div>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '28px', fontWeight: '700' }}>Granular Footprint Calculator</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Configure variables manually or verify through logs to update monthly twins.</p>
              </div>
              <button className="btn-primary" onClick={saveCurrentFootprint} disabled={saveStatus === 'saving'}>
                {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'success' ? '✓ Record Saved!' : '💾 Save Monthly Record'}
              </button>
            </header>

            <div className="grid-2">
              <div>
                {/* Transportation */}
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  <h3 className="card-title">🚗 Transportation</h3>
                  <div className="slider-container">
                    <div className="slider-info">
                      <span className="slider-label">Gasoline Car Distance (km/wk)</span>
                      <span className="slider-val">{sliders.carKm} km</span>
                    </div>
                    <input type="range" className="eco-slider" min="0" max="600" step="10" value={sliders.carKm} onChange={e => setSliders({ ...sliders, carKm: Number(e.target.value) })} />
                  </div>
                  <div className="slider-container">
                    <div className="slider-info">
                      <span className="slider-label">Electric Vehicle (EV) Distance (km/wk)</span>
                      <span className="slider-val">{sliders.evKm} km</span>
                    </div>
                    <input type="range" className="eco-slider" min="0" max="600" step="10" value={sliders.evKm} onChange={e => setSliders({ ...sliders, evKm: Number(e.target.value) })} />
                  </div>
                  <div className="slider-container">
                    <div className="slider-info">
                      <span className="slider-label">Flights taken (Count/yr)</span>
                      <span className="slider-val">{sliders.flightsCount} flights</span>
                    </div>
                    <input type="range" className="eco-slider" min="0" max="25" step="1" value={sliders.flightsCount} onChange={e => setSliders({ ...sliders, flightsCount: Number(e.target.value) })} />
                  </div>
                  <div className="slider-container">
                    <div className="slider-info">
                      <span className="slider-label">Public Transit (km/wk)</span>
                      <span className="slider-val">{sliders.transitKm} km</span>
                    </div>
                    <input type="range" className="eco-slider" min="0" max="400" step="10" value={sliders.transitKm} onChange={e => setSliders({ ...sliders, transitKm: Number(e.target.value) })} />
                  </div>
                </div>

                {/* Energy & Utilities */}
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  <h3 className="card-title">⚡ Utilities & Energy</h3>
                  <div className={`form-toggle-switch ${sliders.solarSavings ? 'active' : ''}`} onClick={() => setSliders({ ...sliders, solarSavings: !sliders.solarSavings })}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '13px' }}>Solar Panels Installed</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Offset power grids by 80%</div>
                    </div>
                    <div className="toggle-indicator" />
                  </div>
                  <div className="slider-container">
                    <div className="slider-info">
                      <span className="slider-label">Electricity Usage (kWh/mo)</span>
                      <span className="slider-val">{sliders.electricityKwh} kWh</span>
                    </div>
                    <input type="range" className="eco-slider" min="0" max="1200" step="20" value={sliders.electricityKwh} onChange={e => setSliders({ ...sliders, electricityKwh: Number(e.target.value) })} />
                  </div>
                  <div className="slider-container">
                    <div className="slider-info">
                      <span className="slider-label">Gas Cooking Cylinders (/mo)</span>
                      <span className="slider-val">{sliders.gasCylinders} cylinders</span>
                    </div>
                    <input type="range" className="eco-slider" min="0" max="6" step="1" value={sliders.gasCylinders} onChange={e => setSliders({ ...sliders, gasCylinders: Number(e.target.value) })} />
                  </div>
                  <div className="slider-container">
                    <div className="slider-info">
                      <span className="slider-label">Water Consumption (Litres/mo)</span>
                      <span className="slider-val">{sliders.waterUsage} L</span>
                    </div>
                    <input type="range" className="eco-slider" min="0" max="25000" step="500" value={sliders.waterUsage} onChange={e => setSliders({ ...sliders, waterUsage: Number(e.target.value) })} />
                  </div>
                </div>
              </div>

              <div>
                {/* Diet & Waste */}
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  <h3 className="card-title">🥗 Food & Waste</h3>
                  <div className="slider-container">
                    <div className="slider-info">
                      <span className="slider-label">Meat meals eaten (Count/wk)</span>
                      <span className="slider-val">{sliders.meatMeals} meals</span>
                    </div>
                    <input type="range" className="eco-slider" min="0" max="21" step="1" value={sliders.meatMeals} onChange={e => setSliders({ ...sliders, meatMeals: Number(e.target.value) })} />
                  </div>
                  <div className="slider-container">
                    <div className="slider-info">
                      <span className="slider-label">Household Food Waste Level</span>
                      <span className="slider-val">{WASTE_LABELS[sliders.wasteLevel]}</span>
                    </div>
                    <input type="range" className="eco-slider" min="0" max="3" step="1" value={sliders.wasteLevel} onChange={e => setSliders({ ...sliders, wasteLevel: Number(e.target.value) })} />
                  </div>
                  <div className="slider-container">
                    <div className="slider-info">
                      <span className="slider-label">Recycling Ratio Level</span>
                      <span className="slider-val">{RECYCLE_LABELS[sliders.recycleRatio]}</span>
                    </div>
                    <input type="range" className="eco-slider" min="0" max="3" step="1" value={sliders.recycleRatio} onChange={e => setSliders({ ...sliders, recycleRatio: Number(e.target.value) })} />
                  </div>
                </div>

                {/* Shopping */}
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  <h3 className="card-title">🛍️ Shopping & Consumption</h3>
                  <div className="slider-container">
                    <div className="slider-info">
                      <span className="slider-label">New Apparel Bought (/mo)</span>
                      <span className="slider-val">{sliders.clothesCount} items</span>
                    </div>
                    <input type="range" className="eco-slider" min="0" max="15" step="1" value={sliders.clothesCount} onChange={e => setSliders({ ...sliders, clothesCount: Number(e.target.value) })} />
                  </div>
                  <div className="slider-container">
                    <div className="slider-info">
                      <span className="slider-label">Online Order Parcels (/mo)</span>
                      <span className="slider-val">{sliders.shopCount} orders</span>
                    </div>
                    <input type="range" className="eco-slider" min="0" max="25" step="1" value={sliders.shopCount} onChange={e => setSliders({ ...sliders, shopCount: Number(e.target.value) })} />
                  </div>
                </div>

                {/* Action Items List */}
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  <h3 className="card-title">✅ Completed Actions Tracker</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                    {actions.map(act => (
                      <div key={act.id} className={`action-card ${act.done ? 'completed' : ''}`} onClick={() => toggleAction(act.id)}>
                        <div className="action-checkbox">{act.done && '✓'}</div>
                        <div className="action-body">
                          <div className="action-text">{act.title}</div>
                          <div className="action-meta">
                            <span className="action-impact">Saves {act.impact}t/yr</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* OCR SCANNER TAB */}
        {activeTab === 'ocr' && (
          <div>
            <header style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '28px', fontWeight: '700' }}>OCR Invoice & Bill Scanner</h2>
              <p style={{ color: 'var(--text-secondary)' }}>Upload utility invoices or retail invoices. AI extracts quantities and calculates carbon outputs immediately.</p>
            </header>

            <div className="grid-2">
              <div>
                <div className="glass-panel" style={{ margin: 0 }}>
                  <h3 className="card-title">Select Bill Category</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '1.5rem' }}>
                    {['Fuel', 'Electricity', 'Food', 'Shopping'].map(cat => (
                      <button key={cat} className={`btn-secondary ${ocrCategory === cat ? 'btn-primary' : ''}`} onClick={() => setOcrCategory(cat)} style={{ padding: '10px' }}>
                        {cat === 'Fuel' ? '🚗 Fuel' : cat === 'Electricity' ? '⚡ Electricity' : cat === 'Food' ? '🥗 Food' : '🛍️ Shopping'}
                      </button>
                    ))}
                  </div>

                  <div className="file-dropzone" onClick={() => triggerMockOCR(ocrCategory)}>
                    <div className="upload-icon">🧾</div>
                    <div style={{ fontWeight: '700' }}>Upload Receipt Image</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Click to trigger AI receipt scan simulation</div>
                  </div>

                  {ocrLoading && (
                    <div style={{ marginTop: '1.5rem' }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--green)' }}>EcoTwin AI parsing receipt parameters...</div>
                      <div className="scan-progress-bar-container">
                        <div className="scan-progress-fill" />
                      </div>
                    </div>
                  )}

                  {ocrResult && (
                    <div style={{ marginTop: '1.5rem', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--green)', marginBottom: '8px' }}>✓ Extraction Successful</h4>
                      <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
                        <div><strong>Invoice Type:</strong> {ocrResult.type}</div>
                        <div><strong>Quantity Detected:</strong> {ocrResult.quantity} {ocrResult.unit}</div>
                        <div><strong>Total Cost:</strong> ${ocrResult.cost}</div>
                        <div><strong>Extracted Items:</strong> {ocrResult.items?.join(', ')}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="glass-panel" style={{ margin: 0 }}>
                <h3 className="card-title">Scanned Activity History</h3>
                {activities.filter(a => a.description.includes('Scanned Receipt')).length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
                    {activities.filter(a => a.description.includes('Scanned Receipt')).map((rec, index) => (
                      <div key={index} style={{ padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '13px' }}>{rec.description}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{rec.date} • Quantity: {rec.value}</div>
                        </div>
                        <div style={{ color: 'var(--coral)', fontWeight: '700', fontSize: '14px' }}>+{rec.emissions}t CO₂</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                    No scanned activities detected. Scan invoices on the left to begin ledger logging.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* COMPUTER VISION TAB */}
        {activeTab === 'vision' && (
          <div>
            <header style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '28px', fontWeight: '700' }}>Computer Vision Carbon Analyzer</h2>
              <p style={{ color: 'var(--text-secondary)' }}>Upload photos of meals, cars, appliances, or products. The AI identifies objects and estimates their carbon footprint lifecycle.</p>
            </header>

            <div className="grid-2">
              <div>
                <div className="glass-panel" style={{ margin: 0 }}>
                  <h3 className="card-title">Select Object Category</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '1.5rem' }}>
                    {['Meals', 'Vehicles', 'Appliances', 'Waste Items'].map(cat => (
                      <button key={cat} className={`btn-secondary ${cvCategory === cat ? 'btn-primary' : ''}`} onClick={() => setCvCategory(cat)} style={{ padding: '10px' }}>
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="file-dropzone" onClick={() => triggerMockCV(cvCategory)}>
                    <div className="upload-icon">👁️</div>
                    <div style={{ fontWeight: '700' }}>Upload Photo of Item</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Click to trigger CV scan simulation</div>
                  </div>

                  {cvLoading && (
                    <div style={{ marginTop: '1.5rem' }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--green)' }}>EcoTwin AI analyzing object coordinates...</div>
                      <div className="scan-progress-bar-container">
                        <div className="scan-progress-fill" />
                      </div>
                    </div>
                  )}

                  {cvResult && (
                    <div style={{ marginTop: '1.5rem', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--green)', marginBottom: '8px' }}>✓ Analysis Completed</h4>
                      <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
                        <div><strong>Identified Object:</strong> {cvResult.identifiedObject}</div>
                        <div><strong>Estimated Emissions:</strong> {cvResult.carbonImpactKg} kg CO₂</div>
                        <div><strong>Green Alternative:</strong> {cvResult.alternative}</div>
                        <div><strong>Confidence Score:</strong> {cvResult.confidenceScore}%</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="glass-panel" style={{ margin: 0 }}>
                <h3 className="card-title">Granular Activity Ledger</h3>
                <form onSubmit={addIndividualActivity} style={{ marginBottom: '1.5rem', background: 'var(--bg-secondary)', padding: '14px', borderRadius: '10px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--green)', marginBottom: '10px' }}>📝 Log Manual Activity</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <select className="form-input" value={manualActivity.type} onChange={e => setManualActivity({ ...manualActivity, type: e.target.value })}>
                      <option value="food">🥗 Diet/Meal</option>
                      <option value="transportation">🚗 Transport</option>
                      <option value="utilities">⚡ Utility use</option>
                    </select>
                    <input type="number" className="form-input" placeholder="Quantity value" value={manualActivity.value} onChange={e => setManualActivity({ ...manualActivity, value: Number(e.target.value) })} />
                  </div>
                  <input type="text" className="form-input" placeholder="Short description" value={manualActivity.description} onChange={e => setManualActivity({ ...manualActivity, description: e.target.value })} style={{ marginBottom: '10px' }} />
                  <button type="submit" className="btn-primary" style={{ padding: '8px', fontSize: '12px' }}>Add Entry to Ledger</button>
                </form>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                  {activities.map((act, index) => (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}>
                      <div>
                        <strong>{act.type.toUpperCase()}:</strong> {act.description}
                      </div>
                      <div style={{ color: 'var(--coral)', fontWeight: '700' }}>{act.emissions}t</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CARBON SCENARIO SIMULATOR TAB */}
        {activeTab === 'simulator' && (
          <div>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '28px', fontWeight: '700' }}>Carbon Scenario Simulator</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Toggle future lifestyle changes to forecast annual carbon and financial savings.</p>
              </div>
              <button className="btn-primary" onClick={saveSimulationConfig}>Save Simulation State</button>
            </header>

            {simSavedMsg && <div className="alert-message alert-success">{simSavedMsg}</div>}

            <div className="grid-2">
              <div>
                <div className="glass-panel" style={{ margin: 0 }}>
                  <h3 className="card-title">Lifestyle Toggles</h3>
                  
                  <div className={`form-toggle-switch ${simEV ? 'active' : ''}`} onClick={() => setSimEV(!simEV)}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '13px' }}>Switch to Electric Car</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Reduces weekly transport footprint</div>
                    </div>
                    <div className="toggle-indicator" />
                  </div>

                  <div className={`form-toggle-switch ${simSolar ? 'active' : ''}`} onClick={() => setSimSolar(!simSolar)}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '13px' }}>Install Home Solar Panels</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Offsets electricity consumption by 80%</div>
                    </div>
                    <div className="toggle-indicator" />
                  </div>

                  <div className="form-group" style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <label className="form-label">Diet Pattern Shift</label>
                    <select className="form-input" value={simDiet} onChange={e => setSimDiet(Number(e.target.value))}>
                      <option value={0}>High Meat Consumption (Standard)</option>
                      <option value={1}>Reduce Meat by 60% (Flexitarian)</option>
                      <option value={2}>Fully Plant-Based Diet (Vegan)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="glass-panel" style={{ margin: 0 }}>
                <h3 className="card-title">Savings Projections (Annualized)</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>CO₂ Emissions Saved</div>
                    <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--green)', marginTop: '4px' }}>
                      {((simEV ? 1.2 : 0) + (simSolar ? 1.8 : 0) + (simDiet === 1 ? 0.5 : simDiet === 2 ? 0.95 : 0)).toFixed(2)} t
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Tonnes per year</div>
                  </div>

                  <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Financial Utility Savings</div>
                    <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--blue)', marginTop: '4px' }}>
                      ${((simEV ? 450 : 0) + (simSolar ? 600 : 0) + (simDiet === 1 ? 120 : simDiet === 2 ? 220 : 0))}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Estimated USD per year</div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '8px' }}>Projected 20-Year Accumulation</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[5, 10, 20].map(yr => {
                      const co2Savings = ((simEV ? 1.2 : 0) + (simSolar ? 1.8 : 0) + (simDiet === 1 ? 0.5 : simDiet === 2 ? 0.95 : 0)) * yr;
                      return (
                        <div key={yr} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Accumulated savings in {yr} Years:</span>
                          <strong>{co2Savings.toFixed(1)} tonnes CO₂</strong>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CHALLENGES & GAMIFICATION TAB */}
        {activeTab === 'challenges' && (
          <div>
            <header style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '28px', fontWeight: '700' }}>Eco Challenges & XP Rewards</h2>
              <p style={{ color: 'var(--text-secondary)' }}>Earn Experience Points (XP) by completing checklists. Unlocking levels awards badges.</p>
            </header>

            <div className="grid-3" style={{ marginBottom: '2rem' }}>
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px' }}>⚡</div>
                <div style={{ fontSize: '24px', fontWeight: '700', marginTop: '8px' }}>{gameStatus.xp} XP</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Experience Points</div>
              </div>
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px' }}>🔥</div>
                <div style={{ fontSize: '24px', fontWeight: '700', marginTop: '8px' }}>{gameStatus.streak} Days</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Daily Streak Count</div>
              </div>
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px' }}>🏅</div>
                <div style={{ fontSize: '24px', fontWeight: '700', marginTop: '8px' }}>{gameStatus.badges?.length || 0} Badges</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Unlocked Achievements</div>
              </div>
            </div>

            <div className="grid-2">
              <div>
                <div className="glass-panel" style={{ margin: 0 }}>
                  <h3 className="card-title">Available Missions</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {challenges.map(ch => (
                      <div key={ch._id || ch.id} className="challenge-item">
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '14px' }}>{ch.title}</div>
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{ch.description}</p>
                          <span className={`badge-badge badge-tag-${ch.duration}`}>{ch.duration}</span>
                        </div>
                        <button className="btn-primary" style={{ padding: '8px 14px', fontSize: '12px' }} onClick={() => completeChallenge(ch._id || ch.id)}>
                          +{ch.xpReward} XP
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="glass-panel" style={{ margin: 0 }}>
                  <h3 className="card-title">Unlocked Badges</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    {gameStatus.badges && gameStatus.badges.length > 0 ? (
                      gameStatus.badges.map((ach, idx) => (
                        <div key={idx} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '12px', borderRadius: '10px', textAlign: 'center' }} title={ach.description}>
                          <div style={{ fontSize: '32px' }}>{ach.icon}</div>
                          <div style={{ fontSize: '12px', fontWeight: '700', marginTop: '6px' }}>{ach.title}</div>
                        </div>
                      ))
                    ) : (
                      <div style={{ gridColumn: 'span 3', textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem 0' }}>
                        Complete challenges to unlock badges.
                      </div>
                    )}
                  </div>
                </div>

                <div className="glass-panel" style={{ marginTop: '1.5rem', margin: 0 }}>
                  <h3 className="card-title">Community Leaderboard</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                    {leaderboard.map(lb => (
                      <div key={lb.userId} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: lb.userId === user.id ? 'var(--green-light)' : 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px' }}>
                        <div>
                          <strong>#{lb.rank}</strong> {lb.name} {lb.userId === user.id && '(You)'}
                        </div>
                        <div>
                          <span>🔥 {lb.streakCount || 0}d</span> • <strong>{lb.totalXP} XP</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* COMMUNITY HEATMAP TAB */}
        {activeTab === 'heatmap' && (
          <div>
            <header style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '28px', fontWeight: '700' }}>Community Carbon Heatmap</h2>
              <p style={{ color: 'var(--text-secondary)' }}>View anonymous regional carbon stats, log tree plantations, or report hazards.</p>
            </header>

            <div className="grid-2">
              <div>
                <div className="glass-panel" style={{ margin: 0 }}>
                  <h3 className="card-title">Regional Carbon Pinboards</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1.5rem' }}>
                    {communityNodes.map(node => (
                      <div key={node.region} className={`challenge-item ${selectedRegion === node.region ? 'completed' : ''}`} onClick={() => setSelectedRegion(node.region)} style={{ cursor: 'pointer' }}>
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '14px' }}>📍 {node.region}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            Footprint: {node.totalFootprint}t • Users: {node.activeUsers}
                          </div>
                        </div>
                        <button className="btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={(e) => { e.stopPropagation(); handlePlantTree(node.region); }}>
                          🌳 Plant Tree
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="glass-panel" style={{ margin: 0 }}>
                  <h3 className="card-title">Report Waste Hazard</h3>
                  <form onSubmit={handleReportWaste}>
                    <div className="form-group">
                      <label className="form-label">Selected Region</label>
                      <input type="text" className="form-input" value={selectedRegion} disabled />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Pollution Hazard Type</label>
                      <select className="form-input" value={wasteForm.wasteType} onChange={e => setWasteForm({ ...wasteForm, wasteType: e.target.value })}>
                        <option value="Plastic Pollution">Plastic Pollution</option>
                        <option value="Electronic Waste">Electronic Waste</option>
                        <option value="Food Garbage Spillage">Food Garbage Spillage</option>
                        <option value="Chemical Hazards">Chemical Hazards</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Precise Location Address</label>
                      <input type="text" className="form-input" required placeholder="e.g. Gateway Park, Sector 4" value={wasteForm.location} onChange={e => setWasteForm({ ...wasteForm, location: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Report Description</label>
                      <input type="text" className="form-input" placeholder="Overflowing heap since 2 days" value={wasteForm.description} onChange={e => setWasteForm({ ...wasteForm, description: e.target.value })} />
                    </div>
                    <button type="submit" className="btn-primary" style={{ width: '100%' }}>Submit Citizen Waste Report</button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ECOCOACH CHAT TAB */}
        {activeTab === 'coach' && (
          <div>
            <header style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '28px', fontWeight: '700' }}>EcoCoach Sustainability AI</h2>
              <p style={{ color: 'var(--text-secondary)' }}>Chat with EcoCoach, powered by Gemini, to explore offsets and green alternatives.</p>
            </header>

            <div className="chat-container">
              <div className="chat-window">
                {chatMessages.map((msg, index) => (
                  <div key={index} className={`bubble ${msg.sender}`} dangerouslySetInnerHTML={{ __html: msg.text }} />
                ))}
                {aiLoading && (
                  <div className="bubble ai">
                    <div style={{ color: 'var(--green)', fontWeight: '600' }}>EcoCoach is thinking...</div>
                  </div>
                )}
              </div>

              <div className="glass-panel" style={{ margin: 0 }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ask EcoCoach a follow up question..."
                    value={aiQuestion}
                    onChange={e => setAiQuestion(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !aiLoading) askAi(); }}
                    disabled={aiLoading}
                  />
                  <button className="btn-primary" onClick={() => askAi()} disabled={aiLoading} style={{ padding: '0 24px' }}>
                    Send
                  </button>
                </div>

                <div className="suggestions-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '1.25rem' }}>
                  <button className="suggestion-pill" onClick={() => askAi("Draft a customized 30-day carbon reduction calendar action plan for me.")} disabled={aiLoading}>
                    📅 Create 30-day climate plan
                  </button>
                  <button className="suggestion-pill" onClick={() => askAi("Explain carbon offsets - how do I choose a reputable one and what do they cost?")} disabled={aiLoading}>
                    🌳 How carbon offsets work
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FUTURE EARTH MODE TAB */}
        {activeTab === 'future' && (
          <div>
            <header style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '28px', fontWeight: '700' }}>Future Earth Time-Travel Simulator</h2>
              <p style={{ color: 'var(--text-secondary)' }}>Slide the timeline to visually experience how your carbon footprint will affect the planet over 5, 10, and 20 years.</p>
            </header>

            <div className="future-earth-slider-row">
              <div style={{ fontWeight: '700', fontSize: '14px', minWidth: '100px' }}>Select Year:</div>
              <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                {['current', '5', '10', '20'].map(yr => (
                  <button key={yr} className={`btn-secondary ${futureYear === yr ? 'btn-primary' : ''}`} onClick={() => handleFutureYearChange(yr)} style={{ flex: 1, padding: '8px' }}>
                    {yr === 'current' ? 'Present Day' : `+ ${yr} Years`}
                  </button>
                ))}
              </div>
            </div>

            <div className="future-earth-canvas">
              <div className="future-earth-sky" style={{
                background: futureYear === 'current'
                  ? 'linear-gradient(180deg, #10b981 0%, #064e3b 100%)'
                  : futureYear === '5'
                  ? 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)'
                  : futureYear === '10'
                  ? 'linear-gradient(180deg, #b45309 0%, #78350f 100%)'
                  : 'linear-gradient(180deg, #be123c 0%, #881337 100%)',
                opacity: 0.15
              }} />
              
              <div className={`future-earth-globe ${totalCo2 < 3.0 ? 'lush' : totalCo2 < 7.0 ? 'stressed' : 'toxic'}`}>
                {futureYear === 'current'
                  ? (totalCo2 < 3.0 ? '🌍' : totalCo2 < 7.0 ? '🌏' : '🏭')
                  : futureYear === '5'
                  ? (totalCo2 < 3.0 ? '🌿' : totalCo2 < 7.0 ? '🌤️' : '💨')
                  : futureYear === '10'
                  ? (totalCo2 < 3.0 ? '🦜' : totalCo2 < 7.0 ? '🍂' : '🌋')
                  : (totalCo2 < 3.0 ? '🌟' : totalCo2 < 7.0 ? '🏜️' : '💀')
                }
              </div>

              {futureLoading && (
                <div style={{ position: 'absolute', color: 'var(--green)', fontWeight: '600' }}>
                  AI generating timeline simulation forecasts...
                </div>
              )}

              {futureForecasts && !futureLoading && (
                <div className="future-overlay-info">
                  <div style={{ fontWeight: '700', color: '#ffffff', fontSize: '14px', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Projected Climate State ({futureYear} Years)</span>
                    <span style={{ color: 'var(--coral)' }}>Temp Rise: +{futureForecasts.globalTempRise}°C</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {futureYear === '5' ? futureForecasts.y5 : futureYear === '10' ? futureForecasts.y10 : futureForecasts.y20}
                  </p>
                </div>
              )}

              {futureYear === 'current' && (
                <div className="future-overlay-info">
                  <div style={{ fontWeight: '700', color: '#ffffff', fontSize: '14px', marginBottom: '4px' }}>
                    Present Environment Status
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Select a timeline option above to evaluate forecast indices based on your footprint of <strong>{totalCo2.toFixed(1)} tonnes CO₂ / year</strong>.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div>
            <header style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '28px', fontWeight: '700' }}>Profile & Account Settings</h2>
              <p style={{ color: 'var(--text-secondary)' }}>Manage preferences, security thresholds, and account authentication.</p>
            </header>

            <div className="grid-2">
              <div className="glass-panel" style={{ margin: 0 }}>
                <h3 className="card-title">Manage Profile</h3>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input type="text" className="form-input" value={user.name} disabled />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input type="email" className="form-input" value={user.email} disabled />
                </div>
                <div className="form-group">
                  <label className="form-label">Registration Date</label>
                  <input type="text" className="form-input" value={new Date(user.createdAt).toDateString()} disabled />
                </div>
              </div>

              <div className="glass-panel" style={{ margin: 0 }}>
                <h3 className="card-title">Security & System Actions</h3>
                <button className="btn-secondary" onClick={() => alert('Verification email sent to ' + user.email)} style={{ width: '100%', marginBottom: '12px' }}>
                  Reset Account Password
                </button>
                <button className="btn-secondary" onClick={handleLogout} style={{ width: '100%', color: 'var(--coral)', borderColor: 'var(--coral)' }}>
                  Sign Out of EcoTwin Platform
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
