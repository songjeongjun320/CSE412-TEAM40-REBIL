SELECT public.check_storage_bucket_status();
-- STEP 9: STORAGE POLICIES SETUP FOR VEHICLE IMAGES
-- This script provides instructions for setting up storage policies
-- Note: Storage policies must be created manually through Supabase Dashboard

-- ============================================================================
-- IMPORTANT: MANUAL SETUP REQUIRED
-- ============================================================================
-- Storage policies cannot be created via SQL commands
-- You must set them up manually in Supabase Dashboard

-- ============================================================================
-- SETUP INSTRUCTIONS
-- ============================================================================

-- STEP 1: Go to Supabase Dashboard
-- 1. Open your Supabase project dashboard
-- 2. Navigate to Storage → vehicle-images bucket
-- 3. Click on "Policies" tab

-- STEP 2: Create the following 4 policies manually

-- ============================================================================
-- POLICY 1: Allow authenticated users to upload images
-- ============================================================================
-- Policy Name: "Allow authenticated users to upload vehicle images"
-- Allowed operation: INSERT
-- Policy definition: (bucket_id = 'vehicle-images' AND auth.role() = 'authenticated')

-- ============================================================================
-- POLICY 2: Allow public read access to all images
-- ============================================================================
-- Policy Name: "Allow public read access to vehicle images"
-- Allowed operation: SELECT
-- Policy definition: (bucket_id = 'vehicle-images')

-- ============================================================================
-- POLICY 3: Allow hosts to update their own car images
-- ============================================================================
-- Policy Name: "Allow hosts to update their vehicle images"
-- Allowed operation: UPDATE
-- Policy definition: (bucket_id = 'vehicle-images' AND auth.role() = 'authenticated')

-- ============================================================================
-- POLICY 4: Allow hosts to delete their own car images
-- ============================================================================
-- Policy Name: "Allow hosts to delete their vehicle images"
-- Allowed operation: DELETE
-- Policy definition: (bucket_id = 'vehicle-images' AND auth.role() = 'authenticated')

-- ============================================================================
-- ALTERNATIVE: SIMPLIFIED POLICIES (if the above don't work)
-- ============================================================================
-- If the complex policies don't work, try these simpler ones:

-- SIMPLE POLICY 1: Allow authenticated users to upload
-- Policy Name: "Allow authenticated uploads"
-- Allowed operation: INSERT
-- Policy definition: (auth.role() = 'authenticated')

-- SIMPLE POLICY 2: Allow public read access
-- Policy Name: "Allow public read access"
-- Allowed operation: SELECT
-- Policy definition: true

-- SIMPLE POLICY 3: Allow authenticated users to update
-- Policy Name: "Allow authenticated updates"
-- Allowed operation: UPDATE
-- Policy definition: (auth.role() = 'authenticated')

-- SIMPLE POLICY 4: Allow authenticated users to delete
-- Policy Name: "Allow authenticated deletes"
-- Allowed operation: DELETE
-- Policy definition: (auth.role() = 'authenticated')

-- ============================================================================
-- DETAILED SETUP STEPS
-- ============================================================================

-- 1. Go to Supabase Dashboard
-- 2. Navigate to Storage → vehicle-images bucket
-- 3. Click on "Policies" tab
-- 4. Click "New Policy"
-- 5. For each policy:
--    - Enter the policy name (e.g., "Allow authenticated users to upload vehicle images")
--    - Select the allowed operation (INSERT/SELECT/UPDATE/DELETE)
--    - Enter the policy definition (e.g., (auth.role() = 'authenticated'))
--    - Click "Save"
-- 6. Repeat for all 4 policies

-- ============================================================================
-- TEST AFTER SETUP
-- ============================================================================

-- After setting up the policies, test by:
-- 1. Going to your vehicle management page
-- 2. Trying to upload an image
-- 3. Checking the browser console for any errors

-- If you still get errors, try the simplified policies above.

-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================

-- ERROR: "new row violates row-level security policy"
-- SOLUTION: Make sure all 4 policies are created correctly

-- ERROR: "Permission denied"
-- SOLUTION: Check that the INSERT policy is set up correctly

-- ERROR: "Bucket not found"
-- SOLUTION: Verify the bucket name is exactly "vehicle-images"

-- ============================================================================
-- COMPLETION CHECK
-- ============================================================================

-- After setting up policies, run this to verify bucket status:
-- SELECT public.check_storage_bucket_status();

-- Expected result:
-- {
--   "status": "ready",
--   "bucket_exists": true,
--   "bucket_public": true,
--   "message": "Storage bucket is properly configured"
-- }

-- ============================================================================
-- MANUAL SETUP CHECKLIST
-- ============================================================================

-- ✅ STEP 1: Create bucket in Supabase Dashboard
--    - Go to Storage → Buckets
--    - Click "New bucket"
--    - Name: "vehicle-images"
--    - Public: YES

-- ✅ STEP 2: Set up policies in Supabase Dashboard
--    - Go to Storage → vehicle-images → Policies
--    - Add 4 policies as described above

-- ✅ STEP 3: Test configuration
--    - Run: SELECT public.check_storage_bucket_status();
--    - Should return status: "ready"

-- ✅ STEP 4: Test image upload
--    - Go to vehicle management page
--    - Try uploading an image
--    - Check console for any errors

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

-- This script provides:
-- ✅ Instructions for manual storage bucket setup
-- ✅ Policy definitions for storage access
-- ✅ Troubleshooting guide
-- 
-- IMPORTANT: Storage policies must be created manually
-- through Supabase Dashboard, not through SQL commands.
-- 
-- After manual setup, run this to verify:
-- SELECT public.check_storage_bucket_status(); 