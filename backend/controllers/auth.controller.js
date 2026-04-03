const jwt  = require('jsonwebtoken');
const User = require('../models/User.model');

const signToken = (user) =>
  jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required.' });

    const user = await User.findOne({ email: email.toLowerCase() }, { includePassword: true });
    if (!user) return res.status(401).json({ message: 'Invalid email or password.' });

    const ok = await User.comparePassword(password, user.password);
    if (!ok) return res.status(401).json({ message: 'Invalid email or password.' });

    const token = signToken(user);
    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed.', error: err.message });
  }
};

/**
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  res.json({ user: req.user });
};

module.exports = { login, getMe };
