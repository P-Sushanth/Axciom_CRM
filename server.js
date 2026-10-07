const express = require('express');
const session = require('express-session');
const path = require('path');

const { router: authRoutes } = require('./auth');
const customerRoutes = require('./customers');
const leadRoutes = require('./leads');
const opportunityRoutes = require('./opportunities');
const followupRoutes = require('./followups');
const dashboardRoutes = require('./dashboard');
const userRoutes = require('./users');
const auditRoutes = require('./audit');
const reportRoutes = require('./reports');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'acxiom-crm-super-secret-key-998877',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use((req, res, next) => {
  if (req.path.endsWith('.html') && req.path !== '/index.html' && req.path !== '/') {
    if (!req.session || !req.session.user) {
      return res.redirect('/index.html');
    }
  }
  next();
});

app.use(express.static(__dirname));

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/opportunities', opportunityRoutes);
app.use('/api/followups', followupRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/reports', reportRoutes);

app.get('/', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard.html');
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`AcxiomCRM Server running at http://localhost:${PORT}`);
});
