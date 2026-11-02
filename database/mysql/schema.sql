-- ========================================================
-- BizPermit MySQL Relational Schema
-- Engine: InnoDB, Charset: utf8mb4, Collation: utf8mb4_unicode_ci
-- ========================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS issued_licenses;
DROP TABLE IF EXISTS inspections;
DROP TABLE IF EXISTS application_payments;
DROP TABLE IF EXISTS application_status_history;
DROP TABLE IF EXISTS application_assignments;
DROP TABLE IF EXISTS applications;
DROP TABLE IF EXISTS license_requirements;
DROP TABLE IF EXISTS license_type_categories;
DROP TABLE IF EXISTS license_types;
DROP TABLE IF EXISTS staff_departments;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS businesses;
DROP TABLE IF EXISTS business_categories;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- 1. Users
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(191) NOT NULL UNIQUE,
  phone VARCHAR(30) NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email),
  INDEX idx_users_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. User Roles
CREATE TABLE user_roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  role ENUM('BUSINESS_OWNER', 'OFFICER', 'INSPECTOR', 'ADMIN') NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_role (user_id, role),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Business Categories
CREATE TABLE business_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  icon VARCHAR(50) DEFAULT 'storefront',
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bizcat_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Businesses
CREATE TABLE businesses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT NOT NULL,
  category_id INT NOT NULL,
  business_name VARCHAR(200) NOT NULL,
  registration_number VARCHAR(100) UNIQUE NULL,
  address_line1 VARCHAR(255) NOT NULL,
  address_line2 VARCHAR(255) NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  postal_code VARCHAR(20) NOT NULL,
  contact_email VARCHAR(191) NULL,
  contact_phone VARCHAR(30) NULL,
  description TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (category_id) REFERENCES business_categories(id) ON DELETE RESTRICT,
  INDEX idx_biz_owner (owner_id),
  INDEX idx_biz_cat (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Departments
CREATE TABLE departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  contact_email VARCHAR(191) NULL,
  contact_phone VARCHAR(30) NULL,
  office_location VARCHAR(255) NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dept_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Staff Departments
CREATE TABLE staff_departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  department_id INT NOT NULL,
  designation VARCHAR(100) DEFAULT 'Licensing Officer',
  is_head BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_staff_dept (user_id, department_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. License Types
CREATE TABLE license_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  department_id INT NOT NULL,
  fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  validity_months INT NOT NULL DEFAULT 12,
  processing_sla_days INT NOT NULL DEFAULT 14,
  requires_inspection BOOLEAN DEFAULT FALSE,
  description TEXT NULL,
  eligibility_criteria TEXT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  CONSTRAINT chk_fee_positive CHECK (fee >= 0),
  CONSTRAINT chk_validity_positive CHECK (validity_months > 0),
  INDEX idx_lic_dept (department_id),
  INDEX idx_lic_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. License Type Categories (M:N)
CREATE TABLE license_type_categories (
  license_type_id INT NOT NULL,
  category_id INT NOT NULL,
  PRIMARY KEY (license_type_id, category_id),
  FOREIGN KEY (license_type_id) REFERENCES license_types(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES business_categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. License Requirements
CREATE TABLE license_requirements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  license_type_id INT NOT NULL,
  requirement_code VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  document_type VARCHAR(50) NOT NULL,
  is_mandatory BOOLEAN DEFAULT TRUE,
  allowed_extensions VARCHAR(100) DEFAULT 'pdf,jpg,jpeg,png',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (license_type_id) REFERENCES license_types(id) ON DELETE CASCADE,
  INDEX idx_req_lic (license_type_id),
  INDEX idx_req_code (requirement_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Applications
CREATE TABLE applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_number VARCHAR(50) NOT NULL UNIQUE,
  business_id INT NOT NULL,
  license_type_id INT NOT NULL,
  owner_id INT NOT NULL,
  application_type ENUM('NEW', 'RENEWAL') DEFAULT 'NEW',
  parent_license_id INT NULL,
  status ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CORRECTION_REQUIRED', 'INSPECTION_REQUIRED', 'APPROVED', 'REJECTED', 'WITHDRAWN') DEFAULT 'DRAFT',
  submission_date DATETIME NULL,
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  decision_remarks TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE RESTRICT,
  FOREIGN KEY (license_type_id) REFERENCES license_types(id) ON DELETE RESTRICT,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_app_status (status),
  INDEX idx_app_owner (owner_id),
  INDEX idx_app_business (business_id),
  INDEX idx_app_license (license_type_id),
  INDEX idx_app_submission (submission_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Application Assignments
CREATE TABLE application_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  assigned_to INT NOT NULL,
  assigned_by INT NOT NULL,
  role_type ENUM('OFFICER', 'INSPECTOR') DEFAULT 'OFFICER',
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes VARCHAR(255) NULL,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_assign_officer (assigned_to),
  INDEX idx_assign_app (application_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Application Status History
CREATE TABLE application_status_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  from_status VARCHAR(50) NULL,
  to_status VARCHAR(50) NOT NULL,
  changed_by INT NOT NULL,
  remarks TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_hist_app (application_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Application Payments (Simulated)
CREATE TABLE application_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  transaction_reference VARCHAR(100) NOT NULL UNIQUE,
  payment_method VARCHAR(50) DEFAULT 'SIMULATED_TREASURY_TRANSFER',
  payment_status ENUM('PENDING', 'SUCCESSFUL', 'FAILED') DEFAULT 'SUCCESSFUL',
  paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  CONSTRAINT chk_amt_positive CHECK (amount >= 0),
  INDEX idx_pay_app (application_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Inspections
CREATE TABLE inspections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  inspector_id INT NOT NULL,
  scheduled_date DATETIME NOT NULL,
  completed_date DATETIME NULL,
  outcome ENUM('PENDING', 'PASSED', 'FAILED', 'REQUIRES_FOLLOWUP') DEFAULT 'PENDING',
  summary_notes TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  FOREIGN KEY (inspector_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_insp_app (application_id),
  INDEX idx_insp_user (inspector_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Issued Licenses
CREATE TABLE issued_licenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  license_number VARCHAR(50) NOT NULL UNIQUE,
  application_id INT NOT NULL UNIQUE,
  business_id INT NOT NULL,
  license_type_id INT NOT NULL,
  owner_id INT NOT NULL,
  issue_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  status ENUM('ACTIVE', 'EXPIRED', 'SUSPENDED', 'REVOKED') DEFAULT 'ACTIVE',
  qr_verification_code VARCHAR(100) NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE RESTRICT,
  FOREIGN KEY (license_type_id) REFERENCES license_types(id) ON DELETE RESTRICT,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_isslic_owner (owner_id),
  INDEX idx_isslic_status (status),
  INDEX idx_isslic_exp (expiry_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. Notifications
CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  notification_type VARCHAR(50) DEFAULT 'INFO',
  link_url VARCHAR(255) NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notif_user (user_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. Audit Logs
CREATE TABLE audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  details JSON NULL,
  ip_address VARCHAR(50) DEFAULT '127.0.0.1',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_user (user_id),
  INDEX idx_audit_action (action),
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
