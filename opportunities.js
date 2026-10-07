const express = require('express');
const router = express.Router();
const { db, logAudit } = require('./database');
const { requireAuth } = require('./auth');

router.get('/', requireAuth, (req, res) => {
  const user = req.session.user;
  let opps;

  if (user.role === 'SalesExecutive') {
    opps = db.prepare(`
      SELECT o.*, c.name as customer_name, u.name as owner_name 
      FROM opportunities o 
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN users u ON o.owner_id = u.id 
      WHERE o.owner_id = ? AND o.is_deleted = 0
      ORDER BY o.id DESC
    `).all(user.id);
  } else {
    opps = db.prepare(`
      SELECT o.*, c.name as customer_name, u.name as owner_name 
      FROM opportunities o 
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN users u ON o.owner_id = u.id 
      WHERE o.is_deleted = 0
      ORDER BY o.id DESC
    `).all();
  }

  res.json(opps);
});

router.post('/', requireAuth, (req, res) => {
  const { name, customer_id, stage, amount, probability, expected_close_date, source, notes, owner_id } = req.body;
  const user = req.session.user;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Opportunity Name is required.' });
  }

  if (!customer_id) {
    return res.status(400).json({ error: 'Customer is required.' });
  }

  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: 'Opportunity Amount must be greater than 0.' });
  }

  const numProb = Number(probability);
  if (isNaN(numProb) || numProb < 0 || numProb > 100) {
    return res.status(400).json({ error: 'Probability must be between 0 and 100.' });
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const currentStage = stage || 'Qualification';
  const isActive = !['Won', 'Lost'].includes(currentStage);

  if (isActive && expected_close_date && expected_close_date < todayStr) {
    return res.status(400).json({ error: 'Expected Close Date cannot be in the past for an active opportunity.' });
  }

  const assignedOwnerId = (user.role === 'SalesExecutive') ? user.id : (owner_id ? parseInt(owner_id) : user.id);

  const result = db.prepare(`
    INSERT INTO opportunities (name, customer_id, owner_id, stage, amount, probability, expected_close_date, source, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name.trim(), parseInt(customer_id), assignedOwnerId, currentStage, numAmount, numProb, expected_close_date, source || '', notes || '');

  const newId = result.lastInsertRowid;
  const newOpp = db.prepare('SELECT * FROM opportunities WHERE id = ?').get(newId);

  logAudit(req, 'CREATE_OPPORTUNITY', 'Opportunity', newId, null, newOpp);

  res.status(201).json({ message: 'Opportunity created successfully.', opportunity: newOpp });
});

router.put('/:id', requireAuth, (req, res) => {
  const { name, customer_id, stage, amount, probability, expected_close_date, source, notes, owner_id } = req.body;
  const user = req.session.user;
  const oppId = req.params.id;

  const existing = db.prepare('SELECT * FROM opportunities WHERE id = ? AND is_deleted = 0').get(oppId);
  if (!existing) {
    return res.status(404).json({ error: 'Opportunity not found.' });
  }

  if (user.role === 'SalesExecutive' && existing.owner_id !== user.id) {
    return res.status(403).json({ error: 'Forbidden. You cannot edit this opportunity.' });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Opportunity Name is required.' });
  }

  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: 'Opportunity Amount must be greater than 0.' });
  }

  const numProb = Number(probability);
  if (isNaN(numProb) || numProb < 0 || numProb > 100) {
    return res.status(400).json({ error: 'Probability must be between 0 and 100.' });
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const currentStage = stage || existing.stage;
  const isActive = !['Won', 'Lost'].includes(currentStage);

  if (isActive && expected_close_date && expected_close_date < todayStr) {
    return res.status(400).json({ error: 'Expected Close Date cannot be in the past for an active opportunity.' });
  }

  const assignedOwnerId = (user.role === 'SalesExecutive') ? existing.owner_id : (owner_id ? parseInt(owner_id) : existing.owner_id);

  db.prepare(`
    UPDATE opportunities
    SET name = ?, customer_id = ?, owner_id = ?, stage = ?, amount = ?, probability = ?, expected_close_date = ?, source = ?, notes = ?
    WHERE id = ?
  `).run(name.trim(), parseInt(customer_id || existing.customer_id), assignedOwnerId, currentStage, numAmount, numProb, expected_close_date || existing.expected_close_date, source || '', notes || '', oppId);

  const updatedOpp = db.prepare('SELECT * FROM opportunities WHERE id = ?').get(oppId);

  logAudit(req, 'UPDATE_OPPORTUNITY', 'Opportunity', oppId, existing, updatedOpp);

  res.json({ message: 'Opportunity updated successfully.', opportunity: updatedOpp });
});

router.delete('/:id', requireAuth, (req, res) => {
  const user = req.session.user;
  const oppId = req.params.id;

  const existing = db.prepare('SELECT * FROM opportunities WHERE id = ? AND is_deleted = 0').get(oppId);
  if (!existing) {
    return res.status(404).json({ error: 'Opportunity not found.' });
  }

  if (user.role === 'SalesExecutive' && existing.owner_id !== user.id) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  db.prepare('UPDATE opportunities SET is_deleted = 1 WHERE id = ?').run(oppId);

  logAudit(req, 'DELETE_OPPORTUNITY', 'Opportunity', oppId, existing, { is_deleted: 1 });

  res.json({ message: 'Opportunity deleted successfully.' });
});

module.exports = router;
