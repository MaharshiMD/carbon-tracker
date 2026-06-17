const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const authMiddleware = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'carbon_tracker_local_secret_9988776655';

// Email validator
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// @route   POST /api/auth/register
// @desc    Register a new user
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  // Input validations
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  try {
    // Check if user already exists
    const existingUser = await db.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already registered with this email' });
    }

    // Hash the password securely using bcryptjs
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    // Save user
    const newUser = await db.createUser({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash
    });

    // Generate JWT
    const token = jwt.sign(
      { id: newUser.id || newUser._id.toString(), name: newUser.name, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Send profile & token
    res.status(201).json({
      token,
      user: {
        id: newUser.id || newUser._id.toString(),
        name: newUser.name,
        email: newUser.email,
        createdAt: newUser.createdAt
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error during user registration' });
  }
});

// @route   POST /api/auth/login
// @desc    Login existing user
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await db.findUserByEmail(email);
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isMatch = bcrypt.compareSync(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id || user._id.toString(), name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id || user._id.toString(),
        name: user.name,
        email: user.email,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during user login' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await db.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      id: user.id || user._id.toString(),
      name: user.name,
      email: user.email,
      createdAt: user.createdAt
    });
  } catch (err) {
    console.error('Me endpoint error:', err);
    res.status(500).json({ error: 'Server error fetching user details' });
  }
});

module.exports = router;
