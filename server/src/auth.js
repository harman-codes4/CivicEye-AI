import crypto from 'node:crypto';
import { db, makeId, nowIso } from './db.js';

export const SESSION_COOKIE = 'civiceye_session';
export const DEMO_CITIZEN_ID = 'USR-DEMO-CITIZEN';
export const DEMO_AUTHORITY_ID = 'USR-DEMO-AUTHORITY';

const SESSION_DAYS = 7;
const COOKIE_MAX_AGE = SESSION_DAYS * 24 * 60 * 60 * 1000;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  if (!stored) return false;
  const [scheme, saltHex, hashHex] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  try {
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(String(password), Buffer.from(saltHex, 'hex'), expected.length);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.user_id,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
  };
}

export function findUserByEmail(email) {
  return db
    .prepare('SELECT * FROM users WHERE lower(email) = ?')
    .get(normalizeEmail(email));
}

export function findUserById(userId) {
  return db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
}

export function createUser({ name, email, password, role = 'citizen' }) {
  const normalized = normalizeEmail(email);
  const existing = db.prepare('SELECT user_id FROM users WHERE lower(email) = ?').get(normalized);
  if (existing) {
    const error = new Error('An account with this email already exists.');
    error.statusCode = 409;
    throw error;
  }
  const userId = makeId('USR');
  db.prepare(
    `INSERT INTO users (user_id, name, email, password_hash, role, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(userId, String(name).trim(), normalized, hashPassword(password), role, nowIso());
  return findUserById(userId);
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + COOKIE_MAX_AGE);
  db.prepare(
    `INSERT INTO sessions (token_hash, user_id, created_at, expires_at)
     VALUES (?, ?, ?, ?)`,
  ).run(hashToken(token), userId, createdAt.toISOString(), expiresAt.toISOString());
  return { token, expiresAt };
}

export function deleteSession(token) {
  if (!token) return;
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}

export function deleteExpiredSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(nowIso());
}

function readCookie(header, name) {
  if (!header) return null;
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      return part.slice(index + 1).trim();
    }
  }
  return null;
}

export function getSessionUser(req) {
  const token = readCookie(req.headers.cookie, SESSION_COOKIE);
  if (!token) return null;
  deleteExpiredSessions();
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s
       JOIN users u ON u.user_id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?
       LIMIT 1`,
    )
    .get(hashToken(token), nowIso());
  return row || null;
}

export function attachUser(req, _res, next) {
  const user = getSessionUser(req);
  req.user = user ? publicUser(user) : null;
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    res.status(401).json({ error: 'Sign in is required for this action.' });
    return;
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: 'Sign in is required for this action.' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'You do not have permission to perform this action.' });
      return;
    }
    next();
  };
}

export function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.CIVICEYE_COOKIE_SECURE === 'true',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.CIVICEYE_COOKIE_SECURE === 'true',
    path: '/',
  });
}

export function ensureDefaultUsers() {
  const demoUsers = [
    {
      id: DEMO_CITIZEN_ID,
      name: 'Demo Citizen',
      email: process.env.DEMO_CITIZEN_EMAIL || 'citizen@civiceye.demo',
      password: process.env.DEMO_CITIZEN_PASSWORD || 'CitizenDemo#2026',
      role: 'citizen',
    },
    {
      id: DEMO_AUTHORITY_ID,
      name: 'Demo Authority',
      email: process.env.DEMO_AUTHORITY_EMAIL || 'authority@civiceye.demo',
      password: process.env.DEMO_AUTHORITY_PASSWORD || 'AuthorityDemo#2026',
      role: 'authority',
    },
  ];

  for (const user of demoUsers) {
    const existing = findUserByEmail(user.email);
    if (existing) continue;
    db.prepare(
      `INSERT INTO users (user_id, name, email, password_hash, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      user.id,
      user.name,
      normalizeEmail(user.email),
      hashPassword(user.password),
      user.role,
      nowIso(),
    );
  }
}
