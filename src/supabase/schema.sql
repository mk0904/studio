
-- Enable Realtime for relevant tables if you plan to use it
-- (Can be done in Supabase UI under Database > Replication)

-- Custom ENUM Types
CREATE TYPE public.user_role_enum AS ENUM ('BHR', 'ZHR', 'VHR', 'CHR');
CREATE TYPE public.visit_status_enum AS ENUM ('draft', 'submitted', 'approved', 'rejected');
CREATE TYPE public.qualitative_assessment_enum AS ENUM ('yes', 'no');

-- USERS Table
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() REFERENCES auth.users(id) ON DELETE CASCADE, -- Links to Supabase auth.users
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role public.user_role_enum NOT NULL,
  e_code TEXT,
  location TEXT,
  reports_to UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Manager's user ID
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
COMMENT ON COLUMN public.users.id IS 'References auth.users.id from Supabase authentication system.';
COMMENT ON COLUMN public.users.reports_to IS 'User ID of the manager this user reports to.';

-- BRANCHES Table
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  category TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ASSIGNMENTS Table (Many-to-many link between BHRs and Branches)
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bhr_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT unique_bhr_branch_assignment UNIQUE (bhr_id, branch_id)
);
COMMENT ON TABLE public.assignments IS 'Tracks which BHR is assigned to which Branch.';

-- VISITS Table
CREATE TABLE public.visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bhr_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, -- The BHR who made the visit
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  visit_date TIMESTAMPTZ NOT NULL,
  status public.visit_status_enum DEFAULT 'draft' NOT NULL,
  
  -- HR Connect Session Details
  hr_connect_conducted BOOLEAN DEFAULT false,
  hr_connect_employees_invited INTEGER,
  hr_connect_participants INTEGER,

  -- Branch Metrics
  manning_percentage NUMERIC(5,2) CHECK (manning_percentage >= 0 AND manning_percentage <= 100),
  attrition_percentage NUMERIC(5,2) CHECK (attrition_percentage >= 0 AND attrition_percentage <= 100),
  non_vendor_percentage NUMERIC(5,2) CHECK (non_vendor_percentage >= 0 AND non_vendor_percentage <= 100),
  er_percentage NUMERIC(5,2) CHECK (er_percentage >= 0 AND er_percentage <= 100),
  cwt_cases INTEGER CHECK (cwt_cases >= 0),
  performance_level TEXT,

  -- Employee Coverage
  new_employees_total INTEGER CHECK (new_employees_total >= 0),
  new_employees_covered INTEGER CHECK (new_employees_covered >= 0),
  star_employees_total INTEGER CHECK (star_employees_total >= 0),
  star_employees_covered INTEGER CHECK (star_employees_covered >= 0),

  -- Qualitative Assessment
  qual_aligned_conduct public.qualitative_assessment_enum,
  qual_safe_secure public.qualitative_assessment_enum,
  qual_motivated public.qualitative_assessment_enum,
  qual_abusive_language public.qualitative_assessment_enum,
  qual_comfortable_escalate public.qualitative_assessment_enum,
  qual_inclusive_culture public.qualitative_assessment_enum,

  additional_remarks TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Constraints for employee coverage
  CONSTRAINT check_new_employees_coverage CHECK (new_employees_covered IS NULL OR new_employees_total IS NULL OR new_employees_covered <= new_employees_total),
  CONSTRAINT check_star_employees_coverage CHECK (star_employees_covered IS NULL OR star_employees_total IS NULL OR star_employees_covered <= star_employees_total),
  -- Constraint for HR connect participants
  CONSTRAINT check_hr_connect_participants CHECK (hr_connect_participants IS NULL OR hr_connect_employees_invited IS NULL OR hr_connect_participants <= hr_connect_employees_invited),
  CONSTRAINT check_hr_connect_invited_positive_if_participants CHECK (
    NOT (hr_connect_conducted = TRUE AND hr_connect_participants > 0 AND (hr_connect_employees_invited IS NULL OR hr_connect_employees_invited <= 0))
  )
);
COMMENT ON COLUMN public.visits.bhr_id IS 'User ID of the BHR who conducted the visit.';

-- Trigger function to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Assign trigger to tables
CREATE TRIGGER on_users_updated
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER on_branches_updated
  BEFORE UPDATE ON public.branches
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER on_assignments_updated
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER on_visits_updated
  BEFORE UPDATE ON public.visits
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();


-- ROW LEVEL SECURITY (RLS) POLICIES --
-- These are basic policies. Refine them based on your app's specific needs.

-- USERS Table RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to user id, name, role for selection lists"
  ON public.users FOR SELECT
  USING (true); -- Allows anyone to select these fields, useful for 'reports_to' dropdowns.
                 -- Consider restricting columns in your actual SELECT queries if exposing all columns is a concern.

CREATE POLICY "Allow individual user to read their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Allow individual user to update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
  
-- Note: User insertion (signup) is handled by Supabase Auth and a follow-up profile creation.
-- If you need direct inserts into users table by authenticated users for other reasons:
-- CREATE POLICY "Allow authenticated users to insert their own profile"
--   ON public.users FOR INSERT
--   WITH CHECK (auth.uid() = id);


-- BRANCHES Table RLS
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read all branches"
  ON public.branches FOR SELECT
  USING (auth.role() = 'authenticated');

-- For INSERT, UPDATE, DELETE on branches, you'd typically restrict to admin-like roles (e.g., CHR).
-- Example (requires role management beyond basic Supabase auth.role()):
-- CREATE POLICY "Allow CHR to manage branches"
--   ON public.branches FOR ALL
--   USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'CHR')
--   WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) = 'CHR');


-- ASSIGNMENTS Table RLS
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read assignments" -- Needs refinement for hierarchy
  ON public.assignments FOR SELECT
  USING (auth.role() = 'authenticated');

-- Example for ZHRs managing assignments (more complex, requires checking ZHR's BHRs):
-- CREATE POLICY "Allow ZHRs to manage assignments for their BHRs"
--   ON public.assignments FOR ALL
--   USING (
--     EXISTS (
--       SELECT 1 FROM public.users bhr_user
--       WHERE bhr_user.id = public.assignments.bhr_id AND bhr_user.reports_to = auth.uid() AND
--             (SELECT role FROM public.users WHERE id = auth.uid()) = 'ZHR'
--     )
--   );


-- VISITS Table RLS
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow BHR to create their own visits"
  ON public.visits FOR INSERT
  WITH CHECK (auth.uid() = bhr_id AND (SELECT role FROM public.users WHERE id = auth.uid()) = 'BHR');

CREATE POLICY "Allow BHR to read and update their own visits"
  ON public.visits FOR ALL -- SELECT, UPDATE, DELETE
  USING (auth.uid() = bhr_id AND (SELECT role FROM public.users WHERE id = auth.uid()) = 'BHR')
  WITH CHECK (auth.uid() = bhr_id AND (SELECT role FROM public.users WHERE id = auth.uid()) = 'BHR');

-- Example for ZHRs to read visits of BHRs reporting to them (Illustrative - can get complex)
-- This often involves creating SQL functions or views to simplify RLS policy logic.
-- CREATE POLICY "Allow ZHR to read visits of their BHRs"
--   ON public.visits FOR SELECT
--   USING (
--     EXISTS (
--       SELECT 1 FROM public.users bhr_user
--       WHERE bhr_user.id = public.visits.bhr_id AND bhr_user.reports_to = auth.uid() AND
--             (SELECT role FROM public.users WHERE id = auth.uid()) = 'ZHR'
--     )
--   );

-- Broader read access for higher roles (VHR, CHR) would follow similar hierarchical logic.
-- For simplicity in getting started, allow authenticated users to read for now, refine later.
CREATE POLICY "Allow authenticated users to read all visits (to be refined)"
  ON public.visits FOR SELECT
  USING (auth.role() = 'authenticated');


-- Seed Data (Optional: Add some initial data for testing if needed)
-- Example: Create a CHR user first, then VHR reporting to CHR, etc.
-- This should be done AFTER setting up auth and RLS if you want users to own their data.
-- Or, do this with RLS temporarily disabled or as a superuser.

-- INSERT INTO public.users (id, name, email, role) VALUES
-- ('some-uuid-for-chr-auth-user', 'Head Honcho', 'chr@example.com', 'CHR');
--
-- INSERT INTO public.users (id, name, email, role, reports_to) VALUES
-- ('some-uuid-for-vhr-auth-user', 'Vee P. HumanRes', 'vhr@example.com', 'VHR', 'some-uuid-for-chr-auth-user');

-- Remember to replace 'some-uuid-for-...' with actual auth.user IDs if you link them.


-- After running this schema, ensure you have "Enable Realtime" toggled on for the tables
-- in your Supabase Dashboard (Database > Replication) if you intend to use realtime features.
