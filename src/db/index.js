const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') || process.env.DATABASE_URL?.includes('render')
    ? { rejectUnauthorized: false }
    : false,
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id       TEXT PRIMARY KEY,
        username      TEXT NOT NULL,
        emeralds      INTEGER NOT NULL DEFAULT 0,
        verified      BOOLEAN NOT NULL DEFAULT FALSE,
        daily_last_claim TIMESTAMPTZ,
        total_spent   INTEGER NOT NULL DEFAULT 0,
        warnings      INTEGER NOT NULL DEFAULT 0,
        joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS mod_requests (
        request_id    TEXT PRIMARY KEY,
        user_id       TEXT NOT NULL REFERENCES users(user_id),
        mod_name      TEXT NOT NULL,
        mc_version    TEXT NOT NULL,
        modloader     TEXT NOT NULL,
        description   TEXT NOT NULL,
        features      TEXT,
        price         INTEGER,
        status        TEXT NOT NULL DEFAULT 'pending',
        channel_id    TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at  TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS transactions (
        tx_id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id       TEXT NOT NULL REFERENCES users(user_id),
        type          TEXT NOT NULL,
        amount        INTEGER NOT NULL,
        balance_after INTEGER NOT NULL,
        note          TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS warnings (
        warn_id       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id       TEXT NOT NULL REFERENCES users(user_id),
        staff_id      TEXT NOT NULL,
        reason        TEXT NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✅ Database tables ready.');
  } finally {
    client.release();
  }
}

// ── User helpers ──────────────────────────────────────────────────────────────

async function getUser(userId) {
  const res = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
  return res.rows[0] || null;
}

async function ensureUser(userId, username) {
  await pool.query(
    `INSERT INTO users (user_id, username) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET username = $2`,
    [userId, username]
  );
  return getUser(userId);
}

async function modifyEmeralds(userId, amount, type, note = null) {
  const res = await pool.query(
    `UPDATE users SET emeralds = GREATEST(0, emeralds + $1)
     WHERE user_id = $2 RETURNING emeralds`,
    [amount, userId]
  );
  const newBalance = res.rows[0].emeralds;
  await pool.query(
    `INSERT INTO transactions (user_id, type, amount, balance_after, note)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, type, amount, newBalance, note]
  );
  return newBalance;
}

async function setEmeralds(userId, amount, note = null) {
  const res = await pool.query(
    `UPDATE users SET emeralds = $1 WHERE user_id = $2 RETURNING emeralds`,
    [amount, userId]
  );
  const newBalance = res.rows[0].emeralds;
  await pool.query(
    `INSERT INTO transactions (user_id, type, amount, balance_after, note)
     VALUES ($1, 'admin_set', $2, $3, $4)`,
    [userId, amount, newBalance, note]
  );
  return newBalance;
}

// ── Request helpers ───────────────────────────────────────────────────────────

async function createRequest(data) {
  // Generate REQ-XXXX id
  const countRes = await pool.query('SELECT COUNT(*) FROM mod_requests');
  const num = String(parseInt(countRes.rows[0].count) + 1).padStart(4, '0');
  const requestId = `REQ-${num}`;

  await pool.query(
    `INSERT INTO mod_requests
       (request_id, user_id, mod_name, mc_version, modloader, description, features, channel_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [requestId, data.userId, data.modName, data.mcVersion, data.modloader,
     data.description, data.features || null, data.channelId]
  );
  return requestId;
}

async function getRequest(requestId) {
  const res = await pool.query('SELECT * FROM mod_requests WHERE request_id = $1', [requestId]);
  return res.rows[0] || null;
}

async function updateRequestStatus(requestId, status, extra = {}) {
  const fields = ['status = $2'];
  const vals = [requestId, status];
  let i = 3;
  if (extra.price !== undefined)       { fields.push(`price = $${i++}`);        vals.push(extra.price); }
  if (extra.channelId !== undefined)   { fields.push(`channel_id = $${i++}`);   vals.push(extra.channelId); }
  if (status === 'completed')          { fields.push(`completed_at = NOW()`); }
  await pool.query(`UPDATE mod_requests SET ${fields.join(', ')} WHERE request_id = $1`, vals);
}

async function getLeaderboard(limit = 10) {
  const res = await pool.query(
    'SELECT user_id, username, emeralds FROM users ORDER BY emeralds DESC LIMIT $1',
    [limit]
  );
  return res.rows;
}

module.exports = {
  pool, initDB,
  getUser, ensureUser, modifyEmeralds, setEmeralds,
  createRequest, getRequest, updateRequestStatus, getLeaderboard,
};
