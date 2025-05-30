-- SQL Schema for HR View App

-- Drop existing objects with CASCADE to handle dependencies
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.get_my_role() CASCADE;

DROP TYPE IF EXISTS public.user_role_enum CASCADE;
DROP TYPE IF EXISTS public.visit_status_enum CASCADE;
DROP TYPE IF EXISTS public.qualitative_assessment_enum CASCADE;

-- Drop tables in reverse order of dependency, or use CASCADE if sure
DROP TABLE IF EXISTS public.visits CASCADE;
DROP TABLE IF EXISTS public.assignments CASCADE;
DROP TABLE IF EXISTS public.branches CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;


-- Create ENUM types
CREATE TYPE public.user_role_enum AS ENUM ('BHR', 'ZHR', 'VHR', 'CHR');
CREATE TYPE public.visit_status_enum AS ENUM ('draft', 'submitted', 'approved', 'rejected');
CREATE TYPE public.qualitative_assessment_enum AS ENUM ('yes', 'no');

-- Function to automatically update 'updated_at' timestamps
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
  reports_to UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Manager's ID
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE -- Link to Supabase Auth users
);
CREATE TRIGGER on_users_updated
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
COMMENT ON COLUMN public.users.id IS 'Links to auth.users.id';

-- branches Table
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  category TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TRIGGER on_branches_updated
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- assignments Table (Join table for BHRs and Branches)
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bhr_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT unique_bhr_branch_assignment UNIQUE (bhr_id, branch_id)
);
CREATE TRIGGER on_assignments_updated
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- visits Table
CREATE TABLE public.visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bhr_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  visit_date TIMESTAMPTZ NOT NULL,
  status public.visit_status_enum DEFAULT 'draft' NOT NULL,
  hr_connect_conducted BOOLEAN DEFAULT false,
  hr_connect_employees_invited INTEGER CHECK (hr_connect_employees_invited IS NULL OR hr_connect_employees_invited >= 0),
  hr_connect_participants INTEGER CHECK (hr_connect_participants IS NULL OR hr_connect_participants >= 0),
  manning_percentage NUMERIC(5,2) CHECK (manning_percentage IS NULL OR (manning_percentage >= 0 AND manning_percentage <= 100)),
  attrition_percentage NUMERIC(5,2) CHECK (attrition_percentage IS NULL OR (attrition_percentage >= 0 AND attrition_percentage <= 100)),
  non_vendor_percentage NUMERIC(5,2) CHECK (non_vendor_percentage IS NULL OR (non_vendor_percentage >= 0 AND non_vendor_percentage <= 100)),
  er_percentage NUMERIC(5,2) CHECK (er_percentage IS NULL OR (er_percentage >= 0 AND er_percentage <= 100)),
  cwt_cases INTEGER CHECK (cwt_cases IS NULL OR cwt_cases >= 0),
  performance_level TEXT,
  new_employees_total INTEGER CHECK (new_employees_total IS NULL OR new_employees_total >= 0),
  new_employees_covered INTEGER CHECK (new_employees_covered IS NULL OR new_employees_covered >= 0),
  star_employees_total INTEGER CHECK (star_employees_total IS NULL OR star_employees_total >= 0),
  star_employees_covered INTEGER CHECK (star_employees_covered IS NULL OR star_employees_covered >= 0),
  qual_aligned_conduct public.qualitative_assessment_enum,
  qual_safe_secure public.qualitative_assessment_enum,
  qual_motivated public.qualitative_assessment_enum,
  qual_abusive_language public.qualitative_assessment_enum,
  qual_comfortable_escalate public.qualitative_assessment_enum,
  qual_inclusive_culture public.qualitative_assessment_enum,
  additional_remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT participants_not_exceed_invited CHECK (hr_connect_participants IS NULL OR hr_connect_employees_invited IS NULL OR hr_connect_participants <= hr_connect_employees_invited),
  CONSTRAINT covered_new_not_exceed_total CHECK (new_employees_covered IS NULL OR new_employees_total IS NULL OR new_employees_covered <= new_employees_total),
  CONSTRAINT covered_star_not_exceed_total CHECK (star_employees_covered IS NULL OR star_employees_total IS NULL OR star_employees_covered <= star_employees_total)
);
CREATE TRIGGER on_visits_updated
  BEFORE UPDATE ON public.visits
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Helper function to get the role of the current authenticated user
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role_enum
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public -- Ensure it looks in the public schema
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL; -- Or raise an exception, depending on desired behavior for unauthenticated access
  ELSE
    -- This assumes there's a 'role' column in your 'public.users' table
    RETURN (SELECT role FROM users WHERE id = auth.uid());
  END IF;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;


--- ROW LEVEL SECURITY (RLS) POLICIES ---

-- 1. users Table RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own user record" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can read basic user info for selection" ON public.users;
DROP POLICY IF EXISTS "CHR can view all user records" ON public.users;
DROP POLICY IF EXISTS "Managers can view users reporting to them" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can insert their own user record" ON public.users;
DROP POLICY IF EXISTS "Users can update their own user record" ON public.users;
DROP POLICY IF EXISTS "CHR can update any user record" ON public.users;
DROP POLICY IF EXISTS "CHR can delete any user record" ON public.users;


CREATE POLICY "Users can view their own user record"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Authenticated users can read basic user info for selection"
  ON public.users FOR SELECT
  TO authenticated
  USING (true); -- For dropdowns. Be specific in your app's SELECT queries.

CREATE POLICY "CHR can view all user records"
  ON public.users FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'CHR');

CREATE POLICY "Managers can view users reporting to them"
  ON public.users FOR SELECT
  TO authenticated
  USING (id IN (SELECT u.id FROM public.users u WHERE u.reports_to = auth.uid()) OR reports_to = auth.uid());


CREATE POLICY "Authenticated users can insert their own user record"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own user record"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    NEW.email IS NOT DISTINCT FROM OLD.email AND -- Cannot change email
    NEW.role IS NOT DISTINCT FROM OLD.role AND -- Cannot change role
    NEW.reports_to IS NOT DISTINCT FROM OLD.reports_to -- Cannot change manager
    -- Allow name, e_code, location to be updated by the user.
  );

CREATE POLICY "CHR can update any user record"
  ON public.users FOR UPDATE
  TO authenticated
  USING (public.get_my_role() = 'CHR')
  WITH CHECK (public.get_my_role() = 'CHR');

CREATE POLICY "CHR can delete any user record" -- Careful with user deletion
  ON public.users FOR DELETE
  TO authenticated
  USING (public.get_my_role() = 'CHR');


-- 2. branches Table RLS
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


-- 3. assignments Table RLS
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
    (
      (TG_OP = 'INSERT' AND bhr_id IN (SELECT id FROM public.users WHERE reports_to = auth.uid() AND role = 'BHR')) OR
      (TG_OP = 'UPDATE' AND bhr_id IN (SELECT id FROM public.users WHERE reports_to = auth.uid() AND role = 'BHR')) OR
      (TG_OP = 'DELETE' AND bhr_id IN (SELECT id FROM public.users WHERE reports_to = auth.uid() AND role = 'BHR'))
    )
    -- Additional check: ensure branch_id is valid for the ZHR's zone if needed
  );

CREATE POLICY "CHR can manage all assignments"
  ON public.assignments FOR ALL
  TO authenticated
  USING (public.get_my_role() = 'CHR')
  WITH CHECK (public.get_my_role() = 'CHR');


-- 4. visits Table RLS
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits FORCE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "BHR can insert their own visits" ON public.visits;
DROP POLICY IF EXISTS "BHR can read their own visits" ON public.visits;
DROP POLICY IF EXISTS "BHR can update their draft/submitted visits" ON public.visits;
DROP POLICY IF EXISTS "BHR can delete their draft visits" ON public.visits;
DROP POLICY IF EXISTS "ZHR can view BHR visits under them" ON public.visits;
DROP POLICY IF EXISTS "ZHR can update status of BHR visits" ON public.visits;
DROP POLICY IF EXISTS "VHR can view vertical's visits" ON public.visits;
DROP POLICY IF EXISTS "VHR can update status of vertical's visits" ON public.visits;
DROP POLICY IF EXISTS "CHR can manage all visits" ON public.visits;

-- BHR Policies
CREATE POLICY "BHR can insert their own visits"
  ON public.visits FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_my_role() = 'BHR' AND
    NEW.bhr_id = auth.uid() AND
    NEW.status IN ('draft', 'submitted')
  );

CREATE POLICY "BHR can read their own visits"
  ON public.visits FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'BHR' AND
    bhr_id = auth.uid()
  );

CREATE POLICY "BHR can update their draft/submitted visits"
  ON public.visits FOR UPDATE
  TO authenticated
  USING ( -- Which rows can they target?
    public.get_my_role() = 'BHR' AND
    bhr_id = auth.uid() AND
    OLD.status IN ('draft', 'submitted')
  )
  WITH CHECK ( -- What can they change the row to?
    public.get_my_role() = 'BHR' AND
    NEW.bhr_id = auth.uid() AND -- Cannot change the BHR ID
    NEW.branch_id IS NOT DISTINCT FROM OLD.branch_id AND -- Cannot change the branch once set (example restriction)
    (
      (OLD.status = 'draft' AND NEW.status IN ('draft', 'submitted')) OR -- From draft, can stay draft or submit
      (OLD.status = 'submitted' AND NEW.status = 'submitted') -- From submitted, can only resubmit (update fields), not change status back to draft by themselves
    ) AND
    NOT (NEW.status IN ('approved', 'rejected')) -- BHR cannot approve/reject their own
  );

CREATE POLICY "BHR can delete their draft visits"
  ON public.visits FOR DELETE
  TO authenticated
  USING (
    public.get_my_role() = 'BHR' AND
    bhr_id = auth.uid() AND
    status = 'draft'
  );

-- ZHR Policies
CREATE POLICY "ZHR can view BHR visits under them"
  ON public.visits FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'ZHR' AND
    bhr_id IN (
      SELECT id FROM public.users
      WHERE reports_to = auth.uid() AND role = 'BHR'
    )
  );

CREATE POLICY "ZHR can update status of BHR visits"
  ON public.visits FOR UPDATE
  TO authenticated
  USING ( -- Which rows can they target?
    public.get_my_role() = 'ZHR' AND
    bhr_id IN (
      SELECT id FROM public.users
      WHERE reports_to = auth.uid() AND role = 'BHR'
    ) AND
    OLD.status = 'submitted' -- ZHRs primarily act on 'submitted' reports
  )
  WITH CHECK ( -- What can they change the row to?
    public.get_my_role() = 'ZHR' AND
    NEW.status IN ('approved', 'rejected') AND -- ZHR can approve or reject
    -- Ensure ZHR is not changing other critical data.
    NEW.bhr_id IS NOT DISTINCT FROM OLD.bhr_id AND
    NEW.branch_id IS NOT DISTINCT FROM OLD.branch_id AND
    NEW.visit_date IS NOT DISTINCT FROM OLD.visit_date
    -- Add other NEW.field IS NOT DISTINCT FROM OLD.field as necessary
  );

-- VHR Policies
CREATE POLICY "VHR can view vertical's visits"
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

CREATE POLICY "VHR can update status of vertical's visits"
  ON public.visits FOR UPDATE
  TO authenticated
  USING ( -- Which rows can they target?
    public.get_my_role() = 'VHR' AND
    bhr_id IN (
      SELECT bhr.id FROM public.users bhr
      JOIN public.users zhr ON bhr.reports_to = zhr.id
      WHERE zhr.reports_to = auth.uid() AND bhr.role = 'BHR' AND zhr.role = 'ZHR'
    ) AND
    OLD.status IN ('submitted', 'approved') -- VHRs can act on submitted or ZHR-approved reports
  )
  WITH CHECK ( -- What can they change the row to?
    public.get_my_role() = 'VHR' AND
    NEW.status IN ('approved', 'rejected') AND -- VHR can approve or reject
    NEW.bhr_id IS NOT DISTINCT FROM OLD.bhr_id AND
    NEW.branch_id IS NOT DISTINCT FROM OLD.branch_id
    -- Add other NEW.field IS NOT DISTINCT FROM OLD.field as necessary
  );

-- CHR Policy
CREATE POLICY "CHR can manage all visits"
  ON public.visits FOR ALL
  TO authenticated
  USING (public.get_my_role() = 'CHR')
  WITH CHECK (public.get_my_role() = 'CHR');


-- Grant basic permissions to roles (RLS will then filter)
-- Note: Supabase GUI might handle some of these default grants.
-- These ensure the 'authenticated' role can attempt operations, RLS then decides.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visits TO authenticated;

-- Default privileges for future tables in the public schema if any
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated; -- If you use sequences explicitly
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;

-- Service role should have full access (often used for admin tasks, migrations)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
```