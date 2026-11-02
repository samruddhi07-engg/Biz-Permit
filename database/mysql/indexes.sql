-- ========================================================
-- BizPermit MySQL Additional Optimized Query Indexes
-- ========================================================

-- Composite index for fast application status filtering by owner
CREATE INDEX idx_apps_owner_status ON applications(owner_id, status);

-- Composite index for department license catalog queries
CREATE INDEX idx_lic_dept_active ON license_types(department_id, is_active);

-- Index for searching business name by owner
CREATE INDEX idx_biz_owner_name ON businesses(owner_id, business_name);

-- Index for expiring licenses search
CREATE INDEX idx_issued_exp_status ON issued_licenses(status, expiry_date);

-- Index for staff pending assignments
CREATE INDEX idx_assign_staff_role ON application_assignments(assigned_to, role_type);
