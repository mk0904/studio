
-- Drop existing objects if they exist, to ensure a clean slate.
-- Drop RLS policies first if they depend on the function.
-- (Order matters: drop policies, then function, then tables, then types)

-- Example for users table (repeat for other tables if policies exist and cause issues)
-- You might need to drop policies individually if they exist
-- DROP POLICY IF EXISTS "Allow all access to CHR" ON public.users;
-- ... (other policies on users) ...

DROP FUNCTION IF EXISTS public.get_my_role();
DROP FUNCTION IF EXISTS public.handle_updated_at();

-- Drop tables in reverse order of dependency
DROP TABLE IF EXISTS public.visits;
DROP TABLE IF EXISTS public.assignments;
DROP TABLE IF EXISTS public.branches;
DROP TABLE IF EXISTS public.users; -- Depends on auth.users, but FK handles it.

-- Drop ENUM types (only if no tables use them)
DROP TYPE IF EXISTS public.qualitative_assessment_enum;
DROP TYPE IF EXISTS public.visit_status_enum;
DROP TYPE IF EXISTS public.user_role_enum;


-- Create ENUM types
CREATE TYPE public.user_role_enum AS ENUM ('BHR', 'ZHR', 'VHR', 'CHR');
CREATE TYPE public.visit_status_enum AS ENUM ('draft', 'submitted', 'approved', 'rejected');
CREATE TYPE public.qualitative_assessment_enum AS ENUM ('yes', 'no');

-- Create users table
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, -- Defaulting to auth.users.id
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role user_role_enum NOT NULL,
  e_code TEXT,
  location TEXT,
  reports_to UUID REFERENCES public.users(id), -- Self-referencing for hierarchy
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.users IS 'Stores user profile information and their roles within the HR hierarchy.';
COMMENT ON COLUMN public.users.reports_to IS 'ID of the user this user reports to (their manager).';

-- Create branches table
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  category TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.branches IS 'Stores information about different company branches.';

-- Create assignments table (Join table for BHR and Branch)
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bhr_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (bhr_id, branch_id) -- Ensures a BHR isn't assigned to the same branch multiple times
);
COMMENT ON TABLE public.assignments IS 'Maps BHR users to the branches they are responsible for.';

-- Create visits table
CREATE TABLE public.visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bhr_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  visit_date TIMESTAMPTZ NOT NULL,
  status visit_status_enum DEFAULT 'draft',
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
  qual_aligned_conduct qualitative_assessment_enum,
  qual_safe_secure qualitative_assessment_enum,
  qual_motivated qualitative_assessment_enum,
  qual_abusive_language qualitative_assessment_enum,
  qual_comfortable_escalate qualitative_assessment_enum,
  qual_inclusive_culture qualitative_assessment_enum,
  additional_remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT chk_participants_not_exceed_invited CHECK (hr_connect_participants IS NULL OR hr_connect_employees_invited IS NULL OR hr_connect_participants <= hr_connect_employees_invited),
  CONSTRAINT chk_new_covered_not_exceed_total CHECK (new_employees_covered IS NULL OR new_employees_total IS NULL OR new_employees_covered <= new_employees_total),
  CONSTRAINT chk_star_covered_not_exceed_total CHECK (star_employees_covered IS NULL OR star_employees_total IS NULL OR star_employees_covered <= star_employees_total)
);
COMMENT ON TABLE public.visits IS 'Records details of HR visits to branches.';

-- Trigger function to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to tables
CREATE TRIGGER on_users_update
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_branches_update
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_assignments_update
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_visits_update
  BEFORE UPDATE ON public.visits
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Helper function to get current user's role from public.users
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role_enum
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Ensure the function operates within the public schema context
  SET LOCAL search_path = public;
  RETURN (SELECT u.role FROM users u WHERE u.id = auth.uid());
END;
$$;
COMMENT ON FUNCTION public.get_my_role() IS 'Returns the role of the currently authenticated user from the public.users table.';

-- Enable RLS for all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for public.users table
DROP POLICY IF EXISTS "Authenticated users can insert their own user record" ON public.users;
CREATE POLICY "Authenticated users can insert their own user record"
  ON public.users FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can view their own user record" ON public.users;
CREATE POLICY "Users can view their own user record"
  ON public.users FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Authenticated users can read basic user info for selection" ON public.users;
CREATE POLICY "Authenticated users can read basic user info for selection"
  ON public.users FOR SELECT TO authenticated
  USING (true); -- Allows reading (id, name, role) for dropdowns. Refine for production.

DROP POLICY IF EXISTS "Users can update their own non-critical user record details" ON public.users;
CREATE POLICY "Users can update their own non-critical user record details"
  ON public.users FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    NEW.email IS NOT DISTINCT FROM OLD.email AND -- Prevent email change via this policy
    NEW.role IS NOT DISTINCT FROM OLD.role AND   -- Prevent role change
    NEW.reports_to IS NOT DISTINCT FROM OLD.reports_to -- Prevent changing manager
    -- Allow changing name, e_code, location
  );

DROP POLICY IF EXISTS "CHR can manage all user records" ON public.users;
CREATE POLICY "CHR can manage all user records"
  ON public.users FOR ALL TO authenticated
  USING (public.get_my_role() = 'CHR')
  WITH CHECK (public.get_my_role() = 'CHR');


-- RLS Policies for public.branches table
DROP POLICY IF EXISTS "Authenticated users can view all branches" ON public.branches;
CREATE POLICY "Authenticated users can view all branches"
  ON public.branches FOR SELECT TO authenticated
  USING (true); -- Simplification: all authenticated users can see all branches.

DROP POLICY IF EXISTS "CHR can manage all branches" ON public.branches;
CREATE POLICY "CHR can manage all branches"
  ON public.branches FOR ALL TO authenticated
  USING (public.get_my_role() = 'CHR')
  WITH CHECK (public.get_my_role() = 'CHR');
  -- Add policies for ZHR/VHR to add/edit branches if needed


-- RLS Policies for public.assignments table
DROP POLICY IF EXISTS "BHRs can view their own assignments" ON public.assignments;
CREATE POLICY "BHRs can view their own assignments"
  ON public.assignments FOR SELECT TO authenticated
  USING (bhr_id = auth.uid() AND public.get_my_role() = 'BHR');

DROP POLICY IF EXISTS "ZHRs can manage assignments for BHRs reporting to them" ON public.assignments;
CREATE POLICY "ZHRs can manage assignments for BHRs reporting to them"
  ON public.assignments FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'ZHR' AND
    bhr_id IN (SELECT u.id FROM public.users u WHERE u.reports_to = auth.uid() AND u.role = 'BHR')
  )
  WITH CHECK (
    public.get_my_role() = 'ZHR' AND
    bhr_id IN (SELECT u.id FROM public.users u WHERE u.reports_to = auth.uid() AND u.role = 'BHR')
  );

DROP POLICY IF EXISTS "VHRs can view assignments in their vertical" ON public.assignments;
CREATE POLICY "VHRs can view assignments in their vertical"
  ON public.assignments FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'VHR' AND
    EXISTS (
      SELECT 1 FROM public.users bhr
      JOIN public.users zhr ON bhr.reports_to = zhr.id
      WHERE bhr.id = public.assignments.bhr_id AND zhr.reports_to = auth.uid() AND bhr.role = 'BHR' AND zhr.role = 'ZHR'
    )
  );

DROP POLICY IF EXISTS "CHR can manage all assignments" ON public.assignments;
CREATE POLICY "CHR can manage all assignments"
  ON public.assignments FOR ALL TO authenticated
  USING (public.get_my_role() = 'CHR')
  WITH CHECK (public.get_my_role() = 'CHR');


-- RLS Policies for public.visits table
DROP POLICY IF EXISTS "BHRs can manage their own visits" ON public.visits;
CREATE POLICY "BHRs can manage their own visits"
  ON public.visits FOR ALL TO authenticated
  USING (bhr_id = auth.uid() AND public.get_my_role() = 'BHR')
  WITH CHECK (
    bhr_id = auth.uid() AND public.get_my_role() = 'BHR' AND
    -- Allow BHR to submit if draft, or re-draft if rejected by ZHR/VHR
    (NEW.status = 'submitted' AND OLD.status = 'draft') OR
    (NEW.status = 'draft' AND OLD.status = 'rejected') OR
    (OLD.status = 'draft' AND NEW.status = 'draft') -- Can always save draft
  );

DROP POLICY IF EXISTS "ZHRs can view visits of BHRs reporting to them and approve/reject" ON public.visits;
CREATE POLICY "ZHRs can view visits of BHRs reporting to them and approve/reject"
  ON public.visits FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'ZHR' AND
    bhr_id IN (SELECT u.id FROM public.users u WHERE u.reports_to = auth.uid() AND u.role = 'BHR')
  )
  WITH CHECK (
    public.get_my_role() = 'ZHR' AND
    bhr_id IN (SELECT u.id FROM public.users u WHERE u.reports_to = auth.uid() AND u.role = 'BHR') AND
    (
      (NEW.status = 'approved' AND OLD.status = 'submitted') OR
      (NEW.status = 'rejected' AND OLD.status = 'submitted')
    )
  );

DROP POLICY IF EXISTS "VHRs can view visits in their vertical and approve/reject if escalated" ON public.visits;
CREATE POLICY "VHRs can view visits in their vertical and approve/reject if escalated"
  ON public.visits FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'VHR' AND
    EXISTS (
      SELECT 1 FROM public.users bhr
      JOIN public.users zhr ON bhr.reports_to = zhr.id
      WHERE bhr.id = public.visits.bhr_id AND zhr.reports_to = auth.uid() AND bhr.role = 'BHR' AND zhr.role = 'ZHR'
    )
  )
  WITH CHECK (
    public.get_my_role() = 'VHR' AND
    EXISTS (
      SELECT 1 FROM public.users bhr
      JOIN public.users zhr ON bhr.reports_to = zhr.id
      WHERE bhr.id = public.visits.bhr_id AND zhr.reports_to = auth.uid() AND bhr.role = 'BHR' AND zhr.role = 'ZHR'
    ) AND
    (
      -- VHRs might typically only approve visits that were 'submitted' (e.g. if ZHR is bypassed or for certain types)
      -- or if a visit was already 'approved' by ZHR and needs VHR approval.
      -- This policy assumes VHR can also approve 'submitted' ones. Adjust as per workflow.
      (NEW.status = 'approved' AND OLD.status = 'submitted') OR
      (NEW.status = 'rejected' AND OLD.status = 'submitted')
      -- Add more complex status transition logic if VHRs approve ZHR-approved items etc.
    )
  );

DROP POLICY IF EXISTS "CHR can manage all visits" ON public.visits;
CREATE POLICY "CHR can manage all visits"
  ON public.visits FOR ALL TO authenticated
  USING (public.get_my_role() = 'CHR')
  WITH CHECK (public.get_my_role() = 'CHR');

-- Grant basic usage on schema to roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Grant all privileges on our tables to supabase_admin (service_role)
-- This is usually done by default but explicit grant is fine.
GRANT ALL ON TABLE public.users TO service_role;
GRANT ALL ON TABLE public.branches TO service_role;
GRANT ALL ON TABLE public.assignments TO service_role;
GRANT ALL ON TABLE public.visits TO service_role;

-- Grant permissions for authenticated users (RLS will then filter)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.branches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.visits TO authenticated;

-- Grant execution on functions
GRANT EXECUTE ON FUNCTION public.handle_updated_at() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated, service_role;

-- Set default privileges for future objects created by supabase_admin (or current user if admin)
-- This ensures that newly created tables/functions etc. by the admin automatically
-- grant usage to authenticated users, which RLS can then act upon.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON TYPES TO authenticated;

