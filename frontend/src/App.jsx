import React, { useState, useEffect } from 'react';
import Chart from './components/Chart';

// Default values for sliders
const DEFAULT_SLIDERS = {
  carKm: 150,
  flightsCount: 2,
  transitKm: 40,
  electricityKwh: 250,
  gasCylinders: 2,
  meatMeals: 7,
  wasteLevel: 1, // 0=None, 1=Low, 2=Medium, 3=High
  clothesCount: 3,
  shopCount: 5,
  transportInputMode: 'sliders' // sliders | log
};

const WASTE_LABELS = ['None', 'Low', 'Medium', 'High'];

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function App() {
  // Authentication states
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // login | register
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // App tabs & metrics states
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sliders, setSliders] = useState(DEFAULT_SLIDERS);
  const [breakdown, setBreakdown] = useState({ transport: 0, energy: 0, diet: 0, shopping: 0 });
  const [totalCo2, setTotalCo2] = useState(0);
  
  const [history, setHistory] = useState([]);
  const [actions, setActions] = useState([]);
  const [saveStatus, setSaveStatus] = useState('');

  // AI Insights states
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Advanced features states
  const [travelLogs, setTravelLogs] = useState([]);
  const [tripForm, setTripForm] = useState({ tripDate: new Date().toISOString().substring(0, 10), mode: 'car', distance: 10, description: '' });
  const [tripLoading, setTripLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);

  const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM

  // Fetch initial profile & configurations
  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      fetchProfile();
      fetchHistory();
      fetchActions();
      fetchTravelLogs();
    } else {
      localStorage.removeItem('token');
      setUser(null);
    }
  }, [token]);

  // Setup initial chatbot welcome message when user loads
  useEffect(() => {
    if (user && chatMessages.length === 0) {
      setChatMessages([
        { sender: 'ai', text: `<p>Hello <strong>${user.name}</strong>! I am Gemini Carbon Expert, your virtual sustainability advisor. Ask me anything about your carbon footprint or ways to reduce emissions based on your current numbers!</p>` }
      ]);
    }
  }, [user]);

  // Recalculate carbon footprint locally on slider or travel logs change
  useEffect(() => {
    calculateLocalCarbon(sliders);
  }, [sliders, travelLogs]);

  const calculateLocalCarbon = (val) => {
    const travelLogEmissions = travelLogs.reduce((sum, t) => sum + t.emissions, 0);
    const car = (val.carKm || 0) * 52 * 0.00017;
    const flights = (val.flightsCount || 0) * 0.9;
    const transit = (val.transitKm || 0) * 52 * 0.00004;

    const transportVal = val.transportInputMode === 'log'
      ? travelLogEmissions
      : (car + flights + transit);

    const electricity = (val.electricityKwh || 0) * 12 * 0.00082;
    const gas = (val.gasCylinders || 0) * 12 * 0.0423;
    const meat = (val.meatMeals || 0) * 52 * 0.0027;
    const waste = (val.wasteLevel || 0) * 0.2;
    const clothes = (val.clothesCount || 0) * 12 * 0.025;
    const shop = (val.shopCount || 0) * 12 * 0.003;

    setBreakdown({
      transport: parseFloat(transportVal.toFixed(2)),
      energy: parseFloat((electricity + gas).toFixed(2)),
      diet: parseFloat((meat + waste).toFixed(2)),
      shopping: parseFloat((clothes + shop).toFixed(2))
    });
    setTotalCo2(parseFloat((transportVal + electricity + gas + meat + waste + clothes + shop).toFixed(2)));
  };

  // --- API CALLS ---

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data);
      } else {
        // Token expired or invalid
        setToken('');
      }
    } catch (err) {
      console.error('Fetch profile error:', err);
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
        // If there's an entry for the current month, load it into sliders
        const curRecord = data.find(r => r.date === currentMonth);
        if (curRecord) {
          setSliders({
            carKm: curRecord.carKm,
            flightsCount: curRecord.flightsCount,
            transitKm: curRecord.transitKm,
            electricityKwh: curRecord.electricityKwh,
            gasCylinders: curRecord.gasCylinders,
            meatMeals: curRecord.meatMeals,
            wasteLevel: curRecord.wasteLevel,
            clothesCount: curRecord.clothesCount,
            shopCount: curRecord.shopCount,
            transportInputMode: curRecord.transportInputMode || 'sliders'
          });
        }
      }
    } catch (err) {
      console.error('Fetch history error:', err);
    }
  };

  const fetchActions = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/tracking/actions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setActions(data);
      }
    } catch (err) {
      console.error('Fetch actions error:', err);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    const endpoint = authMode === 'login' ? `${API_BASE}/api/auth/login` : `${API_BASE}/api/auth/register`;
    const payload = authMode === 'login' 
      ? { email: authForm.email, password: authForm.password }
      : authForm;

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
      setAuthError('Network error connecting to auth server.');
    }
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
        fetchHistory(); // Refresh history log
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        const data = await res.json();
        setSaveStatus('error');
        alert(data.error || 'Failed to save configuration');
      }
    } catch (err) {
      setSaveStatus('error');
      alert('Error connecting to backend server.');
    }
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
        fetchActions(); // Refresh completed checkmarks
      }
    } catch (err) {
      console.error('Error toggling action:', err);
    }
  };

  const fetchTravelLogs = async (month) => {
    try {
      const targetMonth = month || currentMonth;
      const res = await fetch(`${API_BASE}/api/tracking/travel-log?date=${targetMonth}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTravelLogs(data);
      }
    } catch (err) {
      console.error('Fetch travel logs error:', err);
    }
  };

  const handleAddTrip = async (e) => {
    e.preventDefault();
    setTripLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/tracking/travel-log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          date: currentMonth,
          ...tripForm
        })
      });
      if (res.ok) {
        setTripForm({ tripDate: currentMonth + '-15', mode: 'car', distance: 10, description: '' });
        await fetchTravelLogs();
        fetchHistory(); // Refresh logs
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to add trip log');
      }
    } catch (err) {
      alert('Error connecting to backend.');
    } finally {
      setTripLoading(false);
    }
  };

  const handleDeleteTrip = async (tripId) => {
    if (!confirm('Are you sure you want to delete this trip log entry?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/tracking/travel-log/${tripId}?date=${currentMonth}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        await fetchTravelLogs();
        fetchHistory(); // Refresh logs
      }
    } catch (err) {
      console.error('Delete trip error:', err);
    }
  };

  const askAi = async (customQuestion) => {
    const q = customQuestion || aiQuestion;
    if (!q.trim()) return;

    setAiLoading(true);
    
    // Switch to AI tab if triggered from dashboard prompts
    setActiveTab('insights');
    if (customQuestion) setAiQuestion('');
    else setAiQuestion('');

    // Append user message immediately
    const newUserMsg = { sender: 'user', text: q };
    setChatMessages(prev => [...prev, newUserMsg]);

    try {
      // Pass formatted history
      const apiHistory = chatMessages.map(msg => ({
        sender: msg.sender,
        text: msg.text
      }));

      const res = await fetch(`${API_BASE}/api/ai/insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          question: q,
          sliders,
          breakdown,
          totalCo2,
          history: apiHistory
        })
      });
      const data = await res.json();
      if (res.ok) {
        setChatMessages(prev => [...prev, { sender: 'ai', text: data.response }]);
      } else {
        setChatMessages(prev => [...prev, { sender: 'ai', text: `<p style="color:var(--coral);">Error: ${data.error || 'Could not fetch insights.'}</p>` }]);
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { sender: 'ai', text: `<p style="color:var(--coral);">Server error communicating with AI advisor.</p>` }]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
    setChatMessages([]);
    setTravelLogs([]);
    localStorage.removeItem('token');
  };

  // Calculate potential action savings
  const completedSavings = actions.filter(a => a.done).reduce((sum, a) => sum + a.impact, 0);
  const potentialSavings = actions.reduce((sum, a) => sum + a.impact, 0);

  // Render Auth UI if not logged in
  if (!token || !user) {
    return (
      <div className="app-container">
        <div className="glass-card auth-box">
          <div className="auth-header">
            <div className="auth-icon">🌱</div>
            <h2>Carbon Tracker</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
              {authMode === 'login' ? 'Sign in to access your profile' : 'Create an account to start tracking'}
            </p>
          </div>

          {authError && <div className="alert-message alert-danger">{authError}</div>}
          {authSuccess && <div className="alert-message alert-success">{authSuccess}</div>}

          <form onSubmit={handleAuthSubmit}>
            {authMode === 'register' && (
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="John Doe"
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
                placeholder="john@example.com"
                value={authForm.email}
                onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.75rem' }}>
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

            <button type="submit" className="btn-primary">
              {authMode === 'login' ? 'Login' : 'Create Account'}
            </button>
          </form>

          <div className="auth-toggle">
            {authMode === 'login' ? (
              <>
                Don't have an account?{' '}
                <button className="auth-toggle-link" onClick={() => { setAuthMode('register'); setAuthError(''); }}>
                  Register here
                </button>
              </>
            ) : (
              <>
                Already registered?{' '}
                <button className="auth-toggle-link" onClick={() => { setAuthMode('login'); setAuthError(''); }}>
                  Login here
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render Main Application UI
  return (
    <div className="app-container">
      <div className="glass-card">
        {/* Header */}
        <header className="header-row">
          <div className="logo-section">
            <div className="logo-badge">🌱</div>
            <div>
              <h1 className="logo-title">Carbon Tracker</h1>
              <div className="logo-sub">Calculate emissions & get custom insights</div>
            </div>
          </div>
          
          <div className="auth-user-badge">
            <span style={{ fontWeight: '600' }}>👤 {user.name}</span>
            <span style={{ color: 'var(--text-secondary)' }}>|</span>
            <button className="logout-btn" onClick={handleLogout}>Logout</button>
          </div>
        </header>

        {/* Navigation Tabs */}
        <nav className="nav-tabs" role="tablist">
          <button
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Dashboard
          </button>
          <button
            className={`tab-btn ${activeTab === 'track' ? 'active' : ''}`}
            onClick={() => setActiveTab('track')}
          >
            ⚙️ Track
          </button>
          <button
            className={`tab-btn ${activeTab === 'actions' ? 'active' : ''}`}
            onClick={() => setActiveTab('actions')}
          >
            ✅ Actions
          </button>
          <button
            className={`tab-btn ${activeTab === 'insights' ? 'active' : ''}`}
            onClick={() => setActiveTab('insights')}
          >
            ✨ AI Insights
          </button>
        </nav>

        {/* DASHBOARD TAB */}
        <div className={`page-section ${activeTab === 'dashboard' ? 'active' : ''}`}>
          <div className="metrics-row">
            <div className="metric-card" style={{ borderColor: 'var(--green)' }}>
              <div className="metric-desc" style={{ color: 'var(--green)' }}>Current Footprint</div>
              <div className="metric-value" style={{ color: 'var(--green)' }}>{totalCo2.toFixed(1)}t</div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>CO₂ equivalent/yr</span>
            </div>
            <div className="metric-card">
              <div className="metric-desc">India Grid Average</div>
              <div className="metric-value">1.9t</div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>CO₂ per person/yr</span>
            </div>
            <div className="metric-card" style={{ borderColor: 'var(--blue)' }}>
              <div className="metric-desc" style={{ color: 'var(--blue)' }}>Paris Climate Target</div>
              <div className="metric-value" style={{ color: 'var(--blue)' }}>2.0t</div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Max target per person</span>
            </div>
          </div>

          <div className="grid-2">
            <div className="tracker-card">
              <h3 className="card-title">Category Breakdown</h3>
              <Chart breakdown={breakdown} />
            </div>

            <div className="tracker-card">
              <h3 className="card-title">Footprint Trend Logs</h3>
              {history.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                            <span style={{ color: 'var(--green)', marginLeft: '4px', fontWeight: 'bold' }}>↓</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">📅</div>
                  <p style={{ fontSize: '13px' }}>No entries found yet. Go to "Track" to save this month's calculations.</p>
                </div>
              )}

              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="suggestion-pill" onClick={() => askAi("What is my largest emission source and how can I start cutting it?")}>
                  💡 Where should I start?
                </button>
                <button className="suggestion-pill" onClick={() => askAi("How can I hit the 2.0 tonnes Paris Climate target based on my lifestyle?")}>
                  🏆 Road to 2.0t target
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* TRACK TAB */}
        <div className={`page-section ${activeTab === 'track' ? 'active' : ''}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              Adjust the sliders to estimate your current annual carbon emissions for <strong>{currentMonth}</strong>.
            </p>
            <button 
              className="btn-primary" 
              style={{ width: 'auto', padding: '8px 20px' }}
              onClick={saveCurrentFootprint}
              disabled={saveStatus === 'saving'}
            >
              {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'success' ? '✓ Saved!' : '💾 Save Current Record'}
            </button>
          </div>

          <div className="grid-2">
            <div>
              {/* Transport Card */}
              <div className="tracker-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '1.25rem' }}>
                  <h3 className="card-title" style={{ margin: 0, border: 'none', padding: 0 }}>🚗 Transport</h3>
                  
                  {/* Mode Selector */}
                  <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: '6px', padding: '2px' }}>
                    <button
                      className="auth-toggle-link"
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontWeight: '600',
                        borderRadius: '4px',
                        color: sliders.transportInputMode !== 'log' ? '#fff' : 'var(--text-secondary)',
                        background: sliders.transportInputMode !== 'log' ? 'var(--green)' : 'none',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                      onClick={() => setSliders({ ...sliders, transportInputMode: 'sliders' })}
                    >
                      Sliders
                    </button>
                    <button
                      className="auth-toggle-link"
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontWeight: '600',
                        borderRadius: '4px',
                        color: sliders.transportInputMode === 'log' ? '#fff' : 'var(--text-secondary)',
                        background: sliders.transportInputMode === 'log' ? 'var(--green)' : 'none',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                      onClick={() => setSliders({ ...sliders, transportInputMode: 'log' })}
                    >
                      Trip Log
                    </button>
                  </div>
                </div>

                {sliders.transportInputMode !== 'log' ? (
                  <>
                    <div className="slider-group">
                      <div className="slider-header">
                        <span className="slider-label">Car driving (km / week)</span>
                        <span className="slider-value">{sliders.carKm} km</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="500"
                        step="10"
                        value={sliders.carKm}
                        onChange={e => setSliders({ ...sliders, carKm: Number(e.target.value) })}
                      />
                    </div>

                    <div className="slider-group">
                      <div className="slider-header">
                        <span className="slider-label">Flights taken (flights / year)</span>
                        <span className="slider-value">{sliders.flightsCount} flights</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="20"
                        step="1"
                        value={sliders.flightsCount}
                        onChange={e => setSliders({ ...sliders, flightsCount: Number(e.target.value) })}
                      />
                    </div>

                    <div className="slider-group">
                      <div className="slider-header">
                        <span className="slider-label">Public Transit (bus/train km / week)</span>
                        <span className="slider-value">{sliders.transitKm} km</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="500"
                        step="10"
                        value={sliders.transitKm}
                        onChange={e => setSliders({ ...sliders, transitKm: Number(e.target.value) })}
                      />
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Add Trip Form */}
                    <form onSubmit={handleAddTrip} style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: 'var(--green)' }}>➕ Add New Trip</h4>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-secondary)' }}>Transport Mode</label>
                          <select
                            className="form-input"
                            style={{ padding: '6px 10px', fontSize: '12px' }}
                            value={tripForm.mode}
                            onChange={e => setTripForm({ ...tripForm, mode: e.target.value })}
                          >
                            <option value="car">🚗 Personal Car</option>
                            <option value="transit">🚌 Public Transit</option>
                            <option value="flight">✈️ Flight Travel</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-secondary)' }}>Distance (km)</label>
                          <input
                            type="number"
                            className="form-input"
                            style={{ padding: '6px 10px', fontSize: '12px' }}
                            min={1}
                            required
                            value={tripForm.distance}
                            onChange={e => setTripForm({ ...tripForm, distance: Number(e.target.value) })}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-secondary)' }}>Trip Date</label>
                          <input
                            type="date"
                            className="form-input"
                            style={{ padding: '6px 10px', fontSize: '12px' }}
                            required
                            value={tripForm.tripDate}
                            onChange={e => setTripForm({ ...tripForm, tripDate: e.target.value })}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-secondary)' }}>Notes (optional)</label>
                          <input
                            type="text"
                            className="form-input"
                            style={{ padding: '6px 10px', fontSize: '12px' }}
                            placeholder="Commute to work"
                            value={tripForm.description}
                            onChange={e => setTripForm({ ...tripForm, description: e.target.value })}
                          />
                        </div>
                      </div>

                      <button type="submit" disabled={tripLoading} className="btn-primary" style={{ padding: '8px', fontSize: '12px' }}>
                        {tripLoading ? 'Adding...' : 'Add Trip to Log'}
                      </button>
                    </form>

                    {/* Trip Log List */}
                    <div>
                      <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>🗃️ Monthly Logs</h4>
                      {travelLogs.length > 0 ? (
                        <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                            <thead style={{ background: 'var(--bg-secondary)', position: 'sticky', top: 0 }}>
                              <tr>
                                <th style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>Date</th>
                                <th style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>Mode</th>
                                <th style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>Dist</th>
                                <th style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>CO₂ (t)</th>
                                <th style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {travelLogs.map(trip => (
                                <tr key={trip._id || trip.id}>
                                  <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>{trip.tripDate.substring(5)}</td>
                                  <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
                                    {trip.mode === 'car' ? '🚗 Car' : trip.mode === 'transit' ? '🚌 Transit' : '✈️ Flight'}
                                  </td>
                                  <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>{trip.distance}km</td>
                                  <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>{trip.emissions.toFixed(3)}t</td>
                                  <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                                    <button
                                      style={{ background: 'none', border: 'none', color: 'var(--coral)', cursor: 'pointer', fontWeight: '700', fontSize: '14px' }}
                                      onClick={() => handleDeleteTrip(trip._id || trip.id)}
                                    >
                                      ×
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center', padding: '12px' }}>
                          No trips logged. Use the form above to log your travel.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Energy Card */}
              <div className="tracker-card">
                <h3 className="card-title">🔌 Home Energy</h3>

                <div className="slider-group">
                  <div className="slider-header">
                    <span className="slider-label">Electricity usage (kWh / month)</span>
                    <span className="slider-value">{sliders.electricityKwh} kWh</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1000"
                    step="20"
                    value={sliders.electricityKwh}
                    onChange={e => setSliders({ ...sliders, electricityKwh: Number(e.target.value) })}
                  />
                </div>

                <div className="slider-group">
                  <div className="slider-header">
                    <span className="slider-label">LPG cooking cylinders (/ month)</span>
                    <span className="slider-value">{sliders.gasCylinders} cylinders</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="8"
                    step="1"
                    value={sliders.gasCylinders}
                    onChange={e => setSliders({ ...sliders, gasCylinders: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>

            <div>
              {/* Diet Card */}
              <div className="tracker-card">
                <h3 className="card-title">🥗 Diet & Food</h3>

                <div className="slider-group">
                  <div className="slider-header">
                    <span className="slider-label">Meat-based meals (/ week)</span>
                    <span className="slider-value">{sliders.meatMeals} meals</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="21"
                    step="1"
                    value={sliders.meatMeals}
                    onChange={e => setSliders({ ...sliders, meatMeals: Number(e.target.value) })}
                  />
                </div>

                <div className="slider-group">
                  <div className="slider-header">
                    <span className="slider-label">Household food waste level</span>
                    <span className="slider-value">{WASTE_LABELS[sliders.wasteLevel]}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="3"
                    step="1"
                    value={sliders.wasteLevel}
                    onChange={e => setSliders({ ...sliders, wasteLevel: Number(e.target.value) })}
                  />
                </div>
              </div>

              {/* Shopping Card */}
              <div className="tracker-card">
                <h3 className="card-title">🛍️ Shopping & Apparel</h3>

                <div className="slider-group">
                  <div className="slider-header">
                    <span className="slider-label">New clothes bought (/ month)</span>
                    <span className="slider-value">{sliders.clothesCount} items</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="1"
                    value={sliders.clothesCount}
                    onChange={e => setSliders({ ...sliders, clothesCount: Number(e.target.value) })}
                  />
                </div>

                <div className="slider-group">
                  <div className="slider-header">
                    <span className="slider-label">Online order packages (/ month)</span>
                    <span className="slider-value">{sliders.shopCount} packages</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    step="1"
                    value={sliders.shopCount}
                    onChange={e => setSliders({ ...sliders, shopCount: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px' }}
            onClick={() => askAi()}
          >
            ✨ Get Custom AI Carbon Analysis of My Current Footprint
          </button>
        </div>

        {/* ACTIONS TAB */}
        <div className={`page-section ${activeTab === 'actions' ? 'active' : ''}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                Check off sustainability actions you have completed to see their positive impact on your footprint.
              </p>
            </div>
            
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 16px', textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>Active CO₂ Reductions Pledged</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--green)' }}>
                {completedSavings.toFixed(2)} t CO₂ / yr
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                out of {potentialSavings.toFixed(2)} t potential savings
              </div>
            </div>
          </div>

          <div className="category-list">
            {actions.map(action => (
              <div
                key={action.id}
                className={`action-card ${action.done ? 'completed' : ''}`}
                onClick={() => toggleAction(action.id)}
              >
                <div className="action-checkbox">
                  {action.done && <span className="check-icon">✓</span>}
                </div>
                
                <div className="action-body">
                  <span className="action-text">{action.title}</span>
                  <div className="action-meta">
                    <span className="action-impact">⚡ Saves {action.impact} t/yr</span>
                    <span className="badge" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                      {action.cat}
                    </span>
                    <span className={`badge badge-${action.level}`}>
                      {action.level === 'high' ? 'High Impact' : action.level === 'med' ? 'Medium' : 'Easy win'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button 
            className="btn-primary" 
            style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '1.5rem', padding: '10px 20px' }}
            onClick={() => askAi("Draft a customized 30-day carbon reduction calendar action plan for me.")}
          >
            📅 Build My Personal 30-day Climate Plan
          </button>
        </div>

        {/* INSIGHTS TAB */}
        <div className={`page-section ${activeTab === 'insights' ? 'active' : ''}`}>
          <div className="chat-container">
            {/* AI Advisor Conversational Message Thread */}
            <div className="tracker-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 className="card-title" style={{ color: 'var(--green)', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: 0 }}>
                ✨ Gemini Sustainability Chatbot
              </h3>
              
              <div className="chat-history-scroll" style={{
                maxHeight: '350px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '12px',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)'
              }}>
                {chatMessages.map((msg, index) => (
                  <div key={index} className={`chat-bubble-container ${msg.sender}`} style={{
                    display: 'flex',
                    justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    width: '100%'
                  }}>
                    <div className={`chat-bubble ${msg.sender}`} style={{
                      maxWidth: '85%',
                      padding: '10px 14px',
                      borderRadius: '16px',
                      fontSize: '13px',
                      lineHeight: '1.5',
                      color: msg.sender === 'user' ? '#ffffff' : 'var(--text-primary)',
                      background: msg.sender === 'user' ? 'linear-gradient(135deg, var(--green), var(--teal))' : 'var(--bg-primary)',
                      border: msg.sender === 'user' ? 'none' : '1px solid var(--border)',
                      boxShadow: 'var(--shadow)',
                      borderTopRightRadius: msg.sender === 'user' ? '4px' : '16px',
                      borderTopLeftRadius: msg.sender === 'user' ? '16px' : '4px'
                    }} dangerouslySetInnerHTML={{ __html: msg.text }} />
                  </div>
                ))}
                {aiLoading && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: '16px',
                      borderTopLeftRadius: '4px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border)',
                      fontSize: '13px',
                      color: 'var(--green)',
                      fontWeight: '600'
                    }}>
                      <div className="loading-dots">Analyzing lifestyle data</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="tracker-card" style={{ marginTop: '-8px' }}>
              <div className="ai-query-row">
                <input
                  type="text"
                  className="form-input chat-input"
                  placeholder="Ask a follow up question or comparison..."
                  value={aiQuestion}
                  onChange={e => setAiQuestion(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !aiLoading) askAi(); }}
                  disabled={aiLoading}
                />
                <button
                  className="btn-primary btn-ask"
                  style={{ width: 'auto' }}
                  onClick={() => askAi()}
                  disabled={aiLoading}
                >
                  {aiLoading ? 'Sending...' : 'Send'}
                </button>
              </div>

              {/* Suggestions Grid */}
              <div className="suggestions-grid">
                <button
                  className="suggestion-pill"
                  onClick={() => askAi("What household appliances use the most electricity and how do I reduce their drain?")}
                  disabled={aiLoading}
                >
                  💡 Appliances energy drain
                </button>
                <button
                  className="suggestion-pill"
                  onClick={() => askAi("Explain carbon offsets - how do I choose a reputable one and what do they cost?")}
                  disabled={aiLoading}
                >
                  🌳 How carbon offsets work
                </button>
                <button
                  className="suggestion-pill"
                  onClick={() => askAi("How does a plant-based diet reduce methane and agricultural emissions?")}
                  disabled={aiLoading}
                >
                  🌾 Diet footprint comparison
                </button>
                <button
                  className="suggestion-pill"
                  onClick={() => askAi("What is the average shipping carbon cost of online e-commerce ordering?")}
                  disabled={aiLoading}
                >
                  📦 E-commerce shipping cost
                </button>
              </div>
            </div>

            {/* Local Fun Facts Cards */}
            <div className="grid-2">
              <div className="tracker-card" style={{ borderLeft: '4px solid var(--green)', padding: '12px 16px' }}>
                <div style={{ fontWeight: '700', color: 'var(--green-dark)', fontSize: '14px', marginBottom: '4px' }}>🌱 Food Swap Savings</div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Eating one less beef meal per week saves roughly 0.3 tonnes of CO₂ per year — which is equivalent to driving 1,200 km less.
                </p>
              </div>

              <div className="tracker-card" style={{ borderLeft: '4px solid var(--blue)', padding: '12px 16px' }}>
                <div style={{ fontWeight: '700', color: 'var(--blue)', fontSize: '14px', marginBottom: '4px' }}>✈️ The Flight Factor</div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  A single long-haul flight can contribute more carbon emissions than months of daily driving. First/Business class has up to 3x the footprint of economy.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
