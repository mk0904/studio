
-- Custom ENUM type for user roles
CREATE TYPE user_role_enum AS ENUM ('BHR', 'ZHR', 'VHR', 'CHR');

-- Custom ENUM type for visit statuses
CREATE TYPE visit_status_enum AS ENUM ('draft', 'submitted', 'approved', 'rejected');

-- Custom ENUM type for qualitative assessment answers
CREATE TYPE qualitative_assessment_enum AS ENUM ('yes', 'no');

-- Users Table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role user_role_enum NOT NULL,
  e_code TEXT,
  location TEXT,
  reports_to UUID REFERENCES users(id) ON DELETE SET NULL, -- Link to manager
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
COMMENT ON COLUMN users.reports_to IS 'Stores the ID of the user this user reports to, establishing hierarchy.';

-- Branches Table
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  category TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Assignments Table (Join table for BHRs and Branches)
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bhr_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT unique_bhr_branch_assignment UNIQUE (bhr_id, branch_id)
);
COMMENT ON TABLE assignments IS 'Manages the many-to-many relationship between BHR users and Branches.';

-- Visits Table
CREATE TABLE visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bhr_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  visit_date TIMESTAMPTZ NOT NULL,
  status visit_status_enum DEFAULT 'draft',
  hr_connect_conducted BOOLEAN DEFAULT false,
  manning_percentage NUMERIC(5,2) CHECK (manning_percentage >= 0 AND manning_percentage <= 100),
  attrition_percentage NUMERIC(5,2) CHECK (attrition_percentage >= 0 AND attrition_percentage <= 100),
  non_vendor_percentage NUMERIC(5,2) CHECK (non_vendor_percentage >= 0 AND non_vendor_percentage <= 100),
  er_percentage NUMERIC(5,2) CHECK (er_percentage >= 0 AND er_percentage <= 100),
  cwt_cases INTEGER CHECK (cwt_cases >= 0),
  performance_level TEXT,
  new_employees_total INTEGER CHECK (new_employees_total >= 0),
  new_employees_covered INTEGER CHECK (new_employees_covered >= 0),
  star_employees_total INTEGER CHECK (star_employees_total >= 0),
  star_employees_covered INTEGER CHECK (star_employees_covered >= 0),
  qual_aligned_conduct qualitative_assessment_enum,
  qual_safe_secure qualitative_assessment_enum,
  qual_motivated qualitative_assessment_enum,
  qual_abusive_language qualitative_assessment_enum,
  qual_comfortable_escalate qualitative_assessment_enum,
  qual_inclusive_culture qualitative_assessment_enum,
  additional_remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT check_new_employees_coverage CHECK (new_employees_covered <= new_employees_total),
  CONSTRAINT check_star_employees_coverage CHECK (star_employees_covered <= star_employees_total)
);
COMMENT ON TABLE visits IS 'Logs all details related to branch visits conducted by BHRs.';

-- Optional: Create indexes for frequently queried columns, e.g., foreign keys or status fields
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_reports_to ON users(reports_to);
CREATE INDEX idx_assignments_bhr_id ON assignments(bhr_id);
CREATE INDEX idx_assignments_branch_id ON assignments(branch_id);
CREATE INDEX idx_visits_bhr_id ON visits(bhr_id);
CREATE INDEX idx_visits_branch_id ON visits(branch_id);
CREATE INDEX idx_visits_visit_date ON visits(visit_date);
CREATE INDEX idx_visits_status ON visits(status);

-- Function to automatically update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to all tables
CREATE TRIGGER set_timestamp_users
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_branches
BEFORE UPDATE ON branches
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_assignments
BEFORE UPDATE ON assignments
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_visits
BEFORE UPDATE ON visits
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

