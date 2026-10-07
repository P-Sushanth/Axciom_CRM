const express = require('express');
const router = express.Router();
const { db } = require('./database');
const { requireRoles } = require('./auth');

router.get('/', requireRoles('Admin'), (req, res) => {
  const { action, entity, search } = req.query;

  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];

  if (action) {
    query += ' AND action = ?';
    params.push(action);
  }

  if (entity) {
    query += ' AND entity_name = ?';
    params.push(entity);
  }

  if (search) {
    query += ' AND (user_email LIKE ? OR action LIKE ? OR entity_name LIKE ? OR new_value LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  query += ' ORDER BY id DESC LIMIT 200';

  const logs = db.prepare(query).all(...params);
  res.json(logs);
});

module.exports = router;
