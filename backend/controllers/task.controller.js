const Task = require('../models/Task.model');
const Team = require('../models/Team.model');
const pool = require('../db/pool');

/**
 * GET /api/tasks
 * - admin: ALL tasks
 * - everyone else: tasks assigned to them personally OR tasks assigned to a team they're in
 */
const getTasks = async (req, res) => {
  try {
    let tasks;
    if (req.user.role === 'admin') {
      tasks = await Task.find();  // no filter → all
    } else {
      // Get team IDs the user belongs to
      const { rows: teamRows } = await pool.query(
        'SELECT team_id FROM team_members WHERE user_id = $1',
        [req.user.id]
      );
      const teamIds = teamRows.map(r => r.team_id);
      tasks = await Task.find({ userId: req.user.id, teamIds });
    }
    res.json({ tasks, count: tasks.length });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch tasks.', error: err.message });
  }
};

/**
 * POST /api/tasks
 * - Admin: assigns to a user, a team, or leaves unassigned
 * - Others: task is assigned to themselves (self)
 */
const createTask = async (req, res) => {
  try {
    const { title, description, priority, status, assignment_type, assigned_to, assigned_team } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required.' });

    let taskData = {
      title,
      description: description || '',
      priority:    priority    || 'medium',
      status:      status      || 'pending',
      created_by:  req.user.id,
    };

    if (req.user.role === 'admin') {
      const at = assignment_type || 'user';
      taskData.assignment_type = at;
      taskData.assigned_to     = at === 'user' ? (assigned_to   || null) : null;
      taskData.assigned_team   = at === 'team' ? (assigned_team || null) : null;
    } else {
      taskData.assignment_type = 'self';
      taskData.assigned_to     = req.user.id;
    }

    const task = await Task.create(taskData);
    res.status(201).json({ message: 'Task created.', task });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create task.', error: err.message });
  }
};

/**
 * PATCH /api/tasks/:id
 * - ANYONE with access can edit title, description, status, priority
 * - Only ADMIN can change assignment (assigned_to, assigned_team, assignment_type)
 */
const updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    // Check access
    if (req.user.role !== 'admin') {
      const isDirectAssignee = task.assigned_to === req.user.id;
      const isCreator        = task.created_by  === req.user.id;

      let isTeamMember = false;
      if (task.assignment_type === 'team' && task.assigned_team) {
        const { rows } = await pool.query(
          'SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2',
          [task.assigned_team, req.user.id]
        );
        isTeamMember = rows.length > 0;
      }

      if (!isDirectAssignee && !isCreator && !isTeamMember)
        return res.status(403).json({ message: 'Access denied.' });
    }

    // Build update payload
    const fields = {};
    const { title, description, status, priority } = req.body;
    if (title       !== undefined) fields.title       = title;
    if (description !== undefined) fields.description = description;
    if (status      !== undefined) fields.status      = status;
    if (priority    !== undefined) fields.priority    = priority;

    // Only admin can reassign
    if (req.user.role === 'admin') {
      const { assignment_type, assigned_to, assigned_team } = req.body;
      if (assignment_type !== undefined) {
        fields.assignment_type = assignment_type;
        fields.assigned_to     = assignment_type === 'user' ? (assigned_to   || null) : null;
        fields.assigned_team   = assignment_type === 'team' ? (assigned_team || null) : null;
      }
    }

    const updated = await Task.update(req.params.id, fields);
    res.json({ message: 'Task updated.', task: updated });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update task.', error: err.message });
  }
};

/**
 * DELETE /api/tasks/:id
 * - Admin: any task
 * - Others: only tasks they created or are directly assigned to
 */
const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    if (req.user.role !== 'admin') {
      const ok =
        task.assigned_to === req.user.id ||
        task.created_by  === req.user.id;
      if (!ok) return res.status(403).json({ message: 'Access denied.' });
    }

    await Task.deleteOne(req.params.id);
    res.json({ message: 'Task deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete task.', error: err.message });
  }
};

module.exports = { getTasks, createTask, updateTask, deleteTask };
