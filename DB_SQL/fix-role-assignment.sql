-- Fix role assignment policy to allow users to select HOST or RENTER roles

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can insert their default renter role" ON public.user_roles;

-- Create a more flexible policy that allows users to assign themselves HOST or RENTER roles
CREATE POLICY "Users can assign themselves HOST or RENTER roles" ON public.user_roles
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    AND role IN ('HOST', 'RENTER')
  );

-- Also allow users to update their own roles (switch between HOST and RENTER)
CREATE POLICY "Users can update their own roles" ON public.user_roles
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id 
    AND role IN ('HOST', 'RENTER')
  );

-- Verification
SELECT 'Role assignment policy updated!' as status;