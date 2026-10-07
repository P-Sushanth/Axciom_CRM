const express = require('express');
const router = express.Router();
const { db, logAudit } = require('./database');
const { requireAuth, emailRegex } = require('./auth');

const phoneRegex = /^\d{10}$/;

router.get('/', requireAuth, (req, res) => {
  const user = req.session.user;
  let leads;

  if (user.role === 'SalesExecutive') {
    leads = db.prepare(`
      SELECT l.*, u.name as owner_name 
      FROM leads l 
      LEFT JOIN users u ON l.owner_id = u.id 
      WHERE l.owner_id = ? AND l.is_deleted = 0
      ORDER BY l.id DESC
    `).all(user.id);
  } else {
    leads = db.prepare(`
      SELECT l.*, u.name as owner_name 
      FROM leads l 
      LEFT JOIN users u ON l.owner_id = u.id 
      WHERE l.is_deleted = 0
      ORDER BY l.id DESC
    `).all();
  }

  res.json(leads);
});

router.post('/', requireAuth, (req, res) => {
  const { name, email, phone, source, status, priority, owner_id, notes } = req.body;
  const user = req.session.user;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Lead Name is required.' });
  }

  if (!email || !emailRegex.test(email.trim())) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  if (!phone || !phoneRegex.test(phone.trim())) {
    return res.status(400).json({ error: 'Enter a valid 10-digit phone number.' });
  }

  const assignedOwnerId = (user.role === 'SalesExecutive') ? user.id : (owner_id ? parseInt(owner_id) : user.id);

  const result = db.prepare(`
    INSERT INTO leads (name, email, phone, source, status, priority, owner_id, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name.trim(), email.trim(), phone.trim(), source || 'Web', status || 'New', priority || 'Medium', assignedOwnerId, notes || '');

  const newId = result.lastInsertRowid;
  const newLead = db.prepare('SELECT * FROM leads WHERE id = ?').get(newId);

  logAudit(req, 'CREATE_LEAD', 'Lead', newId, null, newLead);

  res.status(201).json({ message: 'Lead created successfully.', lead: newLead });
});

router.put('/:id', requireAuth, (req, res) => {
  const { name, email, phone, source, status, priority, owner_id, notes } = req.body;
  const user = req.session.user;
  const leadId = req.params.id;

  const existing = db.prepare('SELECT * FROM leads WHERE id = ? AND is_deleted = 0').get(leadId);
  if (!existing) {
    return res.status(404).json({ error: 'Lead not found.' });
  }

  if (user.role === 'SalesExecutive' && existing.owner_id !== user.id) {
    return res.status(403).json({ error: 'Forbidden. You cannot edit this lead.' });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Lead Name is required.' });
  }

  if (!email || !emailRegex.test(email.trim())) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  if (!phone || !phoneRegex.test(phone.trim())) {
    return res.status(400).json({ error: 'Enter a valid 10-digit phone number.' });
  }

  const assignedOwnerId = (user.role === 'SalesExecutive') ? existing.owner_id : (owner_id ? parseInt(owner_id) : existing.owner_id);

  db.prepare(`
    UPDATE leads
    SET name = ?, email = ?, phone = ?, source = ?, status = ?, priority = ?, owner_id = ?, notes = ?
    WHERE id = ?
  `).run(name.trim(), email.trim(), phone.trim(), source || 'Web', status || existing.status, priority || existing.priority, assignedOwnerId, notes || '', leadId);

  const updatedLead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);

  logAudit(req, 'UPDATE_LEAD', 'Lead', leadId, existing, updatedLead);

  res.json({ message: 'Lead updated successfully.', lead: updatedLead });
});

router.post('/:id/convert', requireAuth, (req, res) => {
  const user = req.session.user;
  const leadId = req.params.id;

  const lead = db.prepare('SELECT * FROM leads WHERE id = ? AND is_deleted = 0').get(leadId);
  if (!lead) {
    return res.status(404).json({ error: 'Lead not found.' });
  }

  if (user.role === 'SalesExecutive' && lead.owner_id !== user.id) {
    return res.status(403).json({ error: 'Forbidden. You cannot convert this lead.' });
  }

  if (lead.status === 'Converted') {
    return res.status(400).json({ error: 'Lead has already been converted.' });
  }

  const custResult = db.prepare(`
    INSERT INTO customers (name, email, phone, address, status, owner_id, notes)
    VALUES (?, ?, ?, ?, 'Active', ?, ?)
  `).run(lead.name, lead.email, lead.phone, '', lead.owner_id, `Converted from Lead ID ${lead.id}. ${lead.notes || ''}`);

  const customerId = custResult.lastInsertRowid;

  db.prepare("UPDATE leads SET status = 'Converted' WHERE id = ?").run(leadId);

  logAudit(req, 'CONVERT_LEAD', 'Lead', leadId, lead, { status: 'Converted', created_customer_id: customerId });

  res.json({ message: 'Lead successfully converted to Customer.', customer_id: customerId });
});

router.delete('/:id', requireAuth, (req, res) => {
  const user = req.session.user;
  const leadId = req.params.id;

  const existing = db.prepare('SELECT * FROM leads WHERE id = ? AND is_deleted = 0').get(leadId);
  if (!existing) {
    return res.status(404).json({ error: 'Lead not found.' });
  }

  if (user.role === 'SalesExecutive' && existing.owner_id !== user.id) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  db.prepare('UPDATE leads SET is_deleted = 1 WHERE id = ?').run(leadId);

  logAudit(req, 'DELETE_LEAD', 'Lead', leadId, existing, { is_deleted: 1 });

  res.json({ message: 'Lead deleted successfully.' });
});

module.exports = router;
