
-- SQL Schema for HR View Application

-- Drop existing objects in reverse order of dependency (if re-running script)
-- Drop triggers before functions, drop functions before types, drop policies before tables, drop tables before types (if types depend on tables which is not the case here usually for enums)

-- Drop Triggers first if they exist from a previous run
DROP TRIGGER IF EXISTS on_users_updated ON public.users;
DROP TRIGGER IF EXISTS on_branches_updated ON public.branches;
DROP TRIGGER IF EXISTS on_assignments_updated ON public.assignments;
DROP TRIGGER IF EXISTS on_visits_updated ON public.visits;

-- Drop Functions (use CASCADE if triggers depend on it, or ensure triggers are dropped first)
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE; -- CASCADE will drop dependent triggers
DROP FUNCTION IF EXISTS public.get_my_role();

-- Drop Tables (in order that respects foreign key constraints, or drop constraints first)
DROP TABLE IF EXISTS public.visits;
DROP TABLE IF EXISTS public.assignments;
DROP TABLE IF EXISTS public.branches;
DROP TABLE IF EXISTS public.users; -- Assuming this is the user profile table, auth.users is separate

-- Drop ENUM Types (only if no tables use them)
DROP TYPE IF EXISTS public.user_role_enum;
DROP TYPE IF EXISTS public.visit_status_enum;
DROP TYPE IF EXISTS public.qualitative_assessment_enum;


-- Create ENUM Types
CREATE TYPE public.user_role_enum AS ENUM ('BHR', 'ZHR', 'VHR', 'CHR');
CREATE TYPE public.visit_status_enum AS ENUM ('draft', 'submitted', 'approved', 'rejected');
CREATE TYPE public.qualitative_assessment_enum AS ENUM ('yes', 'no');

-- Function to automatically update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- SECURITY DEFINER is important for it to work across RLS

-- Grant execute on the function (though with SECURITY DEFINER, it runs as owner)
-- GRANT EXECUTE ON FUNCTION public.handle_updated_at() TO authenticated, service_role;


-- users Table (for user profiles, roles, hierarchy)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, -- Links to Supabase auth.users
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL, -- Should match auth.users.email, consider a trigger to keep in sync or rely on auth
  role public.user_role_enum NOT NULL,
  e_code TEXT UNIQUE,
  location TEXT,
  reports_to UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Manager's user ID
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT email_check CHECK (email ~* '^[A-Za-z0-9._+%-]+@[A-Za-z0-9.-]+[.][A-Za-z]+$')
);
COMMENT ON TABLE public.users IS 'Stores user profile information, roles, and reporting hierarchy.';
COMMENT ON COLUMN public.users.id IS 'Primary key, references auth.users.id for authentication linkage.';
COMMENT ON COLUMN public.users.reports_to IS 'ID of the user this user reports to (their manager). NULL for top-level users.';

CREATE TRIGGER on_users_updated
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- branches Table
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  category TEXT NOT NULL, -- E.g., 'Metro Tier A', 'Urban Tier B'
  code TEXT UNIQUE NOT NULL, -- E.g., 'NY001', 'LA001'
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.branches IS 'Stores details of various company branches.';
COMMENT ON COLUMN public.branches.code IS 'Unique code for the branch.';

CREATE TRIGGER on_branches_updated
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- assignments Table (Junction table for BHR and Branch assignments)
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
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- visits Table
CREATE TABLE public.visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bhr_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, -- The BHR who made the visit
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  visit_date TIMESTAMPTZ NOT NULL,
  status public.visit_status_enum DEFAULT 'draft' NOT NULL,

  -- HR Connect Session Details (conditionally shown in form)
  hr_connect_conducted BOOLEAN DEFAULT false,
  hr_connect_employees_invited INTEGER,
  hr_connect_participants INTEGER,

  -- Branch Metrics
  manning_percentage NUMERIC(5,2), -- E.g., 95.50
  attrition_percentage NUMERIC(5,2),
  non_vendor_percentage NUMERIC(5,2),
  er_percentage NUMERIC(5,2),
  cwt_cases INTEGER,
  performance_level TEXT, -- Could be an ENUM if values are fixed: 'Excellent', 'Good', etc.

  -- Employee Coverage
  new_employees_total INTEGER,
  new_employees_covered INTEGER,
  star_employees_total INTEGER,
  star_employees_covered INTEGER,

  -- Qualitative Assessment
  qual_aligned_conduct public.qualitative_assessment_enum,
  qual_safe_secure public.qualitative_assessment_enum,
  qual_motivated public.qualitative_assessment_enum,
  qual_abusive_language public.qualitative_assessment_enum,
  qual_comfortable_escalate public.qualitative_assessment_enum,
  qual_inclusive_culture public.qualitative_assessment_enum,

  additional_remarks TEXT, -- General notes or summary from BHR

  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Constraints
  CONSTRAINT check_hr_connect_invited_positive CHECK (hr_connect_employees_invited IS NULL OR hr_connect_employees_invited >= 0),
  CONSTRAINT check_hr_connect_participants_positive CHECK (hr_connect_participants IS NULL OR hr_connect_participants >= 0),
  CONSTRAINT check_hr_connect_participants_not_exceed_invited
    CHECK (hr_connect_participants IS NULL OR hr_connect_employees_invited IS NULL OR hr_connect_participants <= hr_connect_employees_invited),
  CONSTRAINT check_manning_percentage_range CHECK (manning_percentage IS NULL OR (manning_percentage >= 0 AND manning_percentage <= 100)),
  CONSTRAINT check_attrition_percentage_range CHECK (attrition_percentage IS NULL OR (attrition_percentage >= 0 AND attrition_percentage <= 100)),
  CONSTRAINT check_non_vendor_percentage_range CHECK (non_vendor_percentage IS NULL OR (non_vendor_percentage >= 0 AND non_vendor_percentage <= 100)),
  CONSTRAINT check_er_percentage_range CHECK (er_percentage IS NULL OR (er_percentage >= 0 AND er_percentage <= 100)),
  CONSTRAINT check_new_employees_covered_not_exceed_total
    CHECK (new_employees_covered IS NULL OR new_employees_total IS NULL OR new_employees_covered <= new_employees_total),
  CONSTRAINT check_star_employees_covered_not_exceed_total
    CHECK (star_employees_covered IS NULL OR star_employees_total IS NULL OR star_employees_covered <= star_employees_total)
);
COMMENT ON TABLE public.visits IS 'Records details of HR visits to branches.';
COMMENT ON COLUMN public.visits.bhr_id IS 'The BHR user who conducted the visit.';

CREATE TRIGGER on_visits_updated
  BEFORE UPDATE ON public.visits
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes for performance
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_reports_to ON public.users(reports_to);
CREATE INDEX idx_assignments_bhr_id ON public.assignments(bhr_id);
CREATE INDEX idx_assignments_branch_id ON public.assignments(branch_id);
CREATE INDEX idx_visits_bhr_id ON public.visits(bhr_id);
CREATE INDEX idx_visits_branch_id ON public.visits(branch_id);
CREATE INDEX idx_visits_visit_date ON public.visits(visit_date);
CREATE INDEX idx_visits_status ON public.visits(status);


--------------------------------------------------------------------------------
-- Row Level Security (RLS) Policies
--------------------------------------------------------------------------------

-- Helper function to get the role of the current authenticated user
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role_enum
LANGUAGE plpgsql
SECURITY DEFINER -- Executes with the permissions of the function owner (typically admin)
SET search_path = public -- Ensures it looks for 'users' table in 'public' schema
AS $$
BEGIN
  -- Check if a user is authenticated. If not, return NULL or handle as appropriate.
  IF auth.uid() IS NULL THEN
    RETURN NULL; -- Or raise an exception, depending on desired behavior for unauthenticated access
  ELSE
    -- Assuming 'users' table has 'id' (UUID matching auth.uid()) and 'role' (user_role_enum)
    RETURN (SELECT role FROM users WHERE id = auth.uid());
  END IF;
END;
$$;

-- Grant execute permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;


-- RLS for 'users' table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts (optional, but good for clean setup)
DROP POLICY IF EXISTS "Users can view their own user record" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can read basic user info for selection" ON public.users;
DROP POLICY IF EXISTS "CHR can view all user records" ON public.users;
DROP POLICY IF EXISTS "VHR can view ZHRs/BHRs in their vertical" ON public.users;
DROP POLICY IF EXISTS "ZHR can view BHRs reporting to them" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can insert their own user record" ON public.users;
DROP POLICY IF EXISTS "Users can update their own user record (limited fields)" ON public.users;
DROP POLICY IF EXISTS "CHR can update any user record" ON public.users;
DROP POLICY IF EXISTS "CHR can delete any user record" ON public.users;

-- SELECT Policies for 'users'
CREATE POLICY "Users can view their own user record"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Authenticated users can read basic user info for selection" -- For dropdowns etc.
  ON public.users FOR SELECT
  TO authenticated
  USING (true); -- BE CAREFUL: This allows any authenticated user to read all users.
                -- Consider restricting columns or making it more role-specific if sensitive data is in 'users'.
                -- For example, you might create a VIEW with limited columns for this purpose.

CREATE POLICY "ZHR can view BHRs reporting to them"
  ON public.users FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'ZHR' AND
    (reports_to = auth.uid() AND role = 'BHR') -- Can see BHRs reporting directly
  );

CREATE POLICY "VHR can view ZHRs/BHRs in their vertical"
  ON public.users FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'VHR' AND
    (
      (reports_to = auth.uid() AND role = 'ZHR') OR -- Can see ZHRs reporting directly
      (role = 'BHR' AND reports_to IN (SELECT u.id FROM public.users u WHERE u.reports_to = auth.uid() AND u.role = 'ZHR')) -- Can see BHRs of their ZHRs
    )
  );

CREATE POLICY "CHR can view all user records"
  ON public.users FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'CHR');

-- INSERT Policies for 'users'
CREATE POLICY "Authenticated users can insert their own user record"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id AND auth.role() = 'authenticated'); -- auth.role() = 'authenticated' ensures it's a logged-in user

-- UPDATE Policies for 'users'
CREATE POLICY "Users can update their own user record (limited fields)"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    -- Prevent users from changing their own email, role, or reports_to directly.
    -- These changes should be handled by specific admin functions or CHR.
    NEW.email IS NOT DISTINCT FROM OLD.email AND
    NEW.role IS NOT DISTINCT FROM OLD.role AND
    NEW.reports_to IS NOT DISTINCT FROM OLD.reports_to
    -- Allow updating name, e_code, location
  );

CREATE POLICY "CHR can update any user record"
  ON public.users FOR UPDATE
  TO authenticated
  USING (public.get_my_role() = 'CHR')
  WITH CHECK (public.get_my_role() = 'CHR');

-- DELETE Policies for 'users' (Generally, soft-delete is preferred for users)
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
  USING (true); -- Assuming branch information is generally visible within the org

CREATE POLICY "CHR can manage branches"
  ON public.branches FOR ALL -- INSERT, UPDATE, DELETE
  TO authenticated
  USING (public.get_my_role() = 'CHR')
  WITH CHECK (public.get_my_role() = 'CHR');


-- RLS for 'assignments' table
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "BHRs can view their own assignments" ON public.assignments;
DROP POLICY IF EXISTS "ZHRs can manage assignments for their BHRs" ON public.assignments;
DROP POLICY IF EXISTS "VHRs can view assignments in their vertical" ON public.assignments;
DROP POLICY IF EXISTS "CHR can manage all assignments" ON public.assignments;


CREATE POLICY "BHRs can view their own assignments"
  ON public.assignments FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'BHR' AND bhr_id = auth.uid());

CREATE POLICY "ZHRs can manage assignments for their BHRs"
  ON public.assignments FOR ALL
  TO authenticated
  USING ( -- Applies to SELECT, UPDATE, DELETE for rows matching this
    public.get_my_role() = 'ZHR' AND
    bhr_id IN (SELECT id FROM public.users WHERE reports_to = auth.uid() AND role = 'BHR')
  )
  WITH CHECK ( -- Applies to INSERT and UPDATE for new/modified row values
    public.get_my_role() = 'ZHR' AND
    bhr_id IN (SELECT id FROM public.users WHERE reports_to = auth.uid() AND role = 'BHR')
    -- Additionally, ensure branch_id is valid and within ZHR's scope if needed (more complex)
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

CREATE POLICY "CHR can manage all assignments"
  ON public.assignments FOR ALL
  TO authenticated
  USING (public.get_my_role() = 'CHR')
  WITH CHECK (public.get_my_role() = 'CHR');


-- RLS for 'visits' table
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits FORCE ROW LEVEL SECURITY;

-- Drop existing policies for visits table to apply new ones cleanly
DROP POLICY IF EXISTS "BHRs can insert their own visits" ON public.visits;
DROP POLICY IF EXISTS "BHRs can select their own visits" ON public.visits;
DROP POLICY IF EXISTS "BHRs can update their own draft/submitted visits" ON public.visits;
DROP POLICY IF EXISTS "BHRs can delete their own draft visits" ON public.visits;

DROP POLICY IF EXISTS "ZHRs can select visits of their BHRs" ON public.visits;
DROP POLICY IF EXISTS "ZHRs can update status of submitted visits by their BHRs" ON public.visits;

DROP POLICY IF EXISTS "VHRs can select visits in their vertical" ON public.visits;
DROP POLICY IF EXISTS "VHRs can update status of visits in their vertical" ON public.visits;

DROP POLICY IF EXISTS "CHR can manage all visits" ON public.visits;


-- BHR Policies for 'visits' table
CREATE POLICY "BHRs can insert their own visits"
  ON public.visits FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_role() = 'BHR' AND bhr_id = auth.uid());

CREATE POLICY "BHRs can select their own visits"
  ON public.visits FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'BHR' AND bhr_id = auth.uid());

CREATE POLICY "BHRs can update their own draft/submitted visits"
  ON public.visits FOR UPDATE
  TO authenticated
  USING (public.get_my_role() = 'BHR' AND bhr_id = auth.uid()) -- Rows they can target for update
  WITH CHECK ( -- Conditions for the update itself
    public.get_my_role() = 'BHR' AND
    bhr_id = auth.uid() AND -- Redundant with USING for BHRs, but good for clarity in CHECK
    OLD.status IN ('draft', 'submitted') AND
    -- BHRs should not be able to change status to 'approved' or 'rejected'.
    -- They can change other fields if status is 'draft' or 'submitted'.
    -- If they are submitting a draft, the new status would be 'submitted'.
    (NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status = 'submitted') AND
    NOT (NEW.status IN ('approved', 'rejected'))
  );

CREATE POLICY "BHRs can delete their own draft visits"
  ON public.visits FOR DELETE
  TO authenticated
  USING (public.get_my_role() = 'BHR' AND bhr_id = auth.uid() AND status = 'draft');


-- ZHR Policies for 'visits' table
CREATE POLICY "ZHRs can select visits of their BHRs"
  ON public.visits FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'ZHR' AND
    bhr_id IN (SELECT id FROM public.users WHERE reports_to = auth.uid() AND role = 'BHR')
  );

CREATE POLICY "ZHRs can update status of submitted visits by their BHRs"
  ON public.visits FOR UPDATE
  TO authenticated
  USING ( -- Rows ZHRs can target for update
    public.get_my_role() = 'ZHR' AND
    bhr_id IN (SELECT id FROM public.users WHERE reports_to = auth.uid() AND role = 'BHR') AND
    OLD.status = 'submitted' -- ZHR primarily acts on 'submitted' reports
  )
  WITH CHECK ( -- Conditions for the update itself (ZHRs can approve or reject)
    public.get_my_role() = 'ZHR' AND
    NEW.status IN ('approved', 'rejected') AND OLD.status = 'submitted' AND
    -- Ensure ZHRs only change status and not other critical data (simplified here)
    NEW.bhr_id IS NOT DISTINCT FROM OLD.bhr_id AND
    NEW.branch_id IS NOT DISTINCT FROM OLD.branch_id AND
    NEW.visit_date IS NOT DISTINCT FROM OLD.visit_date
    -- Add more NEW.column IS NOT DISTINCT FROM OLD.column if ZHRs should not modify other fields
  );


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

CREATE POLICY "VHRs can update status of visits in their vertical"
  ON public.visits FOR UPDATE
  TO authenticated
  USING ( -- Rows VHRs can target for update
    public.get_my_role() = 'VHR' AND
    bhr_id IN (
      SELECT bhr.id FROM public.users bhr
      JOIN public.users zhr ON bhr.reports_to = zhr.id
      WHERE zhr.reports_to = auth.uid() AND bhr.role = 'BHR' AND zhr.role = 'ZHR'
    ) AND
    OLD.status IN ('submitted', 'approved') -- VHR can act on submitted or ZHR-approved reports
  )
  WITH CHECK ( -- Conditions for the update itself (VHRs can approve or reject)
    public.get_my_role() = 'VHR' AND
    NEW.status IN ('approved', 'rejected') AND OLD.status IN ('submitted', 'approved') AND
    -- Ensure VHRs only change status (simplified)
    NEW.bhr_id IS NOT DISTINCT FROM OLD.bhr_id AND
    NEW.branch_id IS NOT DISTINCT FROM OLD.branch_id AND
    NEW.visit_date IS NOT DISTINCT FROM OLD.visit_date
  );


-- CHR Policy for 'visits' table
CREATE POLICY "CHR can manage all visits"
  ON public.visits FOR ALL
  TO authenticated
  USING (public.get_my_role() = 'CHR')
  WITH CHECK (public.get_my_role() = 'CHR');


-- Ensure appropriate default privileges for new objects created by roles like 'postgres' (Supabase admin)
-- This is good practice if you are creating tables/functions as the Supabase admin user.
-- It ensures that 'authenticated' and 'service_role' get basic usage/select on new tables by default.
-- You still need specific GRANTs for INSERT/UPDATE/DELETE on tables/sequences if not covered by RLS or owner privileges.

-- For the 'public' schema
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;

-- Grant basic usage on schema public to authenticated role
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Grant specific permissions to 'authenticated' role for basic operations. RLS will further restrict.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.branches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.visits TO authenticated;

-- Sequences (if you were using serial instead of gen_random_uuid() for PKs, you'd grant usage here too)
-- e.g., GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- The service_role should typically have broader permissions, often bypassing RLS.
-- Ensure your Supabase client uses the anon key for user sessions and service_role key only for trusted server-side operations.

GRANT ALL ON TABLE public.users TO service_role;
GRANT ALL ON TABLE public.branches TO service_role;
GRANT ALL ON TABLE public.assignments TO service_role;
GRANT ALL ON TABLE public.visits TO service_role;

-- If you created ENUMs as the postgres user, authenticated role might need USAGE on them explicitly.
-- Though usually, they are usable if the column type is the enum.
GRANT USAGE ON TYPE public.user_role_enum TO authenticated;
GRANT USAGE ON TYPE public.visit_status_enum TO authenticated;
GRANT USAGE ON TYPE public.qualitative_assessment_enum TO authenticated;

GRANT USAGE ON TYPE public.user_role_enum TO service_role;
GRANT USAGE ON TYPE public.visit_status_enum TO service_role;
GRANT USAGE ON TYPE public.qualitative_assessment_enum TO service_role;

SELECT 'Schema setup and RLS policies script finished.';
-- End of Schema
