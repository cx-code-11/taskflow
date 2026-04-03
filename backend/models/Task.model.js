const pool = require('../db/pool');

/**
 * Fetch a fully-populated task row.
 * Mirrors Mongoose's .populate('assigned_to', ...) pattern.
 */
async function populateTask(taskId) {
  const { rows } = await pool.query(
    `SELECT
       t.id, t.title, t.description, t.status, t.priority,
       t.assignment_type, t.created_at, t.updated_at,

       -- assigned_to user
       au.id   AS ato_id,   au.name   AS ato_name,
       au.email AS ato_email, au.role AS ato_role,

       -- assigned_team
       te.id   AS team_id,  te.name  AS team_name,

       -- created_by user
       cu.id   AS cb_id,    cu.name  AS cb_name,
       cu.email AS cb_email, cu.role AS cb_role

     FROM tasks t
     LEFT JOIN users au ON au.id = t.assigned_to
     LEFT JOIN teams te ON te.id = t.assigned_team
     LEFT JOIN users cu ON cu.id = t.created_by
     WHERE t.id = $1`,
    [taskId]
  );

  if (!rows.length) return null;
  return shapeTask(rows[0]);
}

async function populateTasksQuery(whereClauses, params) {
  const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT
       t.id, t.title, t.description, t.status, t.priority,
       t.assignment_type, t.assigned_to AS ato_raw, t.assigned_team AS team_raw,
       t.created_at, t.updated_at,

       au.id    AS ato_id,   au.name   AS ato_name,
       au.email AS ato_email, au.role  AS ato_role,

       te.id   AS team_id,  te.name   AS team_name,

       cu.id   AS cb_id,    cu.name   AS cb_name,
       cu.email AS cb_email, cu.role  AS cb_role

     FROM tasks t
     LEFT JOIN users au ON au.id = t.assigned_to
     LEFT JOIN teams te ON te.id = t.assigned_team
     LEFT JOIN users cu ON cu.id = t.created_by
     ${where}
     ORDER BY t.created_at DESC`,
    params
  );
  return rows.map(shapeTask);
}

function shapeTask(r) {
  return {
    id:              r.id,
    title:           r.title,
    description:     r.description,
    status:          r.status,
    priority:        r.priority,
    assignment_type: r.assignment_type,
    created_at:      r.created_at,
    updated_at:      r.updated_at,
    assigned_to: r.ato_id
      ? { id: r.ato_id, name: r.ato_name, email: r.ato_email, role: r.ato_role }
      : null,
    assigned_team: r.team_id
      ? { id: r.team_id, name: r.team_name }
      : null,
    created_by: r.cb_id
      ? { id: r.cb_id, name: r.cb_name, email: r.cb_email, role: r.cb_role }
      : null,
  };
}

const Task = {
  populateTask,

  /**
   * Find tasks.
   *  - If userId is omitted → return ALL tasks (admin view).
   *  - Otherwise → tasks visible to that user (direct + team).
   */
  async find({ userId, teamIds } = {}) {
    if (!userId) {
      return populateTasksQuery([], []);
    }

    const placeholders = teamIds && teamIds.length
      ? teamIds.map((_, i) => `$${i + 2}`).join(', ')
      : null;

    const params = [userId];
    let teamClause = 'FALSE';
    if (placeholders) {
      params.push(...teamIds);
      teamClause = `(t.assignment_type = 'team' AND t.assigned_team IN (${placeholders}))`;
    }

    const wheres = [
      `(
        (t.assignment_type = 'user' AND t.assigned_to = $1)
        OR (t.assignment_type = 'self' AND t.assigned_to = $1)
        OR ${teamClause}
        OR t.created_by = $1
      )`
    ];

    return populateTasksQuery(wheres, params);
  },

  async findById(id) {
    const { rows } = await pool.query(
      `SELECT id, title, description, status, priority,
              assignment_type, assigned_to, assigned_team, created_by
       FROM tasks WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async create({ title, description = '', priority = 'medium', status = 'pending',
                  assignment_type = 'self', assigned_to = null, assigned_team = null,
                  created_by }) {
    const { rows } = await pool.query(
      `INSERT INTO tasks
         (title, description, priority, status, assignment_type, assigned_to, assigned_team, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [title, description, priority, status, assignment_type, assigned_to, assigned_team, created_by]
    );
    return populateTask(rows[0].id);
  },

  async update(id, fields) {
    const sets  = [];
    const vals  = [];
    const allowed = ['title','description','status','priority','assignment_type','assigned_to','assigned_team'];
    for (const key of allowed) {
      if (key in fields) {
        vals.push(fields[key]);
        sets.push(`${key} = $${vals.length}`);
      }
    }
    if (!sets.length) return populateTask(id);

    vals.push(id);
    await pool.query(
      `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${vals.length}`,
      vals
    );
    return populateTask(id);
  },

  async deleteOne(id) {
    const { rows } = await pool.query(
      'DELETE FROM tasks WHERE id = $1 RETURNING id',
      [id]
    );
    return rows[0] || null;
  },
};

module.exports = Task;
