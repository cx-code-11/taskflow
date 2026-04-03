require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const pool    = require('./db/pool');

const authRoutes = require('./routes/auth.routes');
const taskRoutes = require('./routes/task.routes');
const userRoutes = require('./routes/user.routes');
const teamRoutes = require('./routes/team.routes');

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',  authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'OK', db: 'PostgreSQL' }));
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;

pool.query('SELECT NOW()')
  .then(() => {
    console.log('✅ PostgreSQL connected');
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
    console.log('💡 First time? Run: npm run db:init');
  })
  .catch(err => {
    console.error('❌ PostgreSQL connection failed:', err.message);
    process.exit(1);
  });
