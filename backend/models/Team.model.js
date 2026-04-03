const pool = require('../db/pool');

/**
 * Helper: fetch a team row with its members and creator populated.
 * Returns null if not found.
 */
async function populateTeam(teamId) {
  // Base team row
  const { rows: teamRows } = await pool.query(
    `SELECT t.id, t.name, t.description, t.created_at, t.updated_at,
            u.id AS cb_id, u.name AS cb_name, u.email AS cb_email
     FROM teams t
     JOIN users u ON u.id = t.created_by
     WHERE t.id = $1`,
    [teamId]
  );
  if (!teamRows.length) return null;

  const t = teamRows[0];

  // Members
  const { rows: members } = await pool.query(
    `SELECT u.id, u.name, u.email, u.role
     FROM team_members tm
     JOIN users u ON u.id = tm.user_id
     WHERE tm.team_id = $1`,
    [teamId]
  );

  return {
    id: t.id,
    name: t.name,
    description: t.description,
    created_at: t.created_at,
    updated_at: t.updated_at,
    created_by: { id: t.cb_id, name: t.cb_name, email: t.cb_email },
    members,
  };
}

const Team = {
  populateTeam,

  /** Find teams; filter = {} for all, or { memberUserId } to filter by membership */
  async find({ memberUserId } = {}) {
    let rows;
    if (memberUserId) {
      ({ rows } = await pool.query(
        `SELECT DISTINCT t.id FROM teams t
         JOIN team_members tm ON tm.team_id = t.id
         WHERE tm.user_id = $1
         ORDER BY t.id`,
        [memberUserId]
      ));
    } else {
      ({ rows } = await pool.query('SELECT id FROM teams ORDER BY created_at DESC'));
    }
    return Promise.all(rows.map(r => populateTeam(r.id)));
  },

  async findById(id) {
    return populateTeam(id);
  },

  /** Returns plain row with only {id, members:[]} for membership check */
  async findByIdRaw(id) {
    const { rows: memberRows } = await pool.query(
      'SELECT user_id FROM team_members WHERE team_id = $1',
      [id]
    );
    if (!memberRows.length && !(await pool.query('SELECT 1 FROM teams WHERE id=$1', [id])).rows.length)
      return null;
    return { id, members: memberRows.map(r => r.user_id) };
  },

  async create({ name, description = '', members = [], created_by }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO teams (name, description, created_by)
         VALUES ($1, $2, $3) RETURNING id`,
        [name, description, created_by]
      );
      const teamId = rows[0].id;
      for (const uid of members) {
        await client.query(
          'INSERT INTO team_members (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [teamId, uid]
        );
      }
      await client.query('COMMIT');
      return populateTeam(teamId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async update(id, { name, description, members }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (name !== undefined || description !== undefined) {
        const sets = [];
        const vals = [];
        if (name        !== undefined) { vals.push(name);        sets.push(`name = $${vals.length}`); }
        if (description !== undefined) { vals.push(description); sets.push(`description = $${vals.length}`); }
        vals.push(id);
        await client.query(
          `UPDATE teams SET ${sets.join(', ')} WHERE id = $${vals.length}`,
          vals
        );
      }
      if (members !== undefined) {
        await client.query('DELETE FROM team_members WHERE team_id = $1', [id]);
        for (const uid of members) {
          await client.query(
            'INSERT INTO team_members (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [id, uid]
          );
        }
      }
      await client.query('COMMIT');
      return populateTeam(id);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async findByIdAndDelete(id) {
    const { rows } = await pool.query(
      'DELETE FROM teams WHERE id = $1 RETURNING id',
      [id]
    );
    return rows[0] || null;
  },
};

module.exports = Team;
