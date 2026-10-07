const express = require('express');
const router = express.Router();
const { db, logAudit } = require('./database');
const bcrypt = require('bcryptjs');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    if (req.xhr || req.headers.accept?.includes('json') || (req.originalUrl && req.originalUrl.startsWith('/api/'))) {
      return res.status(401).json({ error: 'Unauthorized access. Please log in.' });
    }
    return res.redirect('/index.html');
  }
  next();
}

function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      if (req.xhr || req.headers.accept?.includes('json') || (req.originalUrl && req.originalUrl.startsWith('/api/'))) {
        return res.status(401).json({ error: 'Unauthorized access. Please log in.' });
      }
      return res.redirect('/index.html');
    }

    if (!allowedRoles.includes(req.session.user.role)) {
      if (req.xhr || req.headers.accept?.includes('json') || (req.originalUrl && req.originalUrl.startsWith('/api/'))) {
        return res.status(403).json({ error: 'Forbidden. You do not have permission to access this resource.' });
      }
      return res.status(403).send('Forbidden: Insufficient privileges.');
    }
    next();
  };
}

router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());

  if (!user) {
    logAudit(req, 'LOGIN_FAILURE', 'User', null, null, `Invalid login attempt for ${email}`);
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (user.is_active === 0) {
    logAudit(req, 'LOGIN_FAILURE', 'User', user.id, null, 'Account deactivated attempt');
    return res.status(403).json({ error: 'Account is deactivated. Please contact administrator.' });
  }

  if (user.lockout_until && new Date(user.lockout_until) > new Date()) {
    logAudit(req, 'LOGIN_LOCKED', 'User', user.id, null, 'Attempt on locked account');
    return res.status(423).json({ error: 'Account is temporarily locked due to multiple failed login attempts. Please try again later.' });
  }

  const match = bcrypt.compareSync(password, user.password_hash);
  if (!match) {
    const newFailCount = user.failed_login_attempts + 1;
    let lockoutTime = null;
    if (newFailCount >= 5) {
      lockoutTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    }

    db.prepare(`
      UPDATE users SET failed_login_attempts = ?, lockout_until = ? WHERE id = ?
    `).run(newFailCount, lockoutTime, user.id);

    logAudit(req, 'LOGIN_FAILURE', 'User', user.id, null, `Incorrect password. Failed attempt #${newFailCount}`);
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  db.prepare(`
    UPDATE users SET failed_login_attempts = 0, lockout_until = NULL WHERE id = ?
  `).run(user.id);

  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };

  logAudit(req, 'LOGIN_SUCCESS', 'User', user.id, null, `User logged in with role ${user.role}`);

  res.json({
    message: 'Login successful',
    user: req.session.user
  });
});

router.post('/register', (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required.' });
  }

  if (!email || !emailRegex.test(email.trim())) {
    return res.status(400).json({ error: 'Valid email address is required.' });
  }

  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  const assignedRole = (role && ['Admin', 'Manager', 'SalesExecutive'].includes(role)) ? role : 'SalesExecutive';

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (existing) {
    return res.status(400).json({ error: 'User with this email already exists.' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (?, ?, ?, ?)
  `).run(name.trim(), email.trim().toLowerCase(), hash, assignedRole);

  const newUserId = result.lastInsertRowid;

  logAudit(req, 'REGISTER_USER', 'User', newUserId, null, `Registered new user ${email} with role ${assignedRole}`);

  res.status(201).json({
    message: 'Registration successful! You can now log in.',
    user: { id: newUserId, name: name.trim(), email: email.trim().toLowerCase(), role: assignedRole }
  });
});

router.post('/logout', (req, res) => {
  if (req.session.user) {
    logAudit(req, 'LOGOUT', 'User', req.session.user.id, null, 'User logged out');
  }
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

router.get('/me', (req, res) => {
  if (req.session && req.session.user) {
    res.json({ user: req.session.user });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

module.exports = { router, requireAuth, requireRoles, emailRegex };
