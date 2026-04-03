const bcrypt = require('bcryptjs');
const pool   = require('../db/pool');

const User = {
  /** Find a single user by an object of column→value pairs. */
  async findOne({ email, id } = {}, { includePassword = false } = {}) {
    let query, params;
    const cols = includePassword
      ? 'id, name, email, password, role, created_at, updated_at'
      : 'id, name, email, role, created_at, updated_at';

    if (email !== undefined) {
      query  = `SELECT ${cols} FROM users WHERE email = $1 LIMIT 1`;
      params = [email.toLowerCase()];
    } else if (id !== undefined) {
      query  = `SELECT ${cols} FROM users WHERE id = $1 LIMIT 1`;
      params = [id];
    } else {
      return null;
    }

    const { rows } = await pool.query(query, params);
    return rows[0] || null;
  },

  /** Find all users matching a filter object.  */
  async find({ role, roleNe } = {}, { select } = {}) {
    const cols = select || 'id, name, email, role, created_at, updated_at';
    let query = `SELECT ${cols} FROM users`;
    const params = [];

    if (role !== undefined) {
      params.push(role);
      query += ` WHERE role = $${params.length}`;
    } else if (roleNe !== undefined) {
      params.push(roleNe);
      query += ` WHERE role != $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';
    const { rows } = await pool.query(query, params);
    return rows;
  },

  async findById(id, { includePassword = false } = {}) {
    return User.findOne({ id }, { includePassword });
  },

  async create({ name, email, password, role = 'member' }) {
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at, updated_at`,
      [name, email.toLowerCase(), hash, role]
    );
    return rows[0];
  },

  async findByIdAndUpdate(id, { role }) {
    const { rows } = await pool.query(
      `UPDATE users SET role = $1 WHERE id = $2
       RETURNING id, name, email, role, created_at, updated_at`,
      [role, id]
    );
    return rows[0] || null;
  },

  async findByIdAndDelete(id) {
    const { rows } = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [id]
    );
    return rows[0] || null;
  },

  /** Compare plain text candidate against stored hash. */
  async comparePassword(candidate, hash) {
    return bcrypt.compare(candidate, hash);
  },
};

module.exports = User;
