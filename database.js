const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'acxiom_crm.db');
const db = new Database(dbPath);

db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('Admin', 'Manager', 'SalesExecutive')),
      is_active INTEGER DEFAULT 1,
      failed_login_attempts INTEGER DEFAULT 0,
      lockout_until TEXT DEFAULT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT,
      status TEXT DEFAULT 'Active',
      owner_id INTEGER NOT NULL,
      notes TEXT,
      is_deleted INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(owner_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      source TEXT,
      status TEXT DEFAULT 'New',
      priority TEXT DEFAULT 'Medium',
      owner_id INTEGER NOT NULL,
      notes TEXT,
      is_deleted INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(owner_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS opportunities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      customer_id INTEGER NOT NULL,
      owner_id INTEGER NOT NULL,
      stage TEXT NOT NULL DEFAULT 'Qualification',
      amount REAL NOT NULL,
      probability INTEGER NOT NULL,
      expected_close_date TEXT NOT NULL,
      source TEXT,
      notes TEXT,
      is_deleted INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id) REFERENCES customers(id),
      FOREIGN KEY(owner_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS followups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      followup_date TEXT NOT NULL,
      subject TEXT NOT NULL,
      type TEXT DEFAULT 'Call',
      status TEXT DEFAULT 'Planned',
      notes TEXT,
      assigned_user_id INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(assigned_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_email TEXT,
      action TEXT NOT NULL,
      entity_name TEXT NOT NULL,
      record_id INTEGER,
      old_value TEXT,
      new_value TEXT,
      ip_address TEXT,
      created_date TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  seedData();
}

function seedData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    const hashAdmin = bcrypt.hashSync('Admin123!', 10);
    const hashManager = bcrypt.hashSync('Manager123!', 10);
    const hashSales = bcrypt.hashSync('Sales123!', 10);

    const insertUser = db.prepare(`
      INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)
    `);

    const admin = insertUser.run('System Admin', 'admin@acxiom.com', hashAdmin, 'Admin');
    const manager = insertUser.run('Sales Manager', 'manager@acxiom.com', hashManager, 'Manager');
    const sales1 = insertUser.run('John SalesExec', 'sales@acxiom.com', hashSales, 'SalesExecutive');
    const sales2 = insertUser.run('Jane SalesExec', 'sales2@acxiom.com', hashSales, 'SalesExecutive');

    const adminId = admin.lastInsertRowid;
    const sales1Id = sales1.lastInsertRowid;
    const sales2Id = sales2.lastInsertRowid;

    const insertCustomer = db.prepare(`
      INSERT INTO customers (name, email, phone, address, status, owner_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const c1 = insertCustomer.run('Acme Corp', 'contact@acme.com', '9876543210', '123 Tech Park, NY', 'Active', sales1Id, 'Key account');
    const c2 = insertCustomer.run('Global Logistics', 'info@globallogistics.com', '9123456789', '456 Freight Way, CA', 'Active', sales2Id, 'Enterprise customer');
    const c3 = insertCustomer.run('Starlight Retail', 'hello@starlight.com', '9988776655', '789 Market St, TX', 'Active', sales1Id, 'Retail client');

    const insertLead = db.prepare(`
      INSERT INTO leads (name, email, phone, source, status, priority, owner_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertLead.run('TechSolutions Inc', 'lead@techsolutions.com', '9811223344', 'Web Site', 'New', 'High', sales1Id, 'Inquired via landing page');
    insertLead.run('Apex Systems', 'info@apexsystems.io', '9844556677', 'Referral', 'Contacted', 'Medium', sales2Id, 'Met at tech conference');

    const today = new Date().toISOString().split('T')[0];

    const insertOpp = db.prepare(`
      INSERT INTO opportunities (name, customer_id, owner_id, stage, amount, probability, expected_close_date, source, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertOpp.run('Acme ERP Upgrade', c1.lastInsertRowid, sales1Id, 'Proposal', 50000, 75, today, 'Existing Client', 'Cloud migration project');
    insertOpp.run('Global Supply Chain Software', c2.lastInsertRowid, sales2Id, 'Negotiation', 120000, 90, today, 'Partner', 'Custom logistics portal');
    insertOpp.run('Starlight POS System', c3.lastInsertRowid, sales1Id, 'Qualification', 25000, 40, today, 'Web Site', 'POS expansion');

    const insertFollowup = db.prepare(`
      INSERT INTO followups (entity_type, entity_id, followup_date, subject, type, status, notes, assigned_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertFollowup.run('Customer', c1.lastInsertRowid, today, 'Quarterly Review Call', 'Call', 'Planned', 'Discuss Q4 objectives', sales1Id);
    insertFollowup.run('Opportunity', 1, today, 'Proposal Followup Meeting', 'Meeting', 'Planned', 'Review proposal feedback', sales1Id);

    const insertAudit = db.prepare(`
      INSERT INTO audit_logs (user_id, user_email, action, entity_name, record_id, old_value, new_value, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertAudit.run(adminId, 'admin@acxiom.com', 'SYSTEM_INIT', 'System', 0, null, 'Database seeded successfully', '127.0.0.1');
  }
}

function logAudit(req, action, entityName, recordId = null, oldValue = null, newValue = null) {
  try {
    const userId = req && req.session && req.session.user ? req.session.user.id : null;
    const userEmail = req && req.session && req.session.user ? req.session.user.email : (req && req.body && req.body.email ? req.body.email : 'System/Anonymous');
    const ipAddress = req ? (req.ip || (req.socket ? req.socket.remoteAddress : '127.0.0.1')) : '127.0.0.1';

    const oldStr = typeof oldValue === 'object' && oldValue !== null ? JSON.stringify(oldValue) : oldValue;
    const newStr = typeof newValue === 'object' && newValue !== null ? JSON.stringify(newValue) : newValue;

    const stmt = db.prepare(`
      INSERT INTO audit_logs (user_id, user_email, action, entity_name, record_id, old_value, new_value, ip_address, created_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    stmt.run(userId, userEmail, action, entityName, recordId, oldStr, newStr, ipAddress);
  } catch (err) {}
}

initDatabase();

module.exports = { db, logAudit };
