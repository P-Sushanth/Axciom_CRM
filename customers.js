const express = require('express');
const router = express.Router();
const { db, logAudit } = require('./database');
const { requireAuth, emailRegex } = require('./auth');

const phoneRegex = /^\d{10}$/;

router.get('/', requireAuth, (req, res) => {
  const user = req.session.user;
  let customers;

  if (user.role === 'SalesExecutive') {
    customers = db.prepare(`
      SELECT c.*, u.name as owner_name 
      FROM customers c 
      LEFT JOIN users u ON c.owner_id = u.id 
      WHERE c.owner_id = ? AND c.is_deleted = 0
      ORDER BY c.id DESC
    `).all(user.id);
  } else {
    customers = db.prepare(`
      SELECT c.*, u.name as owner_name 
      FROM customers c 
      LEFT JOIN users u ON c.owner_id = u.id 
      WHERE c.is_deleted = 0
      ORDER BY c.id DESC
    `).all();
  }

  res.json(customers);
});

router.get('/:id', requireAuth, (req, res) => {
  const user = req.session.user;
  const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND is_deleted = 0').get(req.params.id);

  if (!customer) {
    return res.status(404).json({ error: 'Customer not found.' });
  }

  if (user.role === 'SalesExecutive' && customer.owner_id !== user.id) {
    return res.status(403).json({ error: 'Forbidden. You do not have access to this customer record.' });
  }

  res.json(customer);
});

router.post('/', requireAuth, (req, res) => {
  const { name, email, phone, address, status, owner_id, notes } = req.body;
  const user = req.session.user;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Customer Name is required.' });
  }

  if (!email || !emailRegex.test(email.trim())) {
    return res.status(400).json({ error: 'Enter a valid email address (e.g. user@example.com).' });
  }

  if (!phone || !phoneRegex.test(phone.trim())) {
    return res.status(400).json({ error: 'Enter a valid 10-digit phone number.' });
  }

  const assignedOwnerId = (user.role === 'SalesExecutive') ? user.id : (owner_id ? parseInt(owner_id) : user.id);

  const result = db.prepare(`
    INSERT INTO customers (name, email, phone, address, status, owner_id, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name.trim(), email.trim(), phone.trim(), address || '', status || 'Active', assignedOwnerId, notes || '');

  const newId = result.lastInsertRowid;
  const newRecord = db.prepare('SELECT * FROM customers WHERE id = ?').get(newId);

  logAudit(req, 'CREATE_CUSTOMER', 'Customer', newId, null, newRecord);

  res.status(201).json({ message: 'Customer created successfully.', customer: newRecord });
});

router.put('/:id', requireAuth, (req, res) => {
  const { name, email, phone, address, status, owner_id, notes } = req.body;
  const user = req.session.user;
  const customerId = req.params.id;

  const existing = db.prepare('SELECT * FROM customers WHERE id = ? AND is_deleted = 0').get(customerId);
  if (!existing) {
    return res.status(404).json({ error: 'Customer not found.' });
  }

  if (user.role === 'SalesExecutive' && existing.owner_id !== user.id) {
    return res.status(403).json({ error: 'Forbidden. You cannot edit this customer record.' });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Customer Name is required.' });
  }

  if (!email || !emailRegex.test(email.trim())) {
    return res.status(400).json({ error: 'Enter a valid email address (e.g. user@example.com).' });
  }

  if (!phone || !phoneRegex.test(phone.trim())) {
    return res.status(400).json({ error: 'Enter a valid 10-digit phone number.' });
  }

  const assignedOwnerId = (user.role === 'SalesExecutive') ? existing.owner_id : (owner_id ? parseInt(owner_id) : existing.owner_id);

  db.prepare(`
    UPDATE customers 
    SET name = ?, email = ?, phone = ?, address = ?, status = ?, owner_id = ?, notes = ?
    WHERE id = ?
  `).run(name.trim(), email.trim(), phone.trim(), address || '', status || 'Active', assignedOwnerId, notes || '', customerId);

  const updatedRecord = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);

  logAudit(req, 'UPDATE_CUSTOMER', 'Customer', customerId, existing, updatedRecord);

  res.json({ message: 'Customer updated successfully.', customer: updatedRecord });
});

router.delete('/:id', requireAuth, (req, res) => {
  const user = req.session.user;
  const customerId = req.params.id;

  const existing = db.prepare('SELECT * FROM customers WHERE id = ? AND is_deleted = 0').get(customerId);
  if (!existing) {
    return res.status(404).json({ error: 'Customer not found.' });
  }

  if (user.role === 'SalesExecutive' && existing.owner_id !== user.id) {
    return res.status(403).json({ error: 'Forbidden. You cannot delete this customer record.' });
  }

  db.prepare('UPDATE customers SET is_deleted = 1 WHERE id = ?').run(customerId);

  logAudit(req, 'DELETE_CUSTOMER', 'Customer', customerId, existing, { is_deleted: 1 });

  res.json({ message: 'Customer deleted successfully.' });
});

module.exports = router;
