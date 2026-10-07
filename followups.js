const express = require('express');
const router = express.Router();
const { db, logAudit } = require('./database');
const { requireAuth } = require('./auth');

router.get('/', requireAuth, (req, res) => {
  const user = req.session.user;
  let followups;

  if (user.role === 'SalesExecutive') {
    followups = db.prepare(`
      SELECT f.*, u.name as assigned_user_name
      FROM followups f
      LEFT JOIN users u ON f.assigned_user_id = u.id
      WHERE f.assigned_user_id = ?
      ORDER BY f.followup_date ASC, f.id DESC
    `).all(user.id);
  } else {
    followups = db.prepare(`
      SELECT f.*, u.name as assigned_user_name
      FROM followups f
      LEFT JOIN users u ON f.assigned_user_id = u.id
      ORDER BY f.followup_date ASC, f.id DESC
    `).all();
  }

  res.json(followups);
});

router.post('/', requireAuth, (req, res) => {
  const { entity_type, entity_id, followup_date, subject, type, status, notes, assigned_user_id } = req.body;
  const user = req.session.user;

  if (!subject || !subject.trim()) {
    return res.status(400).json({ error: 'Follow-Up subject is required.' });
  }

  if (!followup_date) {
    return res.status(400).json({ error: 'Follow-Up date is required.' });
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const currentStatus = status || 'Planned';

  if (['Planned', 'New'].includes(currentStatus) && followup_date < todayStr) {
    return res.status(400).json({ error: 'Follow-up date cannot be earlier than today.' });
  }

  const targetAssignedUser = (user.role === 'SalesExecutive') ? user.id : (assigned_user_id ? parseInt(assigned_user_id) : user.id);

  const result = db.prepare(`
    INSERT INTO followups (entity_type, entity_id, followup_date, subject, type, status, notes, assigned_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(entity_type || 'Customer', parseInt(entity_id || 1), followup_date, subject.trim(), type || 'Call', currentStatus, notes || '', targetAssignedUser);

  const newId = result.lastInsertRowid;
  const newFollowup = db.prepare('SELECT * FROM followups WHERE id = ?').get(newId);

  logAudit(req, 'CREATE_FOLLOWUP', 'FollowUp', newId, null, newFollowup);

  res.status(201).json({ message: 'Follow-Up created successfully.', followup: newFollowup });
});

router.put('/:id', requireAuth, (req, res) => {
  const { followup_date, subject, type, status, notes, assigned_user_id } = req.body;
  const user = req.session.user;
  const followupId = req.params.id;

  const existing = db.prepare('SELECT * FROM followups WHERE id = ?').get(followupId);
  if (!existing) {
    return res.status(404).json({ error: 'Follow-Up not found.' });
  }

  if (user.role === 'SalesExecutive' && existing.assigned_user_id !== user.id) {
    return res.status(403).json({ error: 'Forbidden. You cannot edit this follow-up.' });
  }

  if (!subject || !subject.trim()) {
    return res.status(400).json({ error: 'Follow-Up subject is required.' });
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const currentStatus = status || existing.status;

  if (['Planned', 'New'].includes(currentStatus) && followup_date && followup_date < todayStr) {
    return res.status(400).json({ error: 'Follow-up date cannot be earlier than today.' });
  }

  const targetAssignedUser = (user.role === 'SalesExecutive') ? existing.assigned_user_id : (assigned_user_id ? parseInt(assigned_user_id) : existing.assigned_user_id);

  db.prepare(`
    UPDATE followups
    SET followup_date = ?, subject = ?, type = ?, status = ?, notes = ?, assigned_user_id = ?
    WHERE id = ?
  `).run(followup_date || existing.followup_date, subject.trim(), type || existing.type, currentStatus, notes || '', targetAssignedUser, followupId);

  const updatedFollowup = db.prepare('SELECT * FROM followups WHERE id = ?').get(followupId);

  logAudit(req, 'UPDATE_FOLLOWUP', 'FollowUp', followupId, existing, updatedFollowup);

  res.json({ message: 'Follow-Up updated successfully.', followup: updatedFollowup });
});

router.delete('/:id', requireAuth, (req, res) => {
  const user = req.session.user;
  const followupId = req.params.id;

  const existing = db.prepare('SELECT * FROM followups WHERE id = ?').get(followupId);
  if (!existing) {
    return res.status(404).json({ error: 'Follow-Up not found.' });
  }

  if (user.role === 'SalesExecutive' && existing.assigned_user_id !== user.id) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  db.prepare('DELETE FROM followups WHERE id = ?').run(followupId);

  logAudit(req, 'DELETE_FOLLOWUP', 'FollowUp', followupId, existing, null);

  res.json({ message: 'Follow-Up deleted successfully.' });
});

module.exports = router;
