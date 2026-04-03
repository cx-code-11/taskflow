const User = require('../models/User.model');

/** GET /api/users  — admin only */
const getUsers = async (req, res) => {
  try {
    const users = await User.find({ roleNe: 'admin' });
    res.json({ users, count: users.length });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch users.', error: err.message });
  }
};

/** GET /api/users/assignable — admin + team-head: list for task assignment dropdown */
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, { select: 'id, name, email, role' });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch users.', error: err.message });
  }
};

/**
 * POST /api/users  — admin only
 * Body: { name, email, password, role }
 */
const createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: 'Name, email, and password are required.' });

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ message: 'A user with this email already exists.' });

    const allowedRoles = ['team-head', 'member', 'client'];
    const finalRole = allowedRoles.includes(role) ? role : 'member';

    const user = await User.create({ name, email, password, role: finalRole });
    res.status(201).json({
      message: 'User created.',
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create user.', error: err.message });
  }
};

/**
 * PATCH /api/users/:id  — admin only: update role
 * Body: { role }
 */
const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const allowedRoles = ['team-head', 'member', 'client'];
    if (!allowedRoles.includes(role))
      return res.status(400).json({ message: 'Invalid role.' });

    const user = await User.findByIdAndUpdate(req.params.id, { role });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    res.json({ message: 'Role updated.', user });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update role.', error: err.message });
  }
};

/** DELETE /api/users/:id  — admin only */
const deleteUser = async (req, res) => {
  try {
    if (req.params.id === req.user.id)
      return res.status(400).json({ message: 'You cannot delete yourself.' });

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    res.json({ message: 'User deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete user.', error: err.message });
  }
};

module.exports = { getUsers, getAllUsers, createUser, updateUserRole, deleteUser };
