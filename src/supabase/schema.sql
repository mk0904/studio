
-- Custom ENUM types
DROP TYPE IF EXISTS public.user_role_enum CASCADE;
CREATE TYPE public.user_role_enum AS ENUM ('BHR', 'ZHR', 'VHR', 'CHR');

DROP TYPE IF EXISTS public.visit_status_enum CASCADE;
CREATE TYPE public.visit_status_enum AS ENUM ('draft', 'submitted'); -- Simplified

DROP TYPE IF EXISTS public.qualitative_assessment_enum CASCADE;
CREATE TYPE public.qualitative_assessment_enum AS ENUM ('yes', 'no');

-- Trigger function to auto-update 'updated_at' timestamps
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- users Table
DROP TABLE IF EXISTS public.users CASCADE;
CREATE TABLE public.users (
  id UUID NOT NULL PRIMARY KEY, -- Corresponds to auth.users.id
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role public.user_role_enum NOT NULL,
  e_code TEXT,
  location TEXT,
  reports_to UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Manager's user ID
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER on_users_updated
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- branches Table
DROP TABLE IF EXISTS public.branches CASCADE;
CREATE TABLE public.branches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  category TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER on_branches_updated
  BEFORE UPDATE ON public.branches
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- assignments Table (Join table for BHRs and Branches)
DROP TABLE IF EXISTS public.assignments CASCADE;
CREATE TABLE public.assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bhr_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bhr_id, branch_id) -- Prevent duplicate assignments
);
CREATE TRIGGER on_assignments_updated
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- visits Table
DROP TABLE IF EXISTS public.visits CASCADE;
CREATE TABLE public.visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bhr_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  -- bhr_name TEXT, -- Removed
  -- branch_name TEXT, -- Removed
  visit_date TIMESTAMPTZ NOT NULL,
  status public.visit_status_enum DEFAULT 'draft',
  hr_connect_conducted BOOLEAN DEFAULT false,
  hr_connect_employees_invited INTEGER CHECK (hr_connect_employees_invited >= 0 OR hr_connect_employees_invited IS NULL),
  hr_connect_participants INTEGER CHECK (hr_connect_participants >= 0 OR hr_connect_participants IS NULL),
  manning_percentage NUMERIC(5,2) CHECK (manning_percentage >= 0 AND manning_percentage <= 100 OR manning_percentage IS NULL),
  attrition_percentage NUMERIC(5,2) CHECK (attrition_percentage >= 0 AND attrition_percentage <= 100 OR attrition_percentage IS NULL),
  non_vendor_percentage NUMERIC(5,2) CHECK (non_vendor_percentage >= 0 AND non_vendor_percentage <= 100 OR non_vendor_percentage IS NULL),
  er_percentage NUMERIC(5,2) CHECK (er_percentage >= 0 AND er_percentage <= 100 OR er_percentage IS NULL),
  cwt_cases INTEGER CHECK (cwt_cases >= 0 OR cwt_cases IS NULL),
  performance_level TEXT,
  new_employees_total INTEGER CHECK (new_employees_total >= 0 OR new_employees_total IS NULL),
  new_employees_covered INTEGER CHECK (new_employees_covered >= 0 OR new_employees_covered IS NULL),
  star_employees_total INTEGER CHECK (star_employees_total >= 0 OR star_employees_total IS NULL),
  star_employees_covered INTEGER CHECK (star_employees_covered >= 0 OR star_employees_covered IS NULL),
  qual_aligned_conduct public.qualitative_assessment_enum,
  qual_safe_secure public.qualitative_assessment_enum,
  qual_motivated public.qualitative_assessment_enum,
  qual_abusive_language public.qualitative_assessment_enum,
  qual_comfortable_escalate public.qualitative_assessment_enum,
  qual_inclusive_culture public.qualitative_assessment_enum,
  additional_remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_participants_not_greater_than_invited CHECK (hr_connect_participants IS NULL OR hr_connect_employees_invited IS NULL OR hr_connect_participants <= hr_connect_employees_invited),
  CONSTRAINT chk_new_covered_not_greater_than_total CHECK (new_employees_covered IS NULL OR new_employees_total IS NULL OR new_employees_covered <= new_employees_total),
  CONSTRAINT chk_star_covered_not_greater_than_total CHECK (star_employees_covered IS NULL OR star_employees_total IS NULL OR star_employees_covered <= star_employees_total),
  CONSTRAINT chk_invited_positive_if_participants CHECK (NOT (hr_connect_participants > 0 AND (hr_connect_employees_invited IS NULL OR hr_connect_employees_invited = 0)))
);
CREATE TRIGGER on_visits_updated
  BEFORE UPDATE ON public.visits
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Remove ALTER TABLE commands for bhr_name and branch_name as they are removed from create table
-- ALTER TABLE public.visits
-- ADD COLUMN IF NOT EXISTS bhr_name TEXT,
-- ADD COLUMN IF NOT EXISTS branch_name TEXT;

--------------------------------------------------------------------------------
-- Row Level Security (RLS) Policies
--------------------------------------------------------------------------------

-- Helper function to get the role of the current authenticated user
DROP FUNCTION IF EXISTS public.get_my_role() CASCADE;
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role_enum
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public -- Ensures it uses the public schema
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL; -- Or handle as an error/default role if preferred
  ELSE
    -- This assumes there's a 'role' column in your 'users' table
    RETURN (SELECT role FROM users WHERE id = auth.uid());
  END IF;
END;
$$;
-- Grant execute permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;


-- RLS for 'users' table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own user record" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can read basic user info for selection" ON public.users;
DROP POLICY IF EXISTS "CHR can view all user records" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can insert their own user record" ON public.users; -- Important for Supabase Auth + Profile setup
DROP POLICY IF EXISTS "Users can update their own user record" ON public.users;
DROP POLICY IF EXISTS "CHR can update any user record" ON public.users;
DROP POLICY IF EXISTS "CHR can delete any user record" ON public.users;

-- For Supabase Auth, users need to be able to insert their own profile after signup.
-- This policy uses auth.uid() which is the ID from the auth.users table.
-- Ensure "Enable email confirmations" is OFF in Supabase Auth settings for easier dev,
-- OR use a trigger/server-side function to create profiles if email confirmation is ON.
CREATE POLICY "Authenticated users can insert their own user record"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = NEW.id); -- NEW.id here refers to the id being inserted into public.users

CREATE POLICY "Users can view their own user record"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Authenticated users can read basic user info for selection" -- For dropdowns
  ON public.users FOR SELECT
  TO authenticated
  USING (true); -- Allows reading specific columns. Application should limit columns selected.

CREATE POLICY "CHR can view all user records"
  ON public.users FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'CHR');

CREATE POLICY "Users can update their own user record"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    NEW.email IS NOT DISTINCT FROM OLD.email AND -- Prevent users from changing critical fields
    NEW.role IS NOT DISTINCT FROM OLD.role AND
    NEW.reports_to IS NOT DISTINCT FROM OLD.reports_to
  );

CREATE POLICY "CHR can update any user record"
  ON public.users FOR UPDATE
  TO authenticated
  USING (public.get_my_role() = 'CHR')
  WITH CHECK (public.get_my_role() = 'CHR');

CREATE POLICY "CHR can delete any user record"
  ON public.users FOR DELETE
  TO authenticated
  USING (public.get_my_role() = 'CHR');


-- RLS for 'branches' table
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view all branches" ON public.branches;
DROP POLICY IF EXISTS "CHR can manage branches" ON public.branches;

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

DROP POLICY IF EXISTS "BHRs can view their own assignments" ON public.assignments;
DROP POLICY IF EXISTS "ZHRs can view assignments for their BHRs" ON public.assignments;
DROP POLICY IF EXISTS "VHRs can view assignments in their vertical" ON public.assignments;
DROP POLICY IF EXISTS "CHR can view all assignments" ON public.assignments;
DROP POLICY IF EXISTS "ZHRs can manage assignments for their BHRs" ON public.assignments;
DROP POLICY IF EXISTS "CHR can manage all assignments" ON public.assignments;

CREATE POLICY "BHRs can view their own assignments"
  ON public.assignments FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'BHR' AND bhr_id = auth.uid());

CREATE POLICY "ZHRs can view assignments for their BHRs"
  ON public.assignments FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'ZHR' AND
    bhr_id IN (SELECT id FROM public.users WHERE reports_to = auth.uid() AND role = 'BHR')
  );

CREATE POLICY "VHRs can view assignments in their vertical"
  ON public.assignments FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'VHR' AND
    bhr_id IN (
      SELECT bhr.id FROM public.users bhr
      JOIN public.users zhr ON bhr.reports_to = zhr.id
      WHERE zhr.reports_to = auth.uid() AND bhr.role = 'BHR' AND zhr.role = 'ZHR'
    )
  );

CREATE POLICY "CHR can view all assignments"
  ON public.assignments FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'CHR');

CREATE POLICY "ZHRs can manage assignments for their BHRs"
  ON public.assignments FOR ALL
  TO authenticated
  USING (
    public.get_my_role() = 'ZHR' AND
    bhr_id IN (SELECT id FROM public.users WHERE reports_to = auth.uid() AND role = 'BHR')
  )
  WITH CHECK (
    public.get_my_role() = 'ZHR' AND
    bhr_id IN (SELECT id FROM public.users WHERE reports_to = auth.uid() AND role = 'BHR')
  );

CREATE POLICY "CHR can manage all assignments"
  ON public.assignments FOR ALL
  TO authenticated
  USING (public.get_my_role() = 'CHR')
  WITH CHECK (public.get_my_role() = 'CHR');


-- RLS for 'visits' table
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "BHRs can insert their own visits" ON public.visits;
DROP POLICY IF EXISTS "BHRs can select their own visits" ON public.visits;
DROP POLICY IF EXISTS "BHRs can update their own draft/submitted visits" ON public.visits;
DROP POLICY IF EXISTS "BHRs can delete their draft visits" ON public.visits;

DROP POLICY IF EXISTS "ZHRs can select visits of their BHRs" ON public.visits;
DROP POLICY IF EXISTS "ZHRs can update status of submitted visits by their BHRs" ON public.visits;

DROP POLICY IF EXISTS "VHRs can select visits in their vertical" ON public.visits;
DROP POLICY IF EXISTS "VHRs can update status of visits in their vertical" ON public.visits;

DROP POLICY IF EXISTS "CHR can manage all visits" ON public.visits;


-- BHR Policies for 'visits' table
CREATE POLICY "BHRs can insert their own visits"
  ON public.visits FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_role() = 'BHR' AND NEW.bhr_id = auth.uid() AND NEW.status IN ('draft', 'submitted'));

CREATE POLICY "BHRs can select their own visits"
  ON public.visits FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'BHR' AND bhr_id = auth.uid());

CREATE POLICY "BHRs can update their own draft/submitted visits"
  ON public.visits FOR UPDATE
  TO authenticated
  USING (
    public.get_my_role() = 'BHR' AND
    bhr_id = auth.uid() AND
    OLD.status IN ('draft', 'submitted')
  )
  WITH CHECK (
    public.get_my_role() = 'BHR' AND
    NEW.bhr_id = auth.uid() AND
    NEW.branch_id IS NOT DISTINCT FROM OLD.branch_id AND
    (
      (OLD.status = 'draft' AND NEW.status IN ('draft', 'submitted')) OR
      (OLD.status = 'submitted' AND NEW.status = 'submitted')
    ) AND
    NOT (NEW.status IN ('approved', 'rejected')) -- 'approved', 'rejected' not valid statuses anymore
  );

CREATE POLICY "BHRs can delete their draft visits"
  ON public.visits FOR DELETE
  TO authenticated
  USING (
    public.get_my_role() = 'BHR' AND
    bhr_id = auth.uid() AND
    status = 'draft'
  );


-- ZHR Policies for 'visits' table
CREATE POLICY "ZHRs can select visits of their BHRs"
  ON public.visits FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'ZHR' AND
    bhr_id IN (SELECT id FROM public.users WHERE reports_to = auth.uid() AND role = 'BHR')
  );

-- ZHRs no longer update status, so their UPDATE policy for visits can be removed or simplified to read-only if needed.
-- For now, removing direct ZHR update policy on visits as status flow is simplified. They can only SELECT.
-- If ZHRs need to "comment" or add notes, that would be a different mechanism/table or a field on the visit they can update.


-- VHR Policies for 'visits' table
CREATE POLICY "VHRs can select visits in their vertical"
  ON public.visits FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'VHR' AND
    bhr_id IN (
      SELECT bhr.id FROM public.users bhr
      JOIN public.users zhr ON bhr.reports_to = zhr.id
      WHERE zhr.reports_to = auth.uid() AND bhr.role = 'BHR' AND zhr.role = 'ZHR'
    )
  );

-- VHRs no longer update status directly based on 'draft'/'submitted' only model. They can only SELECT.


-- CHR Policy for 'visits' table
CREATE POLICY "CHR can manage all visits"
  ON public.visits FOR ALL
  TO authenticated
  USING (public.get_my_role() = 'CHR')
  WITH CHECK (public.get_my_role() = 'CHR');

-- Grant basic privileges - RLS will refine these
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;


--------------------------------------------------------------------------------
-- Seed Data (Example)
--------------------------------------------------------------------------------
-- Branches Seed Data
INSERT INTO public.branches (name, location, category, code) VALUES
('North Star Branch', 'New York', 'Metro Tier A', 'NY001'),
('Southern Cross Branch', 'Los Angeles', 'Metro Tier A', 'LA001'),
('East Gate Branch', 'Chicago', 'Metro Tier B', 'CH001'),
('West End Branch', 'Houston', 'Urban Tier A', 'HO001'),
('Central Hub', 'Phoenix', 'Urban Tier B', 'PH001'),
('Metro Point', 'Philadelphia', 'Metro Tier B', 'PL001')
ON CONFLICT (code) DO NOTHING; -- Avoid errors if run multiple times
