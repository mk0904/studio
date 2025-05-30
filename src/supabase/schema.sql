
-- Stop on error
-- \set ON_ERROR_STOP on

-- Function to get current user's app role
DROP FUNCTION IF EXISTS public.get_my_role();
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE; -- MODIFIED HERE

-- Drop existing policies and tables in reverse order of creation due to dependencies
-- Drop policies first
DO $$
DECLARE
    policy_record RECORD;
    table_name_text TEXT;
BEGIN
    FOR table_name_text IN
        SELECT unnest(ARRAY['visits', 'assignments', 'branches', 'users'])
    LOOP
        FOR policy_record IN
            SELECT policyname FROM pg_policies WHERE tablename = table_name_text AND schemaname = 'public'
        LOOP
            EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON public."' || table_name_text || '";';
        END LOOP;
    END LOOP;
END $$;

-- Drop tables
DROP TABLE IF EXISTS public.visits CASCADE;
DROP TABLE IF EXISTS public.assignments CASCADE;
DROP TABLE IF EXISTS public.branches CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Drop ENUM types
DROP TYPE IF EXISTS public.qualitative_assessment_enum CASCADE;
DROP TYPE IF EXISTS public.visit_status_enum CASCADE;
DROP TYPE IF EXISTS public.user_role_enum CASCADE;


-- Create ENUM types
CREATE TYPE public.user_role_enum AS ENUM ('BHR', 'ZHR', 'VHR', 'CHR');
CREATE TYPE public.visit_status_enum AS ENUM ('draft', 'submitted', 'approved', 'rejected');
CREATE TYPE public.qualitative_assessment_enum AS ENUM ('yes', 'no');

-- Create a function to automatically update 'updated_at'
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
COMMENT ON FUNCTION public.handle_updated_at() IS 'Sets updated_at to current_timestamp on row update';

-- users Table
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid() REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role public.user_role_enum NOT NULL,
    e_code TEXT,
    location TEXT,
    reports_to UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Manager's user ID
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.users IS 'Stores user profiles and their roles within the HR hierarchy.';
COMMENT ON COLUMN public.users.reports_to IS 'ID of the user this user reports to.';

CREATE TRIGGER on_users_updated
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function to get current user's app role from public.users
-- Ensures it looks in the public schema.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role_enum
LANGUAGE plpgsql
SECURITY DEFINER
SET LOCAL search_path = public
AS $$
DECLARE
    my_role public.user_role_enum;
BEGIN
    SELECT role INTO my_role FROM users WHERE id = auth.uid();
    RETURN my_role;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        -- This can happen if the user exists in auth.users but not in public.users yet
        -- (e.g., during the signup transaction before the public.users insert completes)
        -- Or if called in a context where auth.uid() is null (e.g. by anon role if policy allows)
        RETURN NULL;
    WHEN OTHERS THEN
        -- Log other errors if necessary, but for RLS, returning NULL is safest if role can't be determined.
        RAISE WARNING 'Error in get_my_role(): %', SQLERRM;
        RETURN NULL;
END;
$$;
COMMENT ON FUNCTION public.get_my_role() IS 'Retrieves the application-specific role of the currently authenticated user from the public.users table.';


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
COMMENT ON TABLE public.branches IS 'Stores details of various company branches.';

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
COMMENT ON TABLE public.assignments IS 'Assigns BHRs to specific branches. Enforces unique assignment of a BHR to a branch.';

CREATE TRIGGER on_assignments_updated
BEFORE UPDATE ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- visits Table
CREATE TABLE public.visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bhr_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    visit_date TIMESTAMPTZ NOT NULL,
    status public.visit_status_enum DEFAULT 'draft'::public.visit_status_enum,
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
    CONSTRAINT chk_hr_connect_participants CHECK (hr_connect_participants IS NULL OR hr_connect_employees_invited IS NULL OR hr_connect_participants <= hr_connect_employees_invited),
    CONSTRAINT chk_new_employees_covered CHECK (new_employees_covered IS NULL OR new_employees_total IS NULL OR new_employees_covered <= new_employees_total),
    CONSTRAINT chk_star_employees_covered CHECK (star_employees_covered IS NULL OR star_employees_total IS NULL OR star_employees_covered <= star_employees_total)
);
COMMENT ON TABLE public.visits IS 'Logs details of HR visits to branches, including metrics and qualitative assessments.';

CREATE TRIGGER on_visits_updated
BEFORE UPDATE ON public.visits
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Apply Row Level Security (RLS)
-- USERS Table RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
-- Users can insert their own profile (id must match auth.uid())
CREATE POLICY "Authenticated users can insert their own user record" ON public.users FOR INSERT TO authenticated WITH CHECK (auth.uid() = id AND auth.role() = 'authenticated');
-- Users can view their own user record
CREATE POLICY "Users can view their own user record" ON public.users FOR SELECT TO authenticated USING (auth.uid() = id);
-- Authenticated users can read basic user info for selection (e.g., for 'reports_to' dropdowns)
CREATE POLICY "Authenticated users can read basic user info for selection" ON public.users FOR SELECT TO authenticated USING (true);
-- Users can update their own record, but not critical fields like email, role, reports_to through general update
CREATE POLICY "Users can update their own user record" ON public.users FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id AND
        NEW.email IS NOT DISTINCT FROM OLD.email AND -- Disallow email change via this policy
        NEW.role IS NOT DISTINCT FROM OLD.role AND   -- Disallow role change via this policy
        NEW.reports_to IS NOT DISTINCT FROM OLD.reports_to -- Disallow manager change
    );
-- CHR can manage all user records (excluding their own ID, email, role to prevent self-lockout on error)
CREATE POLICY "CHR can manage all user records" ON public.users FOR ALL TO authenticated
    USING (public.get_my_role() = 'CHR')
    WITH CHECK (
        public.get_my_role() = 'CHR' AND
        (NEW.id = OLD.id OR OLD.id IS NULL) AND -- Prevent changing user ID
        (NEW.email IS NOT DISTINCT FROM OLD.email OR OLD.email IS NULL) -- Allow CHR to set initial email if new, but not change existing
        -- CHR might need to change role or reports_to; specific policies for that are better.
        -- This basic policy allows CHR to update other fields like name, e_code, location for any user.
        -- More granular checks for role/reports_to changes by CHR could be added.
    );

-- BRANCHES Table RLS
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
-- Authenticated users can view all branches (common scenario for selection)
CREATE POLICY "Authenticated users can view all branches" ON public.branches FOR SELECT TO authenticated USING (true);
-- Only CHR (or specific admin role later) can create/update/delete branches
CREATE POLICY "CHR can manage branches" ON public.branches FOR ALL TO authenticated
    USING (public.get_my_role() = 'CHR')
    WITH CHECK (public.get_my_role() = 'CHR');

-- ASSIGNMENTS Table RLS
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
-- BHRs can see their own assignments
CREATE POLICY "BHRs can see their own assignments" ON public.assignments FOR SELECT TO authenticated
    USING (bhr_id = auth.uid() AND public.get_my_role() = 'BHR');
-- ZHRs can see assignments of BHRs who report to them
CREATE POLICY "ZHRs can see assignments in their zone" ON public.assignments FOR SELECT TO authenticated
    USING (
        public.get_my_role() = 'ZHR' AND
        EXISTS (
            SELECT 1 FROM public.users bhr_user
            WHERE bhr_user.id = public.assignments.bhr_id AND bhr_user.reports_to = auth.uid() AND bhr_user.role = 'BHR'
        )
    );
-- VHRs can see assignments in their vertical
CREATE POLICY "VHRs can see assignments in their vertical" ON public.assignments FOR SELECT TO authenticated
    USING (
        public.get_my_role() = 'VHR' AND
        EXISTS (
            SELECT 1 FROM public.users bhr_user
            JOIN public.users zhr_user ON bhr_user.reports_to = zhr_user.id
            WHERE bhr_user.id = public.assignments.bhr_id AND zhr_user.reports_to = auth.uid() AND zhr_user.role = 'ZHR' AND bhr_user.role = 'BHR'
        )
    );
-- CHR can see all assignments
CREATE POLICY "CHR can see all assignments" ON public.assignments FOR SELECT TO authenticated
    USING (public.get_my_role() = 'CHR');
-- ZHRs can create/delete assignments for BHRs who report to them
CREATE POLICY "ZHRs can manage assignments in their zone" ON public.assignments FOR ALL TO authenticated
    USING (
        public.get_my_role() = 'ZHR' AND
        EXISTS (
            SELECT 1 FROM public.users bhr_user
            WHERE bhr_user.id = public.assignments.bhr_id AND bhr_user.reports_to = auth.uid() AND bhr_user.role = 'BHR'
        )
    )
    WITH CHECK (
        public.get_my_role() = 'ZHR' AND
        EXISTS (
            SELECT 1 FROM public.users bhr_user
            WHERE bhr_user.id = public.assignments.bhr_id AND bhr_user.reports_to = auth.uid() AND bhr_user.role = 'BHR'
        )
    );
-- CHR can manage all assignments
CREATE POLICY "CHR can manage all assignments" ON public.assignments FOR ALL TO authenticated
    USING (public.get_my_role() = 'CHR')
    WITH CHECK (public.get_my_role() = 'CHR');


-- VISITS Table RLS
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
-- BHRs can manage their own visits
CREATE POLICY "BHRs can manage their own visits" ON public.visits FOR ALL TO authenticated
    USING (bhr_id = auth.uid() AND public.get_my_role() = 'BHR')
    WITH CHECK (
        bhr_id = auth.uid() AND public.get_my_role() = 'BHR' AND
        (OLD.status IS NULL OR -- New insert
         (OLD.status = 'draft'::public.visit_status_enum AND NEW.status IN ('draft'::public.visit_status_enum, 'submitted'::public.visit_status_enum)) OR -- Draft can be saved or submitted
         (OLD.status = 'submitted'::public.visit_status_enum AND NEW.status = 'submitted'::public.visit_status_enum) -- Submitted can be resaved if allowed
        )
    );
-- ZHRs can view visits of BHRs who report to them
CREATE POLICY "ZHRs can view visits in their zone" ON public.visits FOR SELECT TO authenticated
    USING (
        public.get_my_role() = 'ZHR' AND
        EXISTS (
            SELECT 1 FROM public.users bhr_user
            WHERE bhr_user.id = public.visits.bhr_id AND bhr_user.reports_to = auth.uid() AND bhr_user.role = 'BHR'
        )
    );
-- ZHRs can approve/reject submitted visits of BHRs who report to them
CREATE POLICY "ZHRs can approve or reject visits in their zone" ON public.visits FOR UPDATE TO authenticated
    USING (
        public.get_my_role() = 'ZHR' AND
        EXISTS (
            SELECT 1 FROM public.users bhr_user
            WHERE bhr_user.id = public.visits.bhr_id AND bhr_user.reports_to = auth.uid() AND bhr_user.role = 'BHR'
        ) AND OLD.status = 'submitted'::public.visit_status_enum
    )
    WITH CHECK (
        public.get_my_role() = 'ZHR' AND
        EXISTS (
            SELECT 1 FROM public.users bhr_user
            WHERE bhr_user.id = public.visits.bhr_id AND bhr_user.reports_to = auth.uid() AND bhr_user.role = 'BHR'
        ) AND OLD.status = 'submitted'::public.visit_status_enum AND NEW.status IN ('approved'::public.visit_status_enum, 'rejected'::public.visit_status_enum)
        -- Ensure ZHR cannot change other visit details during approval/rejection other than status
        AND NEW.bhr_id IS NOT DISTINCT FROM OLD.bhr_id
        AND NEW.branch_id IS NOT DISTINCT FROM OLD.branch_id
        AND NEW.visit_date IS NOT DISTINCT FROM OLD.visit_date
        -- ... add other immutable fields during ZHR approval action
        AND NEW.additional_remarks IS NOT DISTINCT FROM OLD.additional_remarks
    );
-- VHRs can view visits in their vertical
CREATE POLICY "VHRs can view visits in their vertical" ON public.visits FOR SELECT TO authenticated
    USING (
        public.get_my_role() = 'VHR' AND
        EXISTS (
            SELECT 1 FROM public.users bhr_user
            JOIN public.users zhr_user ON bhr_user.reports_to = zhr_user.id
            WHERE bhr_user.id = public.visits.bhr_id AND zhr_user.reports_to = auth.uid() AND zhr_user.role = 'ZHR' AND bhr_user.role = 'BHR'
        )
    );
-- CHR can view all visits
CREATE POLICY "CHR can view all visits" ON public.visits FOR SELECT TO authenticated
    USING (public.get_my_role() = 'CHR');
-- CHR can potentially update any visit (e.g., for corrections or administrative overrides)
CREATE POLICY "CHR can manage all visits" ON public.visits FOR UPDATE TO authenticated
    USING (public.get_my_role() = 'CHR')
    WITH CHECK (public.get_my_role() = 'CHR');
-- CHR can delete any visit (use with caution)
CREATE POLICY "CHR can delete visits" ON public.visits FOR DELETE TO authenticated
    USING (public.get_my_role() = 'CHR');


-- Grant basic usage on schema and sequences to roles
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL ON FUNCTION public.handle_updated_at() TO postgres, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.get_my_role() TO postgres, anon, authenticated, service_role;

-- Grant basic permissions on tables. RLS will further restrict access.
GRANT ALL ON TABLE public.users TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users TO authenticated;

GRANT ALL ON TABLE public.branches TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.branches TO authenticated;

GRANT ALL ON TABLE public.assignments TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.assignments TO authenticated;

GRANT ALL ON TABLE public.visits TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.visits TO authenticated;

-- Ensure future tables and sequences inherit these permissions for the service_role (useful for migrations)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO authenticated; -- Or SELECT, UPDATE if needed
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;

COMMENT ON SCHEMA public IS 'Standard public schema';

      