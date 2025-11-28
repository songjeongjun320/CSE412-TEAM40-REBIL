-- STEP 8: SETUP STORAGE BUCKET FOR VEHICLE IMAGES (FIXED VERSION)
-- This file provides setup instructions for vehicle-images bucket
-- Storage policies must be created through Supabase Dashboard, not SQL

-- ============================================================================
-- STORAGE BUCKET SETUP INSTRUCTIONS
-- ============================================================================

-- IMPORTANT: Storage bucket and policies must be set up manually through 
-- Supabase Dashboard because storage.policies is in a different schema

-- 1. CREATE BUCKET (via Supabase Dashboard):
--    - Navigate to: Storage → Buckets
--    - Click "New bucket"
--    - Bucket name: "vehicle-images"
--    - Public bucket: ✅ YES (important!)
--    - File size limit: 10MB per file
--    - Allowed MIME types: image/jpeg, image/png, image/webp, image/gif

-- 2. SET UP BUCKET POLICIES (via Supabase Dashboard):
--    - Go to Storage → vehicle-images bucket → Policies
--    - Create the following policies:

-- ============================================================================
-- POLICY 1: Allow authenticated users to upload images
-- ============================================================================
-- Policy Name: "Allow authenticated users to upload vehicle images"
-- Allowed operation: INSERT
-- Policy definition: auth.role() = 'authenticated'
-- 
-- OR in SQL format (copy this into the policy editor):
-- (auth.role() = 'authenticated')

-- ============================================================================
-- POLICY 2: Allow public read access to all images
-- ============================================================================
-- Policy Name: "Allow public read access to vehicle images"
-- Allowed operation: SELECT
-- Policy definition: true
--
-- OR in SQL format (copy this into the policy editor):
-- true

-- ============================================================================
-- POLICY 3: Allow hosts to update their own car images
-- ============================================================================
-- Policy Name: "Allow hosts to update their vehicle images"
-- Allowed operation: UPDATE
-- Policy definition: Check if user owns the car associated with the image
--
-- OR in SQL format (copy this into the policy editor):
-- (EXISTS (SELECT 1 FROM cars c JOIN car_images ci ON c.id = ci.car_id WHERE ci.image_url LIKE '%' || storage.foldername(name) || '%' AND c.host_id = auth.uid()))

-- ============================================================================
-- POLICY 4: Allow hosts to delete their own car images
-- ============================================================================
-- Policy Name: "Allow hosts to delete their vehicle images"
-- Allowed operation: DELETE
-- Policy definition: Check if user owns the car associated with the image
--
-- OR in SQL format (copy this into the policy editor):
-- (EXISTS (SELECT 1 FROM cars c JOIN car_images ci ON c.id = ci.car_id WHERE ci.image_url LIKE '%' || storage.foldername(name) || '%' AND c.host_id = auth.uid()))

-- ============================================================================
-- HELPER FUNCTION FOR STORAGE BUCKET MANAGEMENT
-- ============================================================================

-- Function to check if storage bucket exists and is properly configured
CREATE OR REPLACE FUNCTION public.check_storage_bucket_status()
RETURNS JSON AS $$
DECLARE
  bucket_exists BOOLEAN := FALSE;
  bucket_public BOOLEAN := FALSE;
BEGIN
  -- Check if bucket exists in storage schema
  BEGIN
    SELECT EXISTS (
      SELECT 1 FROM storage.buckets 
      WHERE id = 'vehicle-images'
    ) INTO bucket_exists;
  EXCEPTION
    WHEN OTHERS THEN
      bucket_exists := FALSE;
  END;
  
  IF NOT bucket_exists THEN
    RETURN json_build_object(
      'bucket_exists', false,
      'status', 'error',
      'message', 'vehicle-images bucket does not exist. Please create it in Supabase Storage Dashboard.'
    );
  END IF;
  
  -- Check if bucket is public
  BEGIN
    SELECT public INTO bucket_public
    FROM storage.buckets 
    WHERE id = 'vehicle-images';
  EXCEPTION
    WHEN OTHERS THEN
      bucket_public := FALSE;
  END;
  
  RETURN json_build_object(
    'bucket_exists', bucket_exists,
    'bucket_public', bucket_public,
    'status', CASE 
      WHEN bucket_public THEN 'ready'
      ELSE 'misconfigured'
    END,
    'message', CASE 
      WHEN bucket_public THEN 'Storage bucket is properly configured'
      ELSE 'Storage bucket exists but is not set as public'
    END,
    'next_steps', CASE
      WHEN NOT bucket_exists THEN ARRAY['Create vehicle-images bucket in Supabase Dashboard']
      WHEN NOT bucket_public THEN ARRAY['Set vehicle-images bucket as public in Supabase Dashboard', 'Add storage policies in Dashboard']
      ELSE ARRAY['Bucket is ready for use']
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TEST STORAGE BUCKET CONFIGURATION
-- ============================================================================

-- Run this query to check if your storage bucket is properly set up:
-- SELECT public.check_storage_bucket_status();

-- Expected result when properly configured:
-- {
--   "status": "ready",
--   "bucket_exists": true,
--   "bucket_public": true,
--   "message": "Storage bucket is properly configured",
--   "next_steps": ["Bucket is ready for use"]
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
-- TROUBLESHOOTING
-- ============================================================================

-- If you get errors during image upload:

-- ERROR: "Storage bucket not found"
-- SOLUTION: Create 'vehicle-images' bucket and set as public

-- ERROR: "Permission denied"
-- SOLUTION: Add the 4 storage policies described above

-- ERROR: "Failed to upload"
-- SOLUTION: Check bucket configuration and policies

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

-- This script provides:
-- ✅ Instructions for manual storage bucket setup
-- ✅ Helper function to check bucket status
-- ✅ Troubleshooting guide
-- 
-- IMPORTANT: Storage bucket and policies must be created manually
-- through Supabase Dashboard, not through SQL commands.
-- 
-- After manual setup, run this to verify:
-- SELECT public.check_storage_bucket_status();