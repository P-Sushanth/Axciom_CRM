const express = require('express');
const router = express.Router();
const { db } = require('./database');
const { requireAuth } = require('./auth');

router.get('/stats', requireAuth, (req, res) => {
  const user = req.session.user;

  let totalCustomers, openLeads, openOpportunities, totalPipelineValue, pendingFollowups;

  if (user.role === 'SalesExecutive') {
    totalCustomers = db.prepare('SELECT COUNT(*) as count FROM customers WHERE owner_id = ? AND is_deleted = 0').get(user.id).count;
    openLeads = db.prepare("SELECT COUNT(*) as count FROM leads WHERE owner_id = ? AND status != 'Converted' AND is_deleted = 0").get(user.id).count;
    openOpportunities = db.prepare("SELECT COUNT(*) as count FROM opportunities WHERE owner_id = ? AND stage NOT IN ('Won', 'Lost') AND is_deleted = 0").get(user.id).count;
    totalPipelineValue = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM opportunities WHERE owner_id = ? AND stage NOT IN ('Won', 'Lost') AND is_deleted = 0").get(user.id).total;
    pendingFollowups = db.prepare("SELECT COUNT(*) as count FROM followups WHERE assigned_user_id = ? AND status = 'Planned'").get(user.id).count;
  } else {
    totalCustomers = db.prepare('SELECT COUNT(*) as count FROM customers WHERE is_deleted = 0').get().count;
    openLeads = db.prepare("SELECT COUNT(*) as count FROM leads WHERE status != 'Converted' AND is_deleted = 0").get().count;
    openOpportunities = db.prepare("SELECT COUNT(*) as count FROM opportunities WHERE stage NOT IN ('Won', 'Lost') AND is_deleted = 0").get().count;
    totalPipelineValue = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM opportunities WHERE stage NOT IN ('Won', 'Lost') AND is_deleted = 0").get().total;
    pendingFollowups = db.prepare("SELECT COUNT(*) as count FROM followups WHERE status = 'Planned'").get().count;
  }

  res.json({
    totalCustomers,
    openLeads,
    openOpportunities,
    totalPipelineValue,
    pendingFollowups
  });
});

router.get('/chart', requireAuth, (req, res) => {
  const user = req.session.user;
  const stages = ['Qualification', 'Proposal', 'Negotiation', 'Won', 'Lost'];

  let stageData = [];

  stages.forEach(stage => {
    let row;
    if (user.role === 'SalesExecutive') {
      row = db.prepare(`
        SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount
        FROM opportunities
        WHERE owner_id = ? AND stage = ? AND is_deleted = 0
      `).get(user.id, stage);
    } else {
      row = db.prepare(`
        SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount
        FROM opportunities
        WHERE stage = ? AND is_deleted = 0
      `).get(stage);
    }

    stageData.push({
      stage,
      count: row.count,
      totalAmount: row.total_amount
    });
  });

  res.json(stageData);
});

module.exports = router;
