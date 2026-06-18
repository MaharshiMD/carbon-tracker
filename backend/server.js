require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const db = require('./database');

// Initialize database (MongoDB or local JSON fallback)
db.initDB();

const authRoutes = require('./routes/auth');
const trackingRoutes = require('./routes/tracking');
const aiRoutes = require('./routes/ai');
const chatRoutes = require('./routes/chat');
const gamificationRoutes = require('./routes/gamification');
const communityRoutes = require('./routes/community');

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middlewares
app.use(helmet()); // Secure HTTP headers

// CORS configuration - dynamic based on environment variable or local defaults
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  process.env.FRONTEND_URL,
  process.env.CORS_ORIGIN
].map(url => url ? url.replace(/\/$/, '') : '').filter(Boolean);

const isLocalhost = (url) => {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url);
};

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or same-origin)
    if (!origin) return callback(null, true);
    const normalizedOrigin = origin.replace(/\/$/, '');
    if (allowedOrigins.includes(normalizedOrigin) || isLocalhost(normalizedOrigin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser
app.use(express.json());

// Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again after 15 minutes.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Strict limit for registration and login
  message: { error: 'Too many authentication attempts, please try again later.' }
});

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // Limit AI usage to prevent API cost issues or scraping
  message: { error: 'Too many AI requests, please try again in 15 minutes.' }
});

app.use('/api/', globalLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/ai/', aiLimiter);
app.use('/api/chat', aiLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/community', communityRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', time: new Date().toISOString() });
});

// Serve frontend build static files in production if needed
if (process.env.NODE_ENV === 'production') {
  // app.use(express.static(path.join(__dirname, '../frontend/dist')));
  // app.get('*', (req, res) => {
  //   res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  // });
  app.get("/", (req, res) => {
    res.json({
      status: "ok",
      message: "Carbon Tracker API is running"
    });
  });
}

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled system error:', err.stack);
  res.status(500).json({ error: 'An unexpected server error occurred' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(`Carbon Tracker secure backend running on PORT ${PORT}`);
  console.log(`CORS allowed for http://localhost:5173`);
  console.log(`=============================================`);
});
