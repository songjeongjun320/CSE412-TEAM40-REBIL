-- STEP 4: UPDATE AUTH TRIGGER TO SUPPORT ROLE SELECTION
-- Modify trigger to support role selection for OAuth login

-- Remove existing trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create new function: Create profile only without automatic role assignment
CREATE OR REPLACE FUNCTION public.handle_new_user_profile_only()
RETURNS TRIGGER AS $$
BEGIN
  -- Create user profile only (role to be selected separately)
  INSERT INTO public.user_profiles (id, email, full_name, profile_image_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  
  -- Assign default RENTER role only for regular signup (email/password)
  -- For OAuth, assign role based on selected_role metadata
  IF NEW.raw_user_meta_data->>'selected_role' IS NOT NULL THEN
    -- When there's a selected role (regular signup)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, (NEW.raw_user_meta_data->>'selected_role')::user_role_type);
    
    -- If HOST is selected, also add RENTER role (HOST can also be RENTER by default)
    IF NEW.raw_user_meta_data->>'selected_role' = 'HOST' THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'RENTER');
    END IF;
  ELSE
    -- For OAuth login, don't assign role (handled on separate selection page)
    NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile_only();

-- Add helper function for role selection
CREATE OR REPLACE FUNCTION public.assign_user_role_after_selection(
  user_uuid UUID,
  selected_role user_role_type
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Add selected role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (user_uuid, selected_role);
  
  -- If HOST is selected, also add RENTER role
  IF selected_role = 'HOST' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (user_uuid, 'RENTER')
    ON CONFLICT (user_id, role) DO NOTHING; -- Ignore if already exists
  END IF;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policy: Allow HOST role selection
DROP POLICY IF EXISTS "Users can insert their default renter role" ON user_roles;

-- Modify policy to allow users to insert all their own roles
CREATE POLICY "Users can insert their own roles" ON user_roles
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Verification query
SELECT 
  'AUTH TRIGGER AND RLS POLICY UPDATED SUCCESSFULLY!' as status,
  'OAuth users can now select HOST or RENTER role' as message;