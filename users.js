const express = require('express');
const router = express.Router();
const { db, logAudit } = require('./database');
const bcrypt = require('bcryptjs');
const { requireRoles, emailRegex } = require('./auth');

router.get('/', requireRoles('Admin'), (req, res) => {
  const users = db.prepare(`
    SELECT id, name, email, role, is_active, failed_login_attempts, lockout_until, created_at
    FROM users
    ORDER BY id DESC
  `).all();

  res.json(users);
});

router.post('/', requireRoles('Admin'), (req, res) => {
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

  if (!role || !['Admin', 'Manager', 'SalesExecutive'].includes(role)) {
    return res.status(400).json({ error: 'Valid role is required (Admin, Manager, SalesExecutive).' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (existing) {
    return res.status(400).json({ error: 'User with this email already exists.' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (?, ?, ?, ?)
  `).run(name.trim(), email.trim().toLowerCase(), hash, role);

  const newId = result.lastInsertRowid;

  logAudit(req, 'CREATE_USER', 'User', newId, null, { name: name.trim(), email: email.trim().toLowerCase(), role });

  res.status(201).json({ message: 'User created successfully.' });
});

router.put('/:id/role', requireRoles('Admin'), (req, res) => {
  const { role } = req.body;
  const userId = req.params.id;

  if (!role || !['Admin', 'Manager', 'SalesExecutive'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role.' });
  }

  const existing = db.prepare('SELECT id, role FROM users WHERE id = ?').get(userId);
  if (!existing) {
    return res.status(404).json({ error: 'User not found.' });
  }

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);

  logAudit(req, 'UPDATE_USER_ROLE', 'User', userId, { role: existing.role }, { role });

  res.json({ message: 'User role updated successfully.' });
});

router.put('/:id/status', requireRoles('Admin'), (req, res) => {
  const { is_active } = req.body;
  const userId = req.params.id;

  const existing = db.prepare('SELECT id, is_active FROM users WHERE id = ?').get(userId);
  if (!existing) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const newStatus = is_active ? 1 : 0;
  db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(newStatus, userId);

  logAudit(req, 'CHANGE_USER_STATUS', 'User', userId, { is_active: existing.is_active }, { is_active: newStatus });

  res.json({ message: `User status updated to ${newStatus ? 'Active' : 'Inactive'}.` });
});

router.post('/:id/reset-password', requireRoles('Admin'), (req, res) => {
  const { new_password } = req.body;
  const userId = req.params.id;

  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
  }

  const existing = db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId);
  if (!existing) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ?, failed_login_attempts = 0, lockout_until = NULL WHERE id = ?').run(hash, userId);

  logAudit(req, 'RESET_PASSWORD', 'User', userId, null, `Reset password for user ${existing.email}`);

  res.json({ message: 'Password reset successfully.' });
});

module.exports = router;
