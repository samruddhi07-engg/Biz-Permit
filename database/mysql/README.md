# BizPermit — MySQL Database Architecture & Documentation

## 1. Overview
MySQL 8+ (InnoDB) serves as the primary relational database and definitive source of truth for **BizPermit: Smart Business License Management System**. It manages accounts, role-based access control, departmental hierarchies, license catalog master data, applications, workflow transitions, payment receipts, physical inspection scheduling, issued licenses, and tamper-resistant audit logs.

## 2. Table Catalog (17 Normalized Tables)
- **Identity & Accounts:** `users`, `user_roles`
- **Commercial Entities:** `business_categories`, `businesses`
- **Governance:** `departments`, `staff_departments`
- **Licensing Catalog:** `license_types`, `license_type_categories` (M:N junction), `license_requirements`
- **Application Workflow:** `applications`, `application_assignments`, `application_status_history`
- **Financial Audit:** `application_payments`
- **Physical Compliance:** `inspections`
- **Permit Registry:** `issued_licenses`
- **System Services:** `notifications`, `audit_logs`

## 3. Strict Relational Integrity & Constraints
- **Foreign Keys:** Enforced across all referencing entities with strict cascading or restriction rules.
- **Transactions:** Coordinated ACID transactions manage multi-step operations (e.g. application review approval, license number assignment, notification creation, and audit logging occur atomically).
- **Domain Constraints:** `CHECK (fee >= 0)`, `CHECK (validity_months > 0)`, `CHECK (amount >= 0)`.
- **Application Workflow Status Enum:** `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `CORRECTION_REQUIRED`, `INSPECTION_REQUIRED`, `APPROVED`, `REJECTED`, `WITHDRAWN`.
- **Unique Unforgeable Identifiers:**
  - `application_number` (e.g. `APP-2026-0001`)
  - `license_number` (e.g. `LIC-2026-8841`)
  - `transaction_reference` (e.g. `TXN-MUNI-2026-9001`)
  - `qr_verification_code` (e.g. `QR-VERIFY-8841-2026-MUNI`)

## 4. Execution Commands
To re-run the schema and seeds locally:
```bash
mysql -u root -p bizpermit_db < database/mysql/schema.sql
mysql -u root -p bizpermit_db < database/mysql/indexes.sql
mysql -u root -p bizpermit_db < database/mysql/seed.sql
```
