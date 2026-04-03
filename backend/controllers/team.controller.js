const Team = require('../models/Team.model');

/** GET /api/teams — admin sees all; others see their own teams */
const getTeams = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { memberUserId: req.user.id };
    const teams  = await Team.find(filter);
    res.json({ teams, count: teams.length });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch teams.', error: err.message });
  }
};

/** POST /api/teams — admin only */
const createTeam = async (req, res) => {
  try {
    const { name, description, members } = req.body;
    if (!name) return res.status(400).json({ message: 'Team name is required.' });
    const team = await Team.create({
      name,
      description: description || '',
      members: members || [],
      created_by: req.user.id,
    });
    res.status(201).json({ message: 'Team created.', team });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create team.', error: err.message });
  }
};

/** PATCH /api/teams/:id — admin only */
const updateTeam = async (req, res) => {
  try {
    const existing = await Team.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Team not found.' });

    const { name, description, members } = req.body;
    const team = await Team.update(req.params.id, { name, description, members });
    res.json({ message: 'Team updated.', team });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update team.', error: err.message });
  }
};

/** DELETE /api/teams/:id — admin only */
const deleteTeam = async (req, res) => {
  try {
    const team = await Team.findByIdAndDelete(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found.' });
    res.json({ message: 'Team deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete team.', error: err.message });
  }
};

module.exports = { getTeams, createTeam, updateTeam, deleteTeam };
