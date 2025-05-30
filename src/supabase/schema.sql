-- Create ENUM types
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
        CREATE TYPE user_role_enum AS ENUM ('BHR', 'ZHR', 'VHR', 'CHR');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'visit_status_enum') THEN
        CREATE TYPE visit_status_enum AS ENUM ('draft', 'submitted', 'approved', 'rejected');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'qualitative_assessment_enum') THEN
        CREATE TYPE qualitative_assessment_enum AS ENUM ('yes', 'no');
    END IF;
END
$$;

-- USERS Table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role user_role_enum NOT NULL,
    e_code TEXT,
    location TEXT,
    reports_to UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Can be NULL if CHR or top-level
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._+%-]+@[A-Za-z0-9.-]+[.][A-Za-z]+$'),
    CONSTRAINT name_length CHECK (char_length(name) >= 2)
);
COMMENT ON TABLE public.users IS 'Stores user profile information, extending auth.users.';
COMMENT ON COLUMN public.users.reports_to IS 'ID of the user this user reports to (manager).';

-- BRANCHES Table
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    category TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT code_format CHECK (char_length(code) > 0), -- Example: Ensure code is not empty
    CONSTRAINT name_unique_per_location UNIQUE (name, location) -- Example: Branch name unique per location
);
COMMENT ON TABLE public.branches IS 'Stores information about various company branches.';

-- ASSIGNMENTS Table (Join table for BHRs and Branches)
CREATE TABLE IF NOT EXISTS public.assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bhr_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_bhr_branch_assignment UNIQUE (bhr_id, branch_id)
);
COMMENT ON TABLE public.assignments IS 'Assigns BHR users to specific branches.';

-- VISITS Table
CREATE TABLE IF NOT EXISTS public.visits (
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
    new_employees_covered INTEGER CHECK (new_employees_covered IS NULL OR new_employees_total IS NULL OR new_employees_covered <= new_employees_total),
    star_employees_total INTEGER CHECK (star_employees_total IS NULL OR star_employees_total >= 0),
    star_employees_covered INTEGER CHECK (star_employees_covered IS NULL OR star_employees_total IS NULL OR star_employees_covered <= star_employees_total),
    qual_aligned_conduct qualitative_assessment_enum,
    qual_safe_secure qualitative_assessment_enum,
    qual_motivated qualitative_assessment_enum,
    qual_abusive_language qualitative_assessment_enum,
    qual_comfortable_escalate qualitative_assessment_enum,
    qual_inclusive_culture qualitative_assessment_enum,
    additional_remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT check_participants_not_exceed_invited CHECK (hr_connect_participants IS NULL OR hr_connect_employees_invited IS NULL OR hr_connect_participants <= hr_connect_employees_invited),
    CONSTRAINT check_new_employees_covered CHECK (new_employees_covered IS NULL OR new_employees_total IS NULL OR new_employees_covered <= new_employees_total),
    CONSTRAINT check_star_employees_covered CHECK (star_employees_covered IS NULL OR star_employees_total IS NULL OR star_employees_covered <= star_employees_total)
);
COMMENT ON TABLE public.visits IS 'Records details of HR visits to branches.';

-- Trigger function to update 'updated_at' columns
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables
DO $$
DECLARE
    t_name TEXT;
BEGIN
    FOR t_name IN SELECT table_name FROM information_schema.columns WHERE column_name = 'updated_at' AND table_schema = 'public'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS on_%s_updated_at ON public.%I;', t_name, t_name);
        EXECUTE format('CREATE TRIGGER on_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();', t_name, t_name);
    END LOOP;
END
$$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_reports_to ON public.users(reports_to);
CREATE INDEX IF NOT EXISTS idx_assignments_bhr_id ON public.assignments(bhr_id);
CREATE INDEX IF NOT EXISTS idx_assignments_branch_id ON public.assignments(branch_id);
CREATE INDEX IF NOT EXISTS idx_visits_bhr_id ON public.visits(bhr_id);
CREATE INDEX IF NOT EXISTS idx_visits_branch_id ON public.visits(branch_id);
CREATE INDEX IF NOT EXISTS idx_visits_visit_date ON public.visits(visit_date);

--------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
--------------------------------------------------------------------------------

-- USERS table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies on users table before recreating
DROP POLICY IF EXISTS "Authenticated users can insert their own user record" ON public.users;
DROP POLICY IF EXISTS "Users can view their own user record" ON public.users;
DROP POLICY IF EXISTS "Users can update their own user record" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can read basic user info for selection" ON public.users;

-- Policy for inserting own user record (profile creation)
CREATE POLICY "Authenticated users can insert their own user record"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id AND auth.role() = 'authenticated');

-- Policy for users to view their own record
CREATE POLICY "Users can view their own user record"
ON public.users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Policy for users to update their own record
-- Allows users to update their name, e_code, location. Email, role, reports_to are protected.
CREATE POLICY "Users can update their own user record"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id AND email = OLD.email AND role = OLD.role AND reports_to = OLD.reports_to);

-- Policy for authenticated users to read basic user info (id, name, role, email)
-- This is necessary for features like "Reports To" dropdowns.
-- Be cautious with this in production; you might want to restrict columns or rows further based on hierarchy.
CREATE POLICY "Authenticated users can read basic user info for selection"
ON public.users
FOR SELECT
TO authenticated
USING (true);


-- BRANCHES table
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
-- For now, allow all authenticated users to read branches. Writes might be restricted to CHR/Admin roles later.
DROP POLICY IF EXISTS "Authenticated users can view branches" ON public.branches;
CREATE POLICY "Authenticated users can view branches"
ON public.branches
FOR SELECT
TO authenticated
USING (true);
-- Add INSERT/UPDATE/DELETE policies for branches later, likely restricted to admin roles.


-- ASSIGNMENTS table
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
-- BHRs can't see all assignments. ZHRs/VHRs/CHRs would need policies to see assignments in their hierarchy.
-- For now, a BHR can see their own assignments.
DROP POLICY IF EXISTS "BHRs can view their own assignments" ON public.assignments;
CREATE POLICY "BHRs can view their own assignments"
ON public.assignments
FOR SELECT
TO authenticated
USING (bhr_id = auth.uid());
-- ZHRs should be able to manage assignments for BHRs reporting to them.
-- CHR/Admin would manage all. Add these policies as needed.
-- Example: Allow insert for now by authenticated (will be refined by ZHR roles)
DROP POLICY IF EXISTS "Authenticated can insert assignments" ON public.assignments;
CREATE POLICY "Authenticated can insert assignments" -- To be refined by ZHR role
ON public.assignments
FOR INSERT
TO authenticated
WITH CHECK (true); -- This needs to be locked down to ZHRs for their BHRs
DROP POLICY IF EXISTS "Authenticated can delete assignments" ON public.assignments;
CREATE POLICY "Authenticated can delete assignments" -- To be refined by ZHR role
ON public.assignments
FOR DELETE
TO authenticated
USING (true); -- This needs to be locked down


-- VISITS table
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
-- BHRs can manage their own visits.
DROP POLICY IF EXISTS "BHRs can manage their own visits" ON public.visits;
CREATE POLICY "BHRs can manage their own visits"
ON public.visits
FOR ALL -- Covers SELECT, INSERT, UPDATE, DELETE
TO authenticated
USING (bhr_id = auth.uid())
WITH CHECK (bhr_id = auth.uid());

-- Hierarchical reads for ZHR/VHR/CHR will need more complex policies.
-- Example: Allow all authenticated to read all visits for now (for dashboards).
-- THIS IS INSECURE FOR PRODUCTION but helps initial dashboard setup.
DROP POLICY IF EXISTS "Authenticated users can view all visits FOR NOW" ON public.visits;
CREATE POLICY "Authenticated users can view all visits FOR NOW"
ON public.visits
FOR SELECT
TO authenticated
USING (true);

-- Note: Hierarchical RLS (e.g., a ZHR seeing all visits from BHRs who report to them)
-- often requires creating helper functions in SQL that check the user hierarchy, or more complex USING clauses.
-- Example structure for a ZHR to see visits of their BHRs:
-- USING (
--   EXISTS (
--     SELECT 1
--     FROM public.users bhr_user
--     WHERE bhr_user.id = bhr_id AND bhr_user.reports_to = auth.uid() AND (SELECT role FROM public.users WHERE id = auth.uid()) = 'ZHR'
--   )
-- )
-- This would be part of a separate policy for ZHRs.

GRANT ALL ON ALL TABLES IN SCHEMA public TO supabase_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO supabase_admin;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO supabase_admin;

GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;


ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON TYPES TO authenticated, service_role;

-- Ensure the 'authenticated' role has permissions on the auth schema (usually default but good to check)
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT ON auth.users TO authenticated;

-- The `reports_to` column in the `users` table might also need its own `ON DELETE SET NULL` if a manager user is deleted.
-- The current schema uses `ON DELETE SET NULL` for `reports_to`.
-- `ON DELETE CASCADE` for `users.id` in `visits` and `assignments` means if a user is deleted, their visits/assignments are also deleted.
-- `ON DELETE CASCADE` for `branches.id` means if a branch is deleted, its visits/assignments are also deleted.
-- Consider if `SET NULL` would be more appropriate for some of these FKs depending on business logic.
