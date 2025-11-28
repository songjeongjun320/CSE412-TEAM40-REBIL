-- ============================================================================
-- FIX AUTH SIGNUP TRIGGER & RLS FOR EMAIL SIGNUP
-- - Makes auth user creation trigger idempotent and role-aware
-- - Adds RLS policies to allow service_role inserts from Supabase Auth
-- - Prevents unique violations and RLS blocks causing
--   "Database error saving new user" on signup
-- ============================================================================

BEGIN;

-- 1) Clean up existing trigger/functions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user_profile_only() CASCADE;

-- 2) Robust trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user_profile_only()
RETURNS TRIGGER AS $$
DECLARE
  selected_role_text TEXT;
  selected_role_value user_role_type;
  full_name_text TEXT;
  avatar_url_text TEXT;
BEGIN
  selected_role_text := COALESCE(NEW.raw_user_meta_data->>'selected_role', NULL);
  full_name_text := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name');
  avatar_url_text := NEW.raw_user_meta_data->>'avatar_url';

  -- Create or update user profile from auth data (idempotent)
  INSERT INTO public.user_profiles (id, email, full_name, profile_image_url)
  VALUES (
    NEW.id,
    NEW.email,
    full_name_text,
    avatar_url_text
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.user_profiles.full_name),
        profile_image_url = COALESCE(EXCLUDED.profile_image_url, public.user_profiles.profile_image_url),
        updated_at = NOW();

  -- Role assignment rules
  IF selected_role_text IS NOT NULL THEN
    selected_role_value := selected_role_text::user_role_type;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, selected_role_value)
    ON CONFLICT (user_id, role) DO NOTHING;

    -- If HOST is chosen, also ensure RENTER exists
    IF selected_role_value = 'HOST'::user_role_type THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'RENTER')
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  ELSE
    -- Default: ensure RENTER exists (covers plain email signups without metadata)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'RENTER')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3) Re-create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile_only();

-- 4) RLS: allow Supabase service role to insert during signup trigger
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_profiles' AND policyname = 'Service role can insert profiles'
  ) THEN
    CREATE POLICY "Service role can insert profiles"
    ON public.user_profiles
    FOR INSERT TO service_role
    WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_roles' AND policyname = 'Service role can insert user roles'
  ) THEN
    CREATE POLICY "Service role can insert user roles"
    ON public.user_roles
    FOR INSERT TO service_role
    WITH CHECK (true);
  END IF;
END $$;

COMMIT;

-- Verification
SELECT 'Signup trigger and RLS updated' AS status;


