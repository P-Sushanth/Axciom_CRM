# AcxiomCRM

A lightweight, plain, and fully-functional Customer Relationship Management (CRM) application built with Node.js, Express, SQLite (`better-sqlite3`), Vanilla HTML/JavaScript, and Chart.js.

---

## Technical Features & Requirements Covered

- **Secure Authentication & Security**: Session-based login, password hashing using `bcrypt`, account lockout after 5 consecutive failed attempts, and automatic session verification.
- **Role-Based Authorization (RBAC)**:
  - `SalesExecutive`: Access restricted exclusively to assigned sales records (`owner_id`).
  - `Manager`: Access to team pipeline, customer/lead masters, and performance reports.
  - `Admin`: Full access including user administration, role assignment, password resets, and system audit logs.
- **Validation**:
  - **Client-Side Validation**: Instant regex/logic validation blocking invalid input before submission.
  - **Server-Side Validation**: Mandatory server verification returning `HTTP 400 Bad Request` on invalid data.
  - **Business Rules**:
    - Opportunity Amount must be $> 0$.
    - Opportunity Probability must be between $0$ and $100$.
    - Expected Close Date cannot be in the past for active opportunities.
    - Follow-Up Date cannot be earlier than today for new/planned activities.
- **CRM Workflows**: Qualified Lead conversion into Customer records, opportunity pipeline stage tracking, and follow-up scheduling.
- **Audit Logging**: Every create, update, delete, login, and status change generates an audit entry with user details, timestamp, IP address, and payload.
- **Dashboard Analytics**: KPI summary cards and a stage-wise pipeline chart powered by Chart.js.
- **REST API**: Secured JSON endpoints served under `/api/`.

---

## File Structure

The repository follows a flat architecture with zero subdirectories:

```
c:\Users\popur\Documents\Projects\AxcioCRM\
├── server.js            # Express server setup and static file routing
├── database.js          # SQLite schema initialization, seed data & audit logger
├── auth.js              # Authentication endpoints & RBAC middleware
├── customers.js         # Customer REST routes & validations
├── leads.js             # Lead REST routes & conversion logic
├── opportunities.js     # Opportunity REST routes & pipeline rules
├── followups.js         # Follow-Up REST routes & date checks
├── dashboard.js         # KPI and Chart.js analytics API endpoints
├── users.js             # User & role administration endpoints (Admin)
├── audit.js             # System audit log endpoints (Admin)
├── reports.js           # Team pipeline report endpoints (Manager/Admin)
├── app.js               # Frontend shared client script (navbar & sessions)
├── index.html           # Login and Registration interface
├── dashboard.html       # KPI cards and Chart.js pipeline dashboard
├── customers.html       # Customer Management interface
├── leads.html           # Lead Management interface
├── opportunities.html   # Opportunity Management interface
├── followups.html       # Follow-Up Scheduling interface
├── users.html           # User & Role Management interface (Admin)
├── audit.html           # Audit Log Viewer interface (Admin)
└── reports.html         # Pipeline Reports interface (Manager/Admin)
```

---

## Pre-seeded Demo Accounts

The SQLite database initializes automatically with default test credentials:

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@acxiom.com` | `Admin123!` |
| **Manager** | `manager@acxiom.com` | `Manager123!` |
| **Sales Executive 1** | `sales@acxiom.com` | `Sales123!` |
| **Sales Executive 2** | `sales2@acxiom.com` | `Sales123!` |

---

## Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start the Application**:
   ```bash
   node server.js
   ```

3. **Access the CRM**:
   Open your browser and navigate to `http://localhost:3000`.
