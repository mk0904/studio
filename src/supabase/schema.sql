
-- Enable HTTP extension if not already enabled (useful for some Supabase features)
-- CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
-- Enable pg_graphql extension if you plan to use Supabase GraphQL features
-- CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA extensions;

-- Drop existing types and tables if they exist, in reverse order of dependency
DROP TABLE IF EXISTS public.visits CASCADE;
DROP TABLE IF EXISTS public.assignments CASCADE;
DROP TABLE IF EXISTS public.branches CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

DROP TYPE IF EXISTS public.user_role_enum CASCADE;
DROP TYPE IF EXISTS public.visit_status_enum CASCADE;
DROP TYPE IF EXISTS public.qualitative_assessment_enum CASCADE;

-- Create ENUM types
CREATE TYPE public.user_role_enum AS ENUM ('BHR', 'ZHR', 'VHR', 'CHR');
CREATE TYPE public.visit_status_enum AS ENUM ('draft', 'submitted', 'approved', 'rejected');
CREATE TYPE public.qualitative_assessment_enum AS ENUM ('yes', 'no');

-- Create a trigger function to automatically update `updated_at` columns
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- users Table
CREATE TABLE public.users (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role public.user_role_enum NOT NULL,
  e_code TEXT,
  location TEXT,
  reports_to uuid REFERENCES public.users(id) ON DELETE SET NULL, -- Allow manager to be deleted without deleting subordinates
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT user_id_matches_auth_uid CHECK (id = auth.uid()) -- Ensures the user record id matches the authenticated user's id from auth.users
);
COMMENT ON CONSTRAINT user_id_matches_auth_uid ON public.users IS 'Ensures that the user record id matches the authenticated user''s id from auth.users. This is crucial for RLS policies relying on auth.uid().';

CREATE TRIGGER on_users_updated
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- branches Table
CREATE TABLE public.branches (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  category TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TRIGGER on_branches_updated
  BEFORE UPDATE ON public.branches
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- assignments Table (Join table for BHRs and Branches)
CREATE TABLE public.assignments (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  bhr_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT unique_bhr_branch_assignment UNIQUE (bhr_id, branch_id)
);

CREATE TRIGGER on_assignments_updated
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- visits Table
CREATE TABLE public.visits (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  bhr_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, -- If BHR is deleted, their visits are deleted
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE, -- If Branch is deleted, visits to it are deleted
  visit_date TIMESTAMPTZ NOT NULL,
  status public.visit_status_enum DEFAULT 'draft',

  hr_connect_conducted BOOLEAN DEFAULT false,
  hr_connect_employees_invited INTEGER,
  hr_connect_participants INTEGER,

  manning_percentage NUMERIC(5,2),
  attrition_percentage NUMERIC(5,2),
  non_vendor_percentage NUMERIC(5,2),
  er_percentage NUMERIC(5,2),
  cwt_cases INTEGER,
  performance_level TEXT,

  new_employees_total INTEGER,
  new_employees_covered INTEGER,
  star_employees_total INTEGER,
  star_employees_covered INTEGER,

  qual_aligned_conduct public.qualitative_assessment_enum,
  qual_safe_secure public.qualitative_assessment_enum,
  qual_motivated public.qualitative_assessment_enum,
  qual_abusive_language public.qualitative_assessment_enum,
  qual_comfortable_escalate public.qualitative_assessment_enum,
  qual_inclusive_culture public.qualitative_assessment_enum,

  additional_remarks TEXT,

  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Constraints for HR Connect fields
  CONSTRAINT check_hr_connect_invited_positive CHECK (hr_connect_employees_invited IS NULL OR hr_connect_employees_invited >= 0),
  CONSTRAINT check_hr_connect_participants_positive CHECK (hr_connect_participants IS NULL OR hr_connect_participants >= 0),
  CONSTRAINT check_hr_connect_participants_not_exceed_invited CHECK (hr_connect_participants IS NULL OR hr_connect_employees_invited IS NULL OR hr_connect_participants <= hr_connect_employees_invited),
  CONSTRAINT check_invited_if_participants CHECK (NOT (hr_connect_participants > 0 AND (hr_connect_employees_invited IS NULL OR hr_connect_employees_invited = 0))),

  -- Constraints for percentage fields (0-100)
  CONSTRAINT check_manning_percentage CHECK (manning_percentage IS NULL OR (manning_percentage >= 0 AND manning_percentage <= 100)),
  CONSTRAINT check_attrition_percentage CHECK (attrition_percentage IS NULL OR (attrition_percentage >= 0 AND attrition_percentage <= 100)),
  CONSTRAINT check_non_vendor_percentage CHECK (non_vendor_percentage IS NULL OR (non_vendor_percentage >= 0 AND non_vendor_percentage <= 100)),
  CONSTRAINT check_er_percentage CHECK (er_percentage IS NULL OR (er_percentage >= 0 AND er_percentage <= 100)),

  -- Constraints for employee coverage
  CONSTRAINT check_new_employees_covered CHECK (new_employees_covered IS NULL OR new_employees_total IS NULL OR new_employees_covered <= new_employees_total),
  CONSTRAINT check_star_employees_covered CHECK (star_employees_covered IS NULL OR star_employees_total IS NULL OR star_employees_covered <= star_employees_total)
);

CREATE TRIGGER on_visits_updated
  BEFORE UPDATE ON public.visits
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

--------------------------------------------------------------------------------
-- RLS (Row Level Security) POLICIES
--------------------------------------------------------------------------------

-- Helper function to get the role of the current authenticated user
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role_enum
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public -- Explicitly set search_path
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL; -- Or raise an exception, depending on desired behavior for unauthenticated access
  END IF;
  RETURN (
    SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1
  );
EXCEPTION
  WHEN others THEN
    -- Log the error or handle it as appropriate
    RAISE WARNING 'Error in get_my_role for user %: %', auth.uid(), SQLERRM;
    RETURN NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;


-- 1. users Table RLS
--------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow user to see their own record" ON public.users;
CREATE POLICY "Allow user to see their own record"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Allow CHR to see all user records" ON public.users;
CREATE POLICY "Allow CHR to see all user records"
  ON public.users FOR SELECT
  TO authenticated
  USING (get_my_role() = 'CHR');

DROP POLICY IF EXISTS "Allow VHR to see ZHRs reporting to them and BHRs under those ZHRs" ON public.users;
CREATE POLICY "Allow VHR to see ZHRs reporting to them and BHRs under those ZHRs"
  ON public.users FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'VHR' AND (
      reports_to = auth.uid() -- Direct ZHR reports
      OR reports_to IN (SELECT u2.id FROM public.users u2 WHERE u2.reports_to = auth.uid() AND u2.role = 'ZHR') -- BHRs reporting to VHR's ZHRs
    )
  );

DROP POLICY IF EXISTS "Allow ZHR to see BHRs reporting to them" ON public.users;
CREATE POLICY "Allow ZHR to see BHRs reporting to them"
  ON public.users FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'ZHR' AND reports_to = auth.uid()
  );

DROP POLICY IF EXISTS "Allow authenticated users to see basic user info for dropdowns" ON public.users;
CREATE POLICY "Allow authenticated users to see basic user info for dropdowns"
  ON public.users FOR SELECT -- Consider restricting columns in your actual SELECT query for dropdowns
  TO authenticated
  USING (true); -- This is broad; restrict columns in your application queries (e.g., SELECT id, name, role FROM users)

DROP POLICY IF EXISTS "Allow user to insert their own record" ON public.users;
CREATE POLICY "Allow user to insert their own record"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Allow user to update their own non-critical info" ON public.users;
CREATE POLICY "Allow user to update their own non-critical info"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    role = OLD.role AND -- Prevent changing own role
    reports_to = OLD.reports_to AND -- Prevent changing own manager
    email = OLD.email -- Prevent changing own email via this policy
    -- Allow changing name, e_code, location
  );

DROP POLICY IF EXISTS "Allow CHR to update any user record" ON public.users;
CREATE POLICY "Allow CHR to update any user record"
  ON public.users FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'CHR')
  WITH CHECK (get_my_role() = 'CHR'); -- CHR can update anything

DROP POLICY IF EXISTS "Allow CHR to delete user records" ON public.users;
CREATE POLICY "Allow CHR to delete user records"
  ON public.users FOR DELETE
  TO authenticated
  USING (get_my_role() = 'CHR');


-- 2. branches Table RLS
----------------------
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to see all branches" ON public.branches;
CREATE POLICY "Allow authenticated users to see all branches"
  ON public.branches FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow CHR to manage branches" ON public.branches;
CREATE POLICY "Allow CHR to manage branches"
  ON public.branches FOR ALL -- Covers INSERT, UPDATE, DELETE
  TO authenticated
  USING (get_my_role() = 'CHR')
  WITH CHECK (get_my_role() = 'CHR');


-- 3. assignments Table RLS
-------------------------
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow BHR to see their own assignments" ON public.assignments;
CREATE POLICY "Allow BHR to see their own assignments"
  ON public.assignments FOR SELECT
  TO authenticated
  USING (get_my_role() = 'BHR' AND bhr_id = auth.uid());

DROP POLICY IF EXISTS "Allow ZHR to see assignments of BHRs they manage" ON public.assignments;
CREATE POLICY "Allow ZHR to see assignments of BHRs they manage"
  ON public.assignments FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'ZHR' AND
    bhr_id IN (SELECT u.id FROM public.users u WHERE u.role = 'BHR' AND u.reports_to = auth.uid())
  );

DROP POLICY IF EXISTS "Allow VHR to see assignments in their vertical" ON public.assignments;
CREATE POLICY "Allow VHR to see assignments in their vertical"
  ON public.assignments FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'VHR' AND
    bhr_id IN (
      SELECT bhr.id FROM public.users bhr
      JOIN public.users zhr ON bhr.reports_to = zhr.id
      WHERE bhr.role = 'BHR' AND zhr.role = 'ZHR' AND zhr.reports_to = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Allow CHR to see all assignments" ON public.assignments;
CREATE POLICY "Allow CHR to see all assignments"
  ON public.assignments FOR SELECT
  TO authenticated
  USING (get_my_role() = 'CHR');

DROP POLICY IF EXISTS "Allow ZHR to manage assignments for their BHRs" ON public.assignments;
CREATE POLICY "Allow ZHR to manage assignments for their BHRs"
  ON public.assignments FOR ALL -- Covers INSERT, UPDATE, DELETE
  TO authenticated
  USING (
    get_my_role() = 'ZHR' AND
    bhr_id IN (SELECT u.id FROM public.users u WHERE u.role = 'BHR' AND u.reports_to = auth.uid())
  )
  WITH CHECK (
    get_my_role() = 'ZHR' AND
    bhr_id IN (SELECT u.id FROM public.users u WHERE u.role = 'BHR' AND u.reports_to = auth.uid())
    -- ZHR can only assign BHRs that report to them
  );

DROP POLICY IF EXISTS "Allow CHR to manage all assignments" ON public.assignments;
CREATE POLICY "Allow CHR to manage all assignments"
  ON public.assignments FOR ALL
  TO authenticated
  USING (get_my_role() = 'CHR')
  WITH CHECK (get_my_role() = 'CHR');


-- 4. visits Table RLS
--------------------
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow BHR to see their own visits" ON public.visits;
CREATE POLICY "Allow BHR to see their own visits"
  ON public.visits FOR SELECT
  TO authenticated
  USING (get_my_role() = 'BHR' AND bhr_id = auth.uid());

DROP POLICY IF EXISTS "Allow ZHR to see visits of BHRs they manage" ON public.visits;
CREATE POLICY "Allow ZHR to see visits of BHRs they manage"
  ON public.visits FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'ZHR' AND
    bhr_id IN (SELECT u.id FROM public.users u WHERE u.role = 'BHR' AND u.reports_to = auth.uid())
  );

DROP POLICY IF EXISTS "Allow VHR to see visits in their vertical" ON public.visits;
CREATE POLICY "Allow VHR to see visits in their vertical"
  ON public.visits FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'VHR' AND
    bhr_id IN (
      SELECT bhr.id FROM public.users bhr
      JOIN public.users zhr ON bhr.reports_to = zhr.id
      WHERE bhr.role = 'BHR' AND zhr.role = 'ZHR' AND zhr.reports_to = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Allow CHR to see all visits" ON public.visits;
CREATE POLICY "Allow CHR to see all visits"
  ON public.visits FOR SELECT
  TO authenticated
  USING (get_my_role() = 'CHR');

DROP POLICY IF EXISTS "Allow BHR to insert their own visits" ON public.visits;
CREATE POLICY "Allow BHR to insert their own visits"
  ON public.visits FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'BHR' AND bhr_id = auth.uid());

DROP POLICY IF EXISTS "Allow BHR to update their own visits" ON public.visits;
CREATE POLICY "Allow BHR to update their own visits"
  ON public.visits FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'BHR' AND bhr_id = auth.uid())
  WITH CHECK (
    get_my_role() = 'BHR' AND bhr_id = auth.uid() AND
    (status = 'draft' OR OLD.status = 'draft') -- Can freely update drafts
    -- Potentially allow updating specific fields if submitted, e.g., only remarks if status is not approved/rejected
  );

DROP POLICY IF EXISTS "Allow ZHR/VHR/CHR to update visit status (approval/rejection)" ON public.visits;
CREATE POLICY "Allow ZHR/VHR/CHR to update visit status (approval/rejection)"
  ON public.visits FOR UPDATE
  TO authenticated
  USING (
    (get_my_role() = 'ZHR' AND bhr_id IN (SELECT u.id FROM public.users u WHERE u.role = 'BHR' AND u.reports_to = auth.uid())) OR
    (get_my_role() = 'VHR' AND bhr_id IN (
      SELECT bhr.id FROM public.users bhr
      JOIN public.users zhr ON bhr.reports_to = zhr.id
      WHERE bhr.role = 'BHR' AND zhr.role = 'ZHR' AND zhr.reports_to = auth.uid()
    )) OR
    get_my_role() = 'CHR'
  )
  WITH CHECK (
    (status = 'approved' OR status = 'rejected' OR status = 'submitted') AND -- Can only change to these or from submitted
    bhr_id = OLD.bhr_id AND visit_date = OLD.visit_date -- Prevent changing other fields with this policy
    -- Add more checks if only specific roles can approve specific transitions
  );


DROP POLICY IF EXISTS "Allow BHR to delete their own draft visits" ON public.visits;
CREATE POLICY "Allow BHR to delete their own draft visits"
  ON public.visits FOR DELETE
  TO authenticated
  USING (get_my_role() = 'BHR' AND bhr_id = auth.uid() AND status = 'draft');

DROP POLICY IF EXISTS "Allow CHR to delete any visit" ON public.visits;
CREATE POLICY "Allow CHR to delete any visit"
  ON public.visits FOR DELETE
  TO authenticated
  USING (get_my_role() = 'CHR');

--------------------------------------------------------------------------------
-- GRANT privileges
--------------------------------------------------------------------------------
-- Grant usage on schema to roles
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- Grant all privileges on tables to postgres and service_role (powerful roles)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;


-- Grant specific privileges to authenticated role (these are then further restricted by RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated; -- If you use sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated; -- If you use sequences

-- Ensure anon role has no privileges by default (Supabase default is usually fine, but explicit is safer)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
GRANT USAGE ON SCHEMA public TO anon; -- Anon needs usage on schema for some basic Supabase operations

-- Ensure the 'postgres' user (superuser) owns the helper function for RLS
ALTER FUNCTION public.get_my_role() OWNER TO postgres;
-- If you create more SECURITY DEFINER functions, ensure their ownership and permissions are correct.

--------------------------------------------------------------------------------
-- Seeding (Optional, example - uncomment and modify as needed)
--------------------------------------------------------------------------------
/*
-- Ensure this runs AFTER RLS policies are in place or temporarily disable RLS for seeding.
-- Best to run as postgres user or service_role which bypasses RLS by default.

-- Example: Create a CHR user (replace with actual details)
-- Note: This only creates the public.users record. The auth.users record must be created via Supabase Auth (e.g., signup).
-- You'll need the UUID from the auth.users table to insert here if matching.
-- For initial seeding, you might temporarily disable the `user_id_matches_auth_uid` constraint or RLS,
-- insert the CHR, then re-enable. Or, sign up the CHR user through your app first.

-- Assuming you signed up 'admin@hrview.com' and got its auth.uid()
-- INSERT INTO public.users (id, name, email, role)
-- VALUES ('<auth_user_id_for_admin>', 'Admin CHR', 'admin@hrview.com', 'CHR');

-- Example Branch
-- INSERT INTO public.branches (name, location, category, code)
-- VALUES ('Corporate HQ', 'Mumbai', 'Head Office', 'MUM-HQ-001');
*/

-- VACUUM ANALYZE; -- Good to run after major schema changes or data loads
呲
    