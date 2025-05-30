
-- Create custom ENUM types
DROP TYPE IF EXISTS public.user_role_enum CASCADE;
CREATE TYPE public.user_role_enum AS ENUM ('BHR', 'ZHR', 'VHR', 'CHR');

DROP TYPE IF EXISTS public.visit_status_enum CASCADE;
CREATE TYPE public.visit_status_enum AS ENUM ('draft', 'submitted', 'approved', 'rejected');

DROP TYPE IF EXISTS public.qualitative_assessment_enum CASCADE;
CREATE TYPE public.qualitative_assessment_enum AS ENUM ('yes', 'no');

-- Auto-update 'updated_at' column
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- USERS Table
DROP TABLE IF EXISTS public.users CASCADE;
CREATE TABLE public.users (
  id UUID NOT NULL PRIMARY KEY, -- References auth.users.id
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role public.user_role_enum NOT NULL,
  e_code TEXT,
  location TEXT,
  reports_to UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TRIGGER on_users_updated
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- BRANCHES Table
DROP TABLE IF EXISTS public.branches CASCADE;
CREATE TABLE public.branches (
  id uuid not null default gen_random_uuid (),
  name text not null,
  location text not null,
  category text not null,
  code text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint branches_pkey primary key (id),
  constraint branches_code_key unique (code)
);
CREATE TRIGGER on_branches_updated
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ASSIGNMENTS Table (BHR to Branch mapping)
DROP TABLE IF EXISTS public.assignments CASCADE;
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bhr_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (bhr_id, branch_id) -- Ensure a BHR isn't assigned to the same branch multiple times
);
CREATE TRIGGER on_assignments_updated
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- VISITS Table
DROP TABLE IF EXISTS public.visits CASCADE;
CREATE TABLE public.visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bhr_id UUID NOT NULL REFERENCES public.users(id),
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  visit_date TIMESTAMPTZ NOT NULL,
  status public.visit_status_enum DEFAULT 'draft',
  hr_connect_conducted BOOLEAN DEFAULT false,
  hr_connect_employees_invited INT CHECK (hr_connect_employees_invited IS NULL OR hr_connect_employees_invited >= 0),
  hr_connect_participants INT CHECK (hr_connect_participants IS NULL OR hr_connect_participants >= 0),
  manning_percentage NUMERIC(5,2) CHECK (manning_percentage IS NULL OR (manning_percentage >= 0 AND manning_percentage <= 100)),
  attrition_percentage NUMERIC(5,2) CHECK (attrition_percentage IS NULL OR (attrition_percentage >= 0 AND attrition_percentage <= 100)),
  non_vendor_percentage NUMERIC(5,2) CHECK (non_vendor_percentage IS NULL OR (non_vendor_percentage >= 0 AND non_vendor_percentage <= 100)),
  er_percentage NUMERIC(5,2) CHECK (er_percentage IS NULL OR (er_percentage >= 0 AND er_percentage <= 100)),
  cwt_cases INT CHECK (cwt_cases IS NULL OR cwt_cases >= 0),
  performance_level TEXT,
  new_employees_total INT CHECK (new_employees_total IS NULL OR new_employees_total >= 0),
  new_employees_covered INT CHECK (new_employees_covered IS NULL OR new_employees_covered >= 0),
  star_employees_total INT CHECK (star_employees_total IS NULL OR star_employees_total >= 0),
  star_employees_covered INT CHECK (star_employees_covered IS NULL OR star_employees_covered >= 0),
  qual_aligned_conduct public.qualitative_assessment_enum,
  qual_safe_secure public.qualitative_assessment_enum,
  qual_motivated public.qualitative_assessment_enum,
  qual_abusive_language public.qualitative_assessment_enum,
  qual_comfortable_escalate public.qualitative_assessment_enum,
  qual_inclusive_culture public.qualitative_assessment_enum,
  additional_remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT chk_participants_not_exceed_invited CHECK (hr_connect_participants IS NULL OR hr_connect_employees_invited IS NULL OR hr_connect_participants <= hr_connect_employees_invited),
  CONSTRAINT chk_new_employees_covered_not_exceed_total CHECK (new_employees_covered IS NULL OR new_employees_total IS NULL OR new_employees_covered <= new_employees_total),
  CONSTRAINT chk_star_employees_covered_not_exceed_total CHECK (star_employees_covered IS NULL OR star_employees_total IS NULL OR star_employees_covered <= star_employees_total)
);
CREATE TRIGGER on_visits_updated
  BEFORE UPDATE ON public.visits
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

--------------------------------------------------------------------------------
-- Row Level Security (RLS)
--------------------------------------------------------------------------------

-- Helper function to get the role of the current authenticated user
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role_enum
LANGUAGE plpgsql
SECURITY DEFINER
SET LOCAL search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  ELSE
    -- Ensure the user exists in public.users, otherwise this select might fail or return null incorrectly
    -- This assumes that a user record in public.users is created upon signup.
    RETURN (SELECT role FROM users WHERE id = auth.uid());
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;


-- RLS for USERS table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own user record" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can read basic user info for selection" ON public.users;
DROP POLICY IF EXISTS "CHR can view all user records" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can insert their own user record" ON public.users; -- This is key for signup
DROP POLICY IF EXISTS "Users can update their own non-critical user record info" ON public.users;
DROP POLICY IF EXISTS "CHR can update any user record" ON public.users;
DROP POLICY IF EXISTS "CHR can delete any user record" ON public.users;

-- For signup, this allows the authenticated user (just created in auth.users) to insert their profile into public.users.
-- Ensure "Enable email confirmations" is OFF in Supabase Auth settings for easier development, otherwise, this might fail
-- until the email is confirmed because auth.uid() might not resolve as expected or role might be anon.
CREATE POLICY "Authenticated users can insert their own user record"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = NEW.id); -- NEW.id is the id being inserted

CREATE POLICY "Users can view their own user record"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Authenticated users can read basic user info for selection"
  ON public.users FOR SELECT
  TO authenticated
  USING (true); -- Necessary for "Reports To" dropdowns. Restrict columns in your app's queries.

CREATE POLICY "CHR can view all user records"
  ON public.users FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'CHR');

CREATE POLICY "Users can update their own non-critical user record info"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    NEW.email IS NOT DISTINCT FROM OLD.email AND -- Don't allow changing email via this policy
    NEW.role IS NOT DISTINCT FROM OLD.role AND   -- Don't allow changing role
    NEW.reports_to IS NOT DISTINCT FROM OLD.reports_to -- Don't allow changing reports_to
    -- Allow changing name, e_code, location
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


-- RLS for BRANCHES table
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


-- RLS for ASSIGNMENTS table
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
    NEW.bhr_id IN (SELECT id FROM public.users WHERE reports_to = auth.uid() AND role = 'BHR')
    -- Additional check: ensure branch_id is valid and perhaps within ZHR's zone if that logic exists
  );

CREATE POLICY "CHR can manage all assignments"
  ON public.assignments FOR ALL
  TO authenticated
  USING (public.get_my_role() = 'CHR')
  WITH CHECK (public.get_my_role() = 'CHR');


-- RLS for VISITS table
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits FORCE ROW LEVEL SECURITY;

-- Drop old policies for visits table to apply new ones cleanly
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
  WITH CHECK (
    public.get_my_role() = 'BHR' AND
    NEW.bhr_id = auth.uid() AND
    NEW.status IN ('draft', 'submitted')
  );

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
  USING (
    public.get_my_role() = 'ZHR' AND
    bhr_id IN (SELECT id FROM public.users WHERE reports_to = auth.uid() AND role = 'BHR') AND
    OLD.status = 'submitted'
  )
  WITH CHECK (
    public.get_my_role() = 'ZHR' AND
    NEW.status IN ('approved', 'rejected') AND OLD.status = 'submitted' AND
    NEW.bhr_id IS NOT DISTINCT FROM OLD.bhr_id AND
    NEW.branch_id IS NOT DISTINCT FROM OLD.branch_id AND
    NEW.visit_date IS NOT DISTINCT FROM OLD.visit_date
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
  USING (
    public.get_my_role() = 'VHR' AND
    bhr_id IN (
      SELECT bhr.id FROM public.users bhr
      JOIN public.users zhr ON bhr.reports_to = zhr.id
      WHERE zhr.reports_to = auth.uid() AND bhr.role = 'BHR' AND zhr.role = 'ZHR'
    ) AND
    OLD.status IN ('submitted', 'approved')
  )
  WITH CHECK (
    public.get_my_role() = 'VHR' AND
    NEW.status IN ('approved', 'rejected') AND OLD.status IN ('submitted', 'approved') AND
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

-- Grant basic permissions (RLS will further restrict)
-- Note: Supabase handles default grants for 'anon' and 'authenticated' roles.
-- These are just examples if you needed more explicit control.
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO authenticated;


--------------------------------------------------------------------------------
-- Seed Data
--------------------------------------------------------------------------------

-- Seed Data for Branches
-- You should generate UUIDs for 'id' or let the default gen_random_uuid() work if you omit the id column in INSERTs.
-- For consistency with mock data if you've hardcoded UUIDs elsewhere, you might want to specify them.
-- Using default gen_random_uuid() for simplicity here.

INSERT INTO public.branches (name, location, category, code) VALUES
('North Star Branch', 'New York', 'Metro Tier A', 'NY001'),
('Southern Cross Branch', 'Los Angeles', 'Metro Tier A', 'LA001'),
('East Gate Branch', 'Chicago', 'Metro Tier B', 'CH001'),
('West End Branch', 'Houston', 'Urban Tier A', 'HO001'),
('Central Hub', 'Phoenix', 'Urban Tier B', 'PH001'),
('Metro Point', 'Philadelphia', 'Metro Tier B', 'PL001')
ON CONFLICT (code) DO NOTHING; -- Avoid errors if script is run multiple times and codes exist

-- Note: Seeding users, assignments, and visits would require knowing the UUIDs generated for users and branches.
-- It's often best to create initial CHR/VHR/ZHR users through your application's signup process first.
-- Then, use the application to create BHRs, assign them to branches, and log visits.
-- Or, if you need complex seed data, write a separate script that queries existing IDs.

-- Example of how you might seed a CHR user if you knew their auth.uid()
-- Assuming you manually signed up a CHR with email 'alice@hrview.com' and got their auth.uid()
-- INSERT INTO public.users (id, name, email, role) VALUES
-- ('<alice_auth_uid_here>', 'Alice Wonderland', 'alice@hrview.com', 'CHR')
-- ON CONFLICT (email) DO NOTHING;
-- (Repeat for VHR, ZHR, BHR to build a hierarchy for testing)

