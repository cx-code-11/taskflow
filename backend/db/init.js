/**
 * db/init.js — run once to bootstrap schema + seed admin user
 * Usage: node db/init.js   OR   npm run db:init
 */
require('dotenv').config();
const fs      = require('fs');
const path    = require('path');
const bcrypt  = require('bcryptjs');
const pool    = require('./pool');

async function init() {
  const client = await pool.connect();
  try {
    console.log('⏳ Running schema.sql …');
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(sql);
    console.log('✅ Schema applied.');

    // Seed admin if none exists
    const { rows } = await client.query(
      "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
    );
    if (rows.length === 0) {
      const hash = await bcrypt.hash('admin123', 12);
      await client.query(
        `INSERT INTO users (name, email, password, role)
         VALUES ($1, $2, $3, 'admin')`,
        ['Admin', 'admin@taskflow.com', hash]
      );
      console.log('🌱 Admin seeded: admin@taskflow.com / admin123');
    } else {
      console.log('ℹ️  Admin already exists, skipping seed.');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

init().catch(err => {
  console.error('❌ Init failed:', err.message);
  process.exit(1);
});
