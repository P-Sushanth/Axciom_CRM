const express = require('express');
const router = express.Router();
const { db } = require('./database');
const { requireRoles } = require('./auth');

router.get('/pipeline', requireRoles('Manager', 'Admin'), (req, res) => {
  const pipeline = db.prepare(`
    SELECT stage, COUNT(*) as opportunity_count, COALESCE(SUM(amount), 0) as total_amount
    FROM opportunities
    WHERE is_deleted = 0
    GROUP BY stage
  `).all();

  const ownerPipeline = db.prepare(`
    SELECT u.name as owner_name, COUNT(o.id) as opportunity_count, COALESCE(SUM(o.amount), 0) as total_amount
    FROM opportunities o
    JOIN users u ON o.owner_id = u.id
    WHERE o.is_deleted = 0
    GROUP BY u.id
  `).all();

  res.json({ pipelineByStage: pipeline, pipelineByOwner: ownerPipeline });
});

router.get('/customers', requireRoles('Manager', 'Admin'), (req, res) => {
  const customers = db.prepare(`
    SELECT c.*, u.name as owner_name
    FROM customers c
    LEFT JOIN users u ON c.owner_id = u.id
    WHERE c.is_deleted = 0
    ORDER BY c.created_at DESC
  `).all();

  res.json(customers);
});

router.get('/leads', requireRoles('Manager', 'Admin'), (req, res) => {
  const leads = db.prepare(`
    SELECT l.*, u.name as owner_name
    FROM leads l
    LEFT JOIN users u ON l.owner_id = u.id
    WHERE l.is_deleted = 0
    ORDER BY l.created_at DESC
  `).all();

  res.json(leads);
});

module.exports = router;
