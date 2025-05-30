
-- Drop existing objects with CASCADE to avoid dependency errors, in reverse order of creation.
-- Drop Triggers first
DROP TRIGGER IF EXISTS on_visits_updated ON public.visits CASCADE;
DROP TRIGGER IF EXISTS on_assignments_updated ON public.assignments CASCADE;
DROP TRIGGER IF EXISTS on_branches_updated ON public.branches CASCADE;
DROP TRIGGER IF EXISTS on_users_updated ON public.users CASCADE;

-- Drop Functions that triggers depend on
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;

-- Drop Policies (order doesn't strictly matter as much as tables/types for drops, but good practice)
-- Visits Policies
DROP POLICY IF EXISTS "BHRs can insert their own visits" ON public.visits;
DROP POLICY IF EXISTS "BHRs can select their own visits" ON public.visits;
DROP POLICY IF EXISTS "BHRs can update their own draft/submitted visits" ON public.visits;
DROP POLICY IF EXISTS "BHRs can delete their own draft visits" ON public.visits;
DROP POLICY IF EXISTS "ZHRs can select visits of their BHRs" ON public.visits;
DROP POLICY IF EXISTS "ZHRs can update status of submitted visits by their BHRs" ON public.visits;
DROP POLICY IF EXISTS "VHRs can select visits in their vertical" ON public.visits;
DROP POLICY IF EXISTS "VHRs can update status of visits in their vertical" ON public.visits;
DROP POLICY IF EXISTS "CHR can manage all visits" ON public.visits;

-- Assignments Policies
DROP POLICY IF EXISTS "BHRs can view their own assignments" ON public.assignments;
DROP POLICY IF EXISTS "ZHRs can view assignments for their BHRs" ON public.assignments;
DROP POLICY IF EXISTS "VHRs can view assignments in their vertical" ON public.assignments;
DROP POLICY IF EXISTS "CHR can view all assignments" ON public.assignments;
DROP POLICY IF EXISTS "ZHRs can manage assignments for their BHRs" ON public.assignments;
DROP POLICY IF EXISTS "CHR can manage all assignments" ON public.assignments;

-- Branches Policies
DROP POLICY IF EXISTS "Authenticated users can view all branches" ON public.branches;
DROP POLICY IF EXISTS "CHR can manage branches" ON public.branches;

-- Users Policies
DROP POLICY IF EXISTS "Users can view their own user record" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can read basic user info for selection" ON public.users;
DROP POLICY IF EXISTS "CHR can view all user records" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can insert their own user record" ON public.users;
DROP POLICY IF EXISTS "Users can update their own user record" ON public.users;
DROP POLICY IF EXISTS "CHR can update any user record" ON public.users;
DROP POLICY IF EXISTS "CHR can delete any user record" ON public.users;

-- Drop Tables (in reverse order of foreign key dependencies)
DROP TABLE IF EXISTS public.visits CASCADE;
DROP TABLE IF EXISTS public.assignments CASCADE;
DROP TABLE IF EXISTS public.branches CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Drop Types (if they are not used by any remaining tables/columns)
DROP TYPE IF EXISTS public.qualitative_assessment_enum CASCADE;
DROP TYPE IF EXISTS public.visit_status_enum CASCADE;
DROP TYPE IF EXISTS public.user_role_enum CASCADE;

-- Drop Helper Functions if they are specific to this schema and being redefined
DROP FUNCTION IF EXISTS public.get_my_role() CASCADE;


-- Create ENUM types
CREATE TYPE public.user_role_enum AS ENUM ('BHR', 'ZHR', 'VHR', 'CHR');
CREATE TYPE public.visit_status_enum AS ENUM ('draft', 'submitted', 'approved', 'rejected');
CREATE TYPE public.qualitative_assessment_enum AS ENUM ('yes', 'no');

-- Function to handle updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- users Table
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role public.user_role_enum NOT NULL,
  e_code TEXT,
  location TEXT,
  reports_to UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Manager's user ID
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
COMMENT ON COLUMN public.users.reports_to IS 'Manager''s user ID';

CREATE TRIGGER on_users_updated
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- branches Table
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  category TEXT NOT NULL, -- e.g., Metro Tier A, Urban Tier B
  code TEXT UNIQUE NOT NULL, -- e.g., NY001
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TRIGGER on_branches_updated
  BEFORE UPDATE ON public.branches
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- assignments Table (Many-to-Many between BHRs and Branches)
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bhr_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT unique_bhr_branch_assignment UNIQUE (bhr_id, branch_id)
);
COMMENT ON TABLE public.assignments IS 'Assigns BHR users to specific branches.';

CREATE TRIGGER on_assignments_updated
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- visits Table
CREATE TABLE public.visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bhr_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, -- The BHR who made the visit
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  visit_date TIMESTAMPTZ NOT NULL,
  status public.visit_status_enum DEFAULT 'draft' NOT NULL,

  -- HR Connect Session
  hr_connect_conducted BOOLEAN DEFAULT false,
  hr_connect_employees_invited INTEGER CHECK (hr_connect_employees_invited IS NULL OR hr_connect_employees_invited >= 0),
  hr_connect_participants INTEGER CHECK (hr_connect_participants IS NULL OR hr_connect_participants >= 0),

  -- Branch Metrics
  manning_percentage NUMERIC(5,2) CHECK (manning_percentage IS NULL OR (manning_percentage >= 0 AND manning_percentage <= 100)),
  attrition_percentage NUMERIC(5,2) CHECK (attrition_percentage IS NULL OR (attrition_percentage >= 0 AND attrition_percentage <= 100)),
  non_vendor_percentage NUMERIC(5,2) CHECK (non_vendor_percentage IS NULL OR (non_vendor_percentage >= 0 AND non_vendor_percentage <= 100)),
  er_percentage NUMERIC(5,2) CHECK (er_percentage IS NULL OR (er_percentage >= 0 AND er_percentage <= 100)),
  cwt_cases INTEGER CHECK (cwt_cases IS NULL OR cwt_cases >= 0),
  performance_level TEXT, -- e.g., Excellent, Good, Average

  -- Employee Coverage
  new_employees_total INTEGER CHECK (new_employees_total IS NULL OR new_employees_total >= 0),
  new_employees_covered INTEGER CHECK (new_employees_covered IS NULL OR new_employees_covered >= 0),
  star_employees_total INTEGER CHECK (star_employees_total IS NULL OR star_employees_total >= 0),
  star_employees_covered INTEGER CHECK (star_employees_covered IS NULL OR star_employees_covered >= 0),

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

  CONSTRAINT check_hr_connect_participants CHECK (hr_connect_participants IS NULL OR hr_connect_employees_invited IS NULL OR hr_connect_participants <= hr_connect_employees_invited),
  CONSTRAINT check_new_employees_coverage CHECK (new_employees_covered IS NULL OR new_employees_total IS NULL OR new_employees_covered <= new_employees_total),
  CONSTRAINT check_star_employees_coverage CHECK (star_employees_covered IS NULL OR star_employees_total IS NULL OR star_employees_covered <= star_employees_total)
);
COMMENT ON TABLE public.visits IS 'Records details of BHR visits to branches.';
COMMENT ON COLUMN public.visits.bhr_id IS 'The BHR who made the visit';

CREATE TRIGGER on_visits_updated
  BEFORE UPDATE ON public.visits
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Helper function to get the role of the current authenticated user
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role_enum
LANGUAGE plpgsql
SECURITY DEFINER
-- SET search_path = public, extensions; -- More explicit search path
SET search_path = public;
AS $$
BEGIN
  -- Check if auth.uid() is available (user is authenticated)
  IF auth.uid() IS NULL THEN
    RETURN NULL; -- Or handle as an error/specific non-role
  END IF;
  -- Assuming 'users' table is in 'public' schema
  RETURN (SELECT role FROM public.users WHERE id = auth.uid());
END;
$$;

-- Grant execute permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;


---------------------------------
-- ROW LEVEL SECURITY POLICIES --
---------------------------------

-- RLS for 'users' table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

-- SELECT Policies for public.users
CREATE POLICY "Users can view their own user record"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Authenticated users can read basic user info for selection" -- For dropdowns
  ON public.users FOR SELECT
  TO authenticated
  USING (true); -- Allows reading (id, name, role typically). Ensure your SELECT queries are specific.

CREATE POLICY "CHR can view all user records"
  ON public.users FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'CHR');

-- INSERT Policies for public.users
-- IMPORTANT: This policy is often problematic if "Enable email confirmations" is ON in Supabase Auth settings.
-- If it's ON, the user's session might not be fully 'authenticated' for this RLS check immediately after signUp.
-- For development, consider turning OFF "Enable email confirmations" in Supabase Auth settings.
-- For production with email confirmation, profile creation is better handled by a trigger on auth.users or a server-side function.
CREATE POLICY "Authenticated users can insert their own user record"
  ON public.users FOR INSERT
  TO authenticated -- The user performing the insert must have an authenticated session
  WITH CHECK (
    auth.uid() = NEW.id -- The 'id' of the row being inserted must match the authenticated user's ID
  );

-- UPDATE Policies for public.users
CREATE POLICY "Users can update their own non-critical user record details"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = NEW.id AND -- Must be their own record
    -- Prevent users from changing their own email, role, or reports_to directly through a generic update.
    -- These should be handled by specific admin functions or more privileged policies if needed.
    NEW.email IS NOT DISTINCT FROM OLD.email AND
    NEW.role IS NOT DISTINCT FROM OLD.role AND
    NEW.reports_to IS NOT DISTINCT FROM OLD.reports_to
    -- Allow changes to name, e_code, location
  );

CREATE POLICY "CHR can update any user record"
  ON public.users FOR UPDATE
  TO authenticated
  USING (public.get_my_role() = 'CHR')
  WITH CHECK (public.get_my_role() = 'CHR');

-- DELETE Policies for public.users (Use with caution)
CREATE POLICY "CHR can delete any user record"
  ON public.users FOR DELETE
  TO authenticated
  USING (public.get_my_role() = 'CHR');


-- RLS for 'branches' table
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches FORCE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all branches"
  ON public.branches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "CHR can manage branches"
  ON public.branches FOR ALL
  TO authenticated
  USING (public.get_my_role() = 'CHR')
  WITH CHECK (public.get_my_role() = 'CHR');


-- RLS for 'assignments' table
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments FORCE ROW LEVEL SECURITY;

-- SELECT Policies for assignments
CREATE POLICY "BHRs can view their own assignments"
  ON public.assignments FOR SELECT TO authenticated
  USING (public.get_my_role() = 'BHR' AND bhr_id = auth.uid());

CREATE POLICY "ZHRs can view assignments of their BHRs"
  ON public.assignments FOR SELECT TO authenticated
  USING (public.get_my_role() = 'ZHR' AND bhr_id IN (SELECT u.id FROM public.users u WHERE u.reports_to = auth.uid() AND u.role = 'BHR'));

CREATE POLICY "VHRs can view assignments in their vertical"
  ON public.assignments FOR SELECT TO authenticated
  USING (public.get_my_role() = 'VHR' AND bhr_id IN (
    SELECT bhr.id FROM public.users bhr JOIN public.users zhr ON bhr.reports_to = zhr.id
    WHERE zhr.reports_to = auth.uid() AND bhr.role = 'BHR' AND zhr.role = 'ZHR'
  ));

CREATE POLICY "CHR can view all assignments"
  ON public.assignments FOR SELECT TO authenticated
  USING (public.get_my_role() = 'CHR');

-- INSERT/UPDATE/DELETE Policies for assignments
CREATE POLICY "ZHRs can manage assignments for their BHRs"
  ON public.assignments FOR ALL TO authenticated
  USING (public.get_my_role() = 'ZHR' AND bhr_id IN (SELECT u.id FROM public.users u WHERE u.reports_to = auth.uid() AND u.role = 'BHR'))
  WITH CHECK (public.get_my_role() = 'ZHR' AND bhr_id IN (SELECT u.id FROM public.users u WHERE u.reports_to = auth.uid() AND u.role = 'BHR'));

CREATE POLICY "CHR can manage all assignments"
  ON public.assignments FOR ALL TO authenticated
  USING (public.get_my_role() = 'CHR')
  WITH CHECK (public.get_my_role() = 'CHR');


-- RLS for 'visits' table
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits FORCE ROW LEVEL SECURITY;

-- BHR Policies for 'visits' table
CREATE POLICY "BHRs can insert their own visits"
  ON public.visits FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() = 'BHR' AND NEW.bhr_id = auth.uid() AND NEW.status IN ('draft', 'submitted'));

CREATE POLICY "BHRs can select their own visits"
  ON public.visits FOR SELECT TO authenticated
  USING (public.get_my_role() = 'BHR' AND bhr_id = auth.uid());

CREATE POLICY "BHRs can update their own draft/submitted visits"
  ON public.visits FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'BHR' AND bhr_id = auth.uid() AND OLD.status IN ('draft', 'submitted'))
  WITH CHECK (
    public.get_my_role() = 'BHR' AND
    NEW.bhr_id = auth.uid() AND
    NEW.branch_id IS NOT DISTINCT FROM OLD.branch_id AND
    ((OLD.status = 'draft' AND NEW.status IN ('draft', 'submitted')) OR (OLD.status = 'submitted' AND NEW.status = 'submitted')) AND
    NOT (NEW.status IN ('approved', 'rejected'))
  );

CREATE POLICY "BHRs can delete their own draft visits"
  ON public.visits FOR DELETE TO authenticated
  USING (public.get_my_role() = 'BHR' AND bhr_id = auth.uid() AND status = 'draft');

-- ZHR Policies for 'visits' table
CREATE POLICY "ZHRs can select visits of their BHRs"
  ON public.visits FOR SELECT TO authenticated
  USING (public.get_my_role() = 'ZHR' AND bhr_id IN (SELECT u.id FROM public.users u WHERE u.reports_to = auth.uid() AND u.role = 'BHR'));

CREATE POLICY "ZHRs can update status of submitted visits by their BHRs"
  ON public.visits FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'ZHR' AND bhr_id IN (SELECT u.id FROM public.users u WHERE u.reports_to = auth.uid() AND u.role = 'BHR') AND OLD.status = 'submitted')
  WITH CHECK (
    public.get_my_role() = 'ZHR' AND
    NEW.status IN ('approved', 'rejected') AND
    OLD.status = 'submitted' AND
    NEW.bhr_id IS NOT DISTINCT FROM OLD.bhr_id AND
    NEW.branch_id IS NOT DISTINCT FROM OLD.branch_id AND
    NEW.visit_date IS NOT DISTINCT FROM OLD.visit_date
  );

-- VHR Policies for 'visits' table
CREATE POLICY "VHRs can select visits in their vertical"
  ON public.visits FOR SELECT TO authenticated
  USING (public.get_my_role() = 'VHR' AND bhr_id IN (
    SELECT bhr.id FROM public.users bhr JOIN public.users zhr ON bhr.reports_to = zhr.id
    WHERE zhr.reports_to = auth.uid() AND bhr.role = 'BHR' AND zhr.role = 'ZHR'
  ));

CREATE POLICY "VHRs can update status of visits in their vertical"
  ON public.visits FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'VHR' AND bhr_id IN (
    SELECT bhr.id FROM public.users bhr JOIN public.users zhr ON bhr.reports_to = zhr.id
    WHERE zhr.reports_to = auth.uid() AND bhr.role = 'BHR' AND zhr.role = 'ZHR'
  ) AND OLD.status IN ('submitted', 'approved'))
  WITH CHECK (
    public.get_my_role() = 'VHR' AND
    NEW.status IN ('approved', 'rejected') AND
    OLD.status IN ('submitted', 'approved') AND
    NEW.bhr_id IS NOT DISTINCT FROM OLD.bhr_id AND
    NEW.branch_id IS NOT DISTINCT FROM OLD.branch_id
  );

-- CHR Policy for 'visits' table
CREATE POLICY "CHR can manage all visits"
  ON public.visits FOR ALL TO authenticated
  USING (public.get_my_role() = 'CHR')
  WITH CHECK (public.get_my_role() = 'CHR');

-- Grant basic usage on schema to authenticated and service_role
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Grant all privileges for tables to service_role (for admin tasks, migrations, server-side functions)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Grant SELECT, INSERT, UPDATE, DELETE to authenticated role - RLS policies will then restrict actual access
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;


ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;

