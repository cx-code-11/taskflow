const jwt  = require('jsonwebtoken');
const User = require('../models/User.model');

/** Verify JWT, load user onto req.user */
const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer '))
      return res.status(401).json({ message: 'Not authenticated. Please log in.' });

    const token   = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: 'User no longer exists.' });

    req.user = user;   // { id, name, email, role, ... }
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError')  return res.status(401).json({ message: 'Invalid token.' });
    if (err.name === 'TokenExpiredError')  return res.status(401).json({ message: 'Token expired. Please log in again.' });
    next(err);
  }
};

/** Role guard: authorize('admin') or authorize('admin','team-head') */
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return res.status(403).json({ message: `Access denied. Required: ${roles.join(', ')}` });
  next();
};

module.exports = { protect, authorize };
