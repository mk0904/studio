
-- Create ENUM types
DROP TYPE IF EXISTS public.user_role_enum CASCADE;
CREATE TYPE public.user_role_enum AS ENUM ('BHR', 'ZHR', 'VHR', 'CHR');

DROP TYPE IF EXISTS public.visit_status_enum CASCADE;
CREATE TYPE public.visit_status_enum AS ENUM ('draft', 'submitted', 'approved', 'rejected');

DROP TYPE IF EXISTS public.qualitative_assessment_enum CASCADE;
CREATE TYPE public.qualitative_assessment_enum AS ENUM ('yes', 'no');

-- Helper function to get current user's app role from public.users table
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role_enum
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$;

-- Users Table
DROP TABLE IF EXISTS public.users CASCADE;
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role public.user_role_enum NOT NULL,
  e_code TEXT,
  location TEXT,
  reports_to UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Manager
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.users IS 'Application users, extending auth.users with app-specific roles and hierarchy.';
COMMENT ON COLUMN public.users.id IS 'Links to auth.users.id.';
COMMENT ON COLUMN public.users.reports_to IS 'Foreign key to another user (manager).';

-- Branches Table
DROP TABLE IF EXISTS public.branches CASCADE;
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  category TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.branches IS 'Details of company branches.';

-- Assignments Table (BHR to Branch)
DROP TABLE IF EXISTS public.assignments CASCADE;
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bhr_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT unique_bhr_branch_assignment UNIQUE (bhr_id, branch_id)
);
COMMENT ON TABLE public.assignments IS 'Assigns BHR users to specific branches.';

-- Visits Table
DROP TABLE IF EXISTS public.visits CASCADE;
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

  CONSTRAINT check_hr_connect_participants CHECK (hr_connect_participants IS NULL OR hr_connect_employees_invited IS NULL OR hr_connect_participants <= hr_connect_employees_invited),
  CONSTRAINT check_new_employees_covered CHECK (new_employees_covered IS NULL OR new_employees_total IS NULL OR new_employees_covered <= new_employees_total),
  CONSTRAINT check_star_employees_covered CHECK (star_employees_covered IS NULL OR star_employees_total IS NULL OR star_employees_covered <= star_employees_total)
);
COMMENT ON TABLE public.visits IS 'Records of HR visits to branches.';

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_users_update ON public.users;
CREATE TRIGGER on_users_update
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS on_branches_update ON public.branches;
CREATE TRIGGER on_branches_update
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS on_assignments_update ON public.assignments;
CREATE TRIGGER on_assignments_update
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS on_visits_update ON public.visits;
CREATE TRIGGER on_visits_update
  BEFORE UPDATE ON public.visits
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Enable RLS for all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
DROP POLICY IF EXISTS "Authenticated users can insert their own user record" ON public.users;
CREATE POLICY "Authenticated users can insert their own user record" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can view their own user record" ON public.users;
CREATE POLICY "Users can view their own user record" ON public.users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Authenticated users can read basic user info for selection" ON public.users;
CREATE POLICY "Authenticated users can read basic user info for selection" ON public.users
  FOR SELECT TO authenticated
  USING (true); -- Allows reading users for dropdowns, refine for production

DROP POLICY IF EXISTS "Users can update their own non-critical user record details" ON public.users;
CREATE POLICY "Users can update their own non-critical user record details" ON public.users
  FOR UPDATE TO authenticated
  USING (auth.uid() = id) -- The row to be updated must be the user's own.
  WITH CHECK (
    auth.uid() = id AND -- The user making the change must be the owner of the row.
    -- These fields cannot be changed by this policy:
    (NEW.email IS NOT DISTINCT FROM OLD.email) AND
    (NEW.role IS NOT DISTINCT FROM OLD.role) AND
    (NEW.reports_to IS NOT DISTINCT FROM OLD.reports_to)
  );
  
DROP POLICY IF EXISTS "CHR can manage any user record (except their own id/email/role)" ON public.users;
CREATE POLICY "CHR can manage any user record (except their own id/email/role)" ON public.users
    FOR UPDATE TO authenticated
    USING (get_my_role() = 'CHR')
    WITH CHECK (
        get_my_role() = 'CHR' AND
        CASE
            WHEN OLD.id = auth.uid() THEN (NEW.email IS NOT DISTINCT FROM OLD.email) AND (NEW.role IS NOT DISTINCT FROM OLD.role) -- CHR cannot change their own email/role via this policy
            ELSE true
        END
    );

DROP POLICY IF EXISTS "Users cannot delete user records (soft delete or admin only)" ON public.users;
CREATE POLICY "Users cannot delete user records (soft delete or admin only)" ON public.users
  FOR DELETE TO authenticated
  USING (false); -- No one can delete directly, implement soft delete or admin function


-- RLS Policies for branches table
DROP POLICY IF EXISTS "Authenticated users can view all branches" ON public.branches;
CREATE POLICY "Authenticated users can view all branches" ON public.branches
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "CHR can manage branches" ON public.branches;
CREATE POLICY "CHR can manage branches" ON public.branches
  FOR ALL TO authenticated -- CHR can INSERT, UPDATE, DELETE
  USING (get_my_role() = 'CHR')
  WITH CHECK (get_my_role() = 'CHR');


-- RLS Policies for assignments table
DROP POLICY IF EXISTS "Authenticated users can view assignments based on hierarchy" ON public.assignments;
CREATE POLICY "Authenticated users can view assignments based on hierarchy" ON public.assignments
  FOR SELECT TO authenticated
  USING (
    (get_my_role() = 'CHR') OR
    (get_my_role() = 'VHR' AND bhr_id IN (
      SELECT u.id FROM users u JOIN users zhr ON u.reports_to = zhr.id WHERE zhr.reports_to = auth.uid() AND u.role = 'BHR'
    )) OR
    (get_my_role() = 'ZHR' AND bhr_id IN (
      SELECT u.id FROM users u WHERE u.reports_to = auth.uid() AND u.role = 'BHR'
    )) OR
    (get_my_role() = 'BHR' AND bhr_id = auth.uid())
  );

DROP POLICY IF EXISTS "ZHRs and CHRs can manage assignments" ON public.assignments;
CREATE POLICY "ZHRs and CHRs can manage assignments" ON public.assignments
  FOR ALL TO authenticated -- INSERT, UPDATE, DELETE
  USING (
    (get_my_role() = 'CHR') OR
    (get_my_role() = 'ZHR' AND bhr_id IN (SELECT u.id FROM users u WHERE u.reports_to = auth.uid() AND u.role = 'BHR')) -- ZHR can manage assignments for BHRs reporting to them
  )
  WITH CHECK (
    (get_my_role() = 'CHR') OR
    (get_my_role() = 'ZHR' AND bhr_id IN (SELECT u.id FROM users u WHERE u.reports_to = auth.uid() AND u.role = 'BHR'))
  );


-- RLS Policies for visits table
DROP POLICY IF EXISTS "Authenticated users can view visits based on hierarchy" ON public.visits;
CREATE POLICY "Authenticated users can view visits based on hierarchy" ON public.visits
  FOR SELECT TO authenticated
  USING (
    (get_my_role() = 'CHR') OR
    (get_my_role() = 'VHR' AND bhr_id IN (
      SELECT u.id FROM users u JOIN users zhr ON u.reports_to = zhr.id WHERE zhr.reports_to = auth.uid() AND u.role = 'BHR'
    )) OR
    (get_my_role() = 'ZHR' AND bhr_id IN (
      SELECT u.id FROM users u WHERE u.reports_to = auth.uid() AND u.role = 'BHR'
    )) OR
    (get_my_role() = 'BHR' AND bhr_id = auth.uid())
  );

DROP POLICY IF EXISTS "BHRs can insert their own visits" ON public.visits;
CREATE POLICY "BHRs can insert their own visits" ON public.visits
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'BHR' AND bhr_id = auth.uid());

DROP POLICY IF EXISTS "BHRs can update their own draft/submitted visits" ON public.visits;
CREATE POLICY "BHRs can update their own draft/submitted visits" ON public.visits
  FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'BHR' AND
    auth.uid() = bhr_id AND
    (OLD.status = 'draft' OR OLD.status = 'submitted') -- Can only update if current status is draft or submitted
  )
  WITH CHECK (
    NEW.bhr_id = OLD.bhr_id AND -- Cannot change the BHR owner
    (NEW.branch_id IS NOT DISTINCT FROM OLD.branch_id) AND -- Cannot change the branch of an existing visit record
    -- BHR can change status from draft to submitted, or keep as draft.
    -- If it was submitted, BHR cannot change status further (approval/rejection by higher role).
    ( (OLD.status = 'draft' AND (NEW.status = 'draft' OR NEW.status = 'submitted')) OR
      (OLD.status = 'submitted' AND NEW.status = 'submitted')
    )
  );

DROP POLICY IF EXISTS "ZHRs/VHRs/CHRs can approve/reject submitted visits in their hierarchy" ON public.visits;
CREATE POLICY "ZHRs/VHRs/CHRs can approve/reject submitted visits in their hierarchy" ON public.visits
  FOR UPDATE TO authenticated
  USING (
    (OLD.status = 'submitted') AND -- only for submitted visits
    (
        (get_my_role() = 'CHR') OR
        (get_my_role() = 'VHR' AND OLD.bhr_id IN (SELECT u.id FROM users u JOIN users zhr ON u.reports_to = zhr.id WHERE zhr.reports_to = auth.uid() AND u.role='BHR')) OR
        (get_my_role() = 'ZHR' AND OLD.bhr_id IN (SELECT u.id FROM users u WHERE u.reports_to = auth.uid() AND u.role='BHR'))
    )
  )
  WITH CHECK (
    (NEW.status = 'approved' OR NEW.status = 'rejected') AND -- can only change to approved or rejected
    OLD.status = 'submitted' AND -- must have been submitted
    (NEW.bhr_id IS NOT DISTINCT FROM OLD.bhr_id) AND -- cannot change owner
    (NEW.branch_id IS NOT DISTINCT FROM OLD.branch_id) -- cannot change branch
  );

DROP POLICY IF EXISTS "CHR can manage any visit (use with caution)" ON public.visits;
CREATE POLICY "CHR can manage any visit (use with caution)" ON public.visits
    FOR ALL TO authenticated
    USING (get_my_role() = 'CHR')
    WITH CHECK (get_my_role() = 'CHR');

DROP POLICY IF EXISTS "Users cannot delete visit records (soft delete or admin only)" ON public.visits;
CREATE POLICY "Users cannot delete visit records (soft delete or admin only)" ON public.visits
  FOR DELETE TO authenticated
  USING (false); -- No one can delete directly


-- Grant usage on schema and default privileges for future objects
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated; -- Base grants, RLS will restrict
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

-- Ensure the get_my_role function can be executed by authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

