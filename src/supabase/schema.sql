
-- ENUM Types
CREATE TYPE user_role_enum AS ENUM ('BHR', 'ZHR', 'VHR', 'CHR');
CREATE TYPE visit_status_enum AS ENUM ('draft', 'submitted', 'approved', 'rejected');
CREATE TYPE qualitative_assessment_enum AS ENUM ('yes', 'no');

-- Function to automatically update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- users Table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role user_role_enum NOT NULL,
  e_code TEXT,
  location TEXT,
  reports_to UUID REFERENCES users(id) ON DELETE SET NULL, -- Manager can leave, user remains
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TRIGGER set_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
CREATE INDEX idx_users_reports_to ON users(reports_to);
CREATE INDEX idx_users_role ON users(role);

-- branches Table
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  category TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TRIGGER set_branches_updated_at
BEFORE UPDATE ON branches
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
CREATE INDEX idx_branches_location ON branches(location);
CREATE INDEX idx_branches_category ON branches(category);

-- assignments Table (Many-to-Many between BHRs and Branches)
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bhr_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- If BHR is deleted, assignment is removed
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE, -- If Branch is deleted, assignment is removed
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT unique_bhr_branch_assignment UNIQUE (bhr_id, branch_id)
);
CREATE TRIGGER set_assignments_updated_at
BEFORE UPDATE ON assignments
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
CREATE INDEX idx_assignments_bhr_id ON assignments(bhr_id);
CREATE INDEX idx_assignments_branch_id ON assignments(branch_id);

-- visits Table
CREATE TABLE visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bhr_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT, -- Don't delete BHR if they have visits; handle manually
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT, -- Don't delete Branch if it has visits
  visit_date TIMESTAMPTZ NOT NULL,
  status visit_status_enum DEFAULT 'draft',
  
  -- HR Connect Session Details
  hr_connect_conducted BOOLEAN DEFAULT false,
  hr_connect_employees_invited INTEGER,
  hr_connect_participants INTEGER,

  -- Branch Metrics
  manning_percentage NUMERIC(5,2),
  attrition_percentage NUMERIC(5,2),
  non_vendor_percentage NUMERIC(5,2),
  er_percentage NUMERIC(5,2),
  cwt_cases INTEGER,
  performance_level TEXT,

  -- Employee Coverage
  new_employees_total INTEGER,
  new_employees_covered INTEGER,
  star_employees_total INTEGER,
  star_employees_covered INTEGER,

  -- Qualitative Assessment
  qual_aligned_conduct qualitative_assessment_enum,
  qual_safe_secure qualitative_assessment_enum,
  qual_motivated qualitative_assessment_enum,
  qual_abusive_language qualitative_assessment_enum,
  qual_comfortable_escalate qualitative_assessment_enum,
  qual_inclusive_culture qualitative_assessment_enum,
  
  additional_remarks TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  CONSTRAINT chk_hr_connect_invited CHECK (hr_connect_employees_invited IS NULL OR hr_connect_employees_invited >= 0),
  CONSTRAINT chk_hr_connect_participants CHECK (hr_connect_participants IS NULL OR hr_connect_participants >= 0),
  CONSTRAINT chk_hr_connect_coverage CHECK (hr_connect_participants IS NULL OR hr_connect_employees_invited IS NULL OR hr_connect_participants <= hr_connect_employees_invited),
  CONSTRAINT chk_new_employees_covered CHECK (new_employees_covered IS NULL OR new_employees_total IS NULL OR new_employees_covered <= new_employees_total),
  CONSTRAINT chk_star_employees_covered CHECK (star_employees_covered IS NULL OR star_employees_total IS NULL OR star_employees_covered <= star_employees_total)
);
CREATE TRIGGER set_visits_updated_at
BEFORE UPDATE ON visits
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
CREATE INDEX idx_visits_bhr_id ON visits(bhr_id);
CREATE INDEX idx_visits_branch_id ON visits(branch_id);
CREATE INDEX idx_visits_visit_date ON visits(visit_date);
CREATE INDEX idx_visits_status ON visits(status);

-- Enable Row Level Security (RLS) for all tables if you plan to use it.
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

-- Example: Initial CHR user (replace with your actual CHR details if needed)
-- INSERT INTO users (name, email, role) VALUES ('Default CHR', 'chr@example.com', 'CHR');
-- Remember to handle passwords and actual user creation through Supabase Auth.
-- This schema is for the database structure itself.
