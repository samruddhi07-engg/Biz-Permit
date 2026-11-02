# BizPermit — Smart Business License Management System

> **DBMS Academic Capstone Project**  
> An enterprise-grade, full-stack municipal licensing platform demonstrating the real-world integration of **four heterogeneous database paradigms**: **MySQL** (Relational), **MongoDB** (Document), **Neo4j** (Graph), and **Redis** (In-Memory Key-Value).

---

## 1. System Overview & 4-Way Database Integration

Modern public-sector governance cannot fit cleanly into a single relational database. BizPermit implements a **Polyglot Persistence Architecture** where each database handles the workload best suited to its structural strengths:

| Database Engine | Paradigm | Role in BizPermit | Academic Justification |
|---|---|---|---|
| **MySQL 8.0** | Relational / ACID RDBMS | Users, Credentials, Businesses, Application State Machine, Payments, Issued Licenses, Immutable Audit Logs | Guarantees strict transactional integrity, referential foreign keys, and ACID compliance across municipal permit transitions. |
| **MongoDB 7.0** | Document Store (JSON/BSON) | `application_form_responses` (Dynamic sector forms), `inspection_reports` (Itemized field audit checklists & photo evidence metadata) | Enables heterogeneous, schema-free permit requirements (e.g., cold storage thermal limits vs. software export IP declarations) without sparse SQL tables. |
| **Neo4j 5.20** | Graph Database | License Prerequisite trees (`DEPENDS_ON`), Sector Discovery (`MAY_REQUIRE`), Departmental Routing (`HANDLED_BY`) | Eliminates recursive SQL CTEs; allows real-time traversal and Cytoscape.js interactive visualization of municipal regulatory topologies. |
| **Redis 7.2** | In-Memory Key-Value | License Catalog cache (`catalog:all`), Dashboard real-time metrics, Session token verification | Delivers sub-millisecond read latency for public catalog discovery and reduces heavy analytical GROUP-BY load on MySQL. |

---

## 2. Technology Stack

- **Frontend:** Pure Vanilla HTML5, Vanilla CSS3 (Custom Design Tokens, Precision Minimalism), Vanilla JavaScript (ES6+ Native Fetch). **No React, Vue, or Tailwind.**
- **Visualization Libraries:** Cytoscape.js (Graph topology), Chart.js (Analytical reporting), QRCode.js (Digital license verification).
- **Backend:** Node.js (v18+) with Express.js REST API.
- **Database Drivers:** `mysql2/promise`, `mongoose` (MongoDB), `neo4j-driver`, `redis` (Node Redis client).
- **Authentication & Security:** bcryptjs password hashing, JWT / Cookie session verification, RBAC role-level authorization guards.

---

## 3. Demo Credentials

The platform is pre-seeded with four role accounts for demonstration:

| Role | Email | Password | Access Scope |
|---|---|---|---|
| **Business Owner** | `owner@bizpermit.demo` | `Owner@1234` | Register enterprises, browse prerequisites, submit applications, upload documents, pay fees, view issued certificates. |
| **Licensing Officer** | `officer@bizpermit.demo` | `Officer@1234` | Review assigned dossiers, inspect submitted evidence, request corrections, record approve/reject decisions. |
| **Field Inspector** | `inspector@bizpermit.demo` | `Inspector@1234` | Conduct on-site audits, execute safety checklists in MongoDB, attach photo evidence notes, pass/fail premises. |
| **System Administrator**| `admin@bizpermit.demo` | `Admin@1234` | System dashboard, user management, municipal departments, staff onboarding, license graph explorer, audit logs. |

---

## 4. Quickstart & Installation

### Prerequisites
1. **Node.js** v18+ and **npm**
2. **MySQL 8.0** running on `localhost:3306`
3. **MongoDB 7.0** running on `localhost:27018` (e.g., via Docker container `civicconnect-mongo`)
4. **Neo4j 5.20** running on `localhost:7687` (e.g., via Docker container `civicconnect-neo4j`)
5. **Redis** running on `localhost:6379` (e.g., Memurai service or Docker container)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment Variables
Verify `.env` at project root:
```env
PORT=5000
NODE_ENV=development

# MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=bizpermit_db

# MongoDB
MONGO_URI=mongodb://localhost:27018/bizpermit_db

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password

# Redis
REDIS_URL=redis://127.0.0.1:6379

JWT_SECRET=bizpermit_super_secure_jwt_secret_2026
```

### Step 3: Run Database Migrations & Seeds
```bash
node backend/src/scripts/seed.js
```

### Step 4: Start Server
```bash
node backend/src/server.js
```
The application will launch on **`http://localhost:5000`**.  
Check multi-database connectivity at: **`http://localhost:5000/api/health`**

---

## 5. Complete 40-Page Directory Map

### Public Portal (Pages 1–9)
- `frontend/index.html` — Landing page with municipal overview & multi-DB showcase
- `frontend/licenses.html` — Searchable catalog of all license types
- `frontend/license-details.html` — Detailed specifications, fee, SLA, and requirements
- `frontend/how-it-works.html` — Step-by-step visual workflow guide
- `frontend/standards.html` — Compliance guidelines & documentation standards
- `frontend/help.html` — FAQs, support ticketing, municipal contacts
- `frontend/login.html` — Authentication entry with demo credentials quick-fill
- `frontend/register.html` — Business owner registration
- `frontend/forgot-password.html` — Self-service password recovery flow

### Business Owner Portal (Pages 10–23)
- `frontend/owner/dashboard.html` — Overview of active enterprises, applications, and permits
- `frontend/owner/businesses.html` — Registered business entities directory
- `frontend/owner/business-form.html` — Register or edit a commercial establishment
- `frontend/owner/find-license.html` — Neo4j-powered license dependency finder
- `frontend/owner/apply.html` — Multi-step dynamic license application wizard
- `frontend/owner/applications.html` — Application history & status tracker
- `frontend/owner/application-details.html` — Real-time dossier viewer with timeline
- `frontend/owner/documents.html` — Compliance document repository
- `frontend/owner/payments.html` — Fee payments & transaction receipts
- `frontend/owner/licenses.html` — Active & issued commercial permits
- `frontend/owner/license-certificate.html` — Official printable certificate with QR verification
- `frontend/owner/renew.html` — License renewal & fee submission
- `frontend/owner/notifications.html` — System alerts & status notifications
- `frontend/owner/profile.html` — Account profile & security credentials

### Staff & Adjudication Workbench (Pages 24–29)
- `frontend/staff/dashboard.html` — Review officer & inspector workload overview
- `frontend/staff/assigned.html` — Officer queue of applications assigned for review
- `frontend/staff/review.html` — Full dossier review & adjudication workbench
- `frontend/staff/inspections.html` — Field inspection scheduling & management
- `frontend/staff/inspection-details.html` — Interactive field audit checklist & evidence logger
- `frontend/staff/history.html` — Completed reviews & audit archive

### Administration & Governance (Pages 30–40)
- `frontend/admin/dashboard.html` — Executive dashboard with Chart.js analytics
- `frontend/admin/users.html` — User accounts & role management
- `frontend/admin/departments.html` — Municipal departments & jurisdiction configuration
- `frontend/admin/staff.html` — Staff onboarding & department assignment
- `frontend/admin/license-types.html` — License catalog CRUD with Neo4j sync & Redis eviction
- `frontend/admin/requirements.html` — Statutory document requirement rules
- `frontend/admin/license-graph.html` — Interactive Cytoscape.js Neo4j network visualizer
- `frontend/admin/applications.html` — Master application registry & officer reassignment
- `frontend/admin/inspections.html` — System-wide field inspection oversight
- `frontend/admin/reports.html` — Business intelligence & SLA compliance reports
- `frontend/admin/audit-logs.html` — Immutable security event ledger

---

## 6. Primary REST API Endpoints

- `GET /api/health` — Returns status of all 4 databases (MySQL, MongoDB, Neo4j, Redis)
- `POST /api/auth/login` — Authenticate and receive session token
- `GET /api/license-types` — Fetch cached license catalog (Redis -> MySQL fallback)
- `GET /api/license-types/meta/graph` — Retrieve Neo4j graph nodes and edges for Cytoscape
- `GET /api/applications` — Role-scoped application lists
- `POST /api/applications` — Create application (MySQL draft + MongoDB form response)
- `POST /api/applications/:id/decision` — Officer approval/rejection decision
- `GET /api/inspections/:id` — Fetch inspection record (MySQL) + checklist (MongoDB)
- `GET /api/admin/reports` — Aggregated analytical intelligence metrics
- `GET /api/admin/audit-logs` — Query immutable compliance audit trail

---

## 7. Verification & DBMS Viva Evaluation

To demonstrate multi-model database operations to examiners:
1. **Redis Demonstration:** Open `http://localhost:5000/licenses.html`. Note the first load says `MySQL Live`. Refresh the page; it will instantly say `Redis Cached`.
2. **Neo4j Demonstration:** Open `http://localhost:5000/admin/license-graph.html`. Explore the live network topology with interactive node inspection and force-directed graph simulation.
3. **MongoDB Demonstration:** Open an inspection at `http://localhost:5000/staff/inspection-details.html?id=1`. The itemized checklist and photo evidence metadata are read and written directly to MongoDB `inspection_reports`.
4. **MySQL Demonstration:** Inspect `http://localhost:5000/admin/audit-logs.html` to see relational append-only ACID transactions logging every single state transition in real time.
