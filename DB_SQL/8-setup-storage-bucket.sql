-- STEP 8: SETUP STORAGE BUCKET FOR VEHICLE IMAGES
-- This script contains the SQL commands to set up the vehicle-images bucket
-- Note: Bucket creation must be done through Supabase Dashboard or CLI
-- This file documents the required setup steps

-- ============================================================================
-- STORAGE BUCKET SETUP INSTRUCTIONS
-- ============================================================================

-- 1. Create the bucket (via Supabase Dashboard or CLI):
--    - Go to Storage in Supabase Dashboard
--    - Click "New bucket"
--    - Name: "vehicle-images" 
--    - Set as Public: YES
--    - File size limit: 10MB per file
--    - Allowed MIME types: image/jpeg, image/png, image/webp

-- 2. Set up bucket policies (execute these SQL commands):

-- ============================================================================
-- STORAGE POLICIES FOR VEHICLE-IMAGES BUCKET
-- ============================================================================

-- Policy 1: Allow authenticated users to upload images
INSERT INTO public.storage.policies (id, name, bucket_id, definition, check_expression, command)
VALUES (
  'vehicle-images-upload',
  'Allow authenticated users to upload vehicle images',
  'vehicle-images',
  'auth.role() = "authenticated"',
  'auth.role() = "authenticated"',
  'INSERT'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  definition = EXCLUDED.definition,
  check_expression = EXCLUDED.check_expression;

-- Policy 2: Allow public read access to all images
INSERT INTO public.storage.policies (id, name, bucket_id, definition, check_expression, command)
VALUES (
  'vehicle-images-public-read',
  'Allow public read access to vehicle images',
  'vehicle-images',
  'true',
  'true',
  'SELECT'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  definition = EXCLUDED.definition,
  check_expression = EXCLUDED.check_expression;

-- Policy 3: Allow hosts to update/delete their own car images
INSERT INTO public.storage.policies (id, name, bucket_id, definition, check_expression, command)
VALUES (
  'vehicle-images-host-update',
  'Allow hosts to update their vehicle images',
  'vehicle-images',
  'EXISTS (
    SELECT 1 FROM public.cars c
    JOIN public.car_images ci ON c.id = ci.car_id
    WHERE ci.image_url LIKE ''%'' || storage.filename(name) || ''%''
    AND c.host_id = auth.uid()
  )',
  'EXISTS (
    SELECT 1 FROM public.cars c
    JOIN public.car_images ci ON c.id = ci.car_id
    WHERE ci.image_url LIKE ''%'' || storage.filename(name) || ''%''
    AND c.host_id = auth.uid()
  )',
  'UPDATE'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  definition = EXCLUDED.definition,
  check_expression = EXCLUDED.check_expression;

-- Policy 4: Allow hosts to delete their own car images
INSERT INTO public.storage.policies (id, name, bucket_id, definition, check_expression, command)
VALUES (
  'vehicle-images-host-delete',
  'Allow hosts to delete their vehicle images',
  'vehicle-images',
  'EXISTS (
    SELECT 1 FROM public.cars c
    JOIN public.car_images ci ON c.id = ci.car_id
    WHERE ci.image_url LIKE ''%'' || storage.filename(name) || ''%''
    AND c.host_id = auth.uid()
  )',
  'true',
  'DELETE'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  definition = EXCLUDED.definition,
  check_expression = EXCLUDED.check_expression;

-- ============================================================================
-- HELPER FUNCTION FOR STORAGE BUCKET MANAGEMENT
-- ============================================================================

-- Function to check if storage bucket exists and is properly configured
CREATE OR REPLACE FUNCTION public.check_storage_bucket_status()
RETURNS JSON AS $$
DECLARE
  bucket_exists BOOLEAN := FALSE;
  bucket_public BOOLEAN := FALSE;
  policy_count INTEGER := 0;
BEGIN
  -- Check if bucket exists
  SELECT EXISTS (
    SELECT 1 FROM storage.buckets 
    WHERE id = 'vehicle-images'
  ) INTO bucket_exists;
  
  IF NOT bucket_exists THEN
    RETURN json_build_object(
      'bucket_exists', false,
      'status', 'error',
      'message', 'vehicle-images bucket does not exist. Please create it in Supabase Storage.'
    );
  END IF;
  
  -- Check if bucket is public
  SELECT public INTO bucket_public
  FROM storage.buckets 
  WHERE id = 'vehicle-images';
  
  -- Check number of policies
  SELECT COUNT(*) INTO policy_count
  FROM storage.policies 
  WHERE bucket_id = 'vehicle-images';
  
  RETURN json_build_object(
    'bucket_exists', bucket_exists,
    'bucket_public', bucket_public,
    'policy_count', policy_count,
    'status', CASE 
      WHEN bucket_public AND policy_count >= 4 THEN 'ready'
      WHEN bucket_public AND policy_count < 4 THEN 'partial'
      ELSE 'misconfigured'
    END,
    'message', CASE 
      WHEN bucket_public AND policy_count >= 4 THEN 'Storage bucket is properly configured'
      WHEN bucket_public AND policy_count < 4 THEN 'Storage bucket exists but policies are incomplete'
      ELSE 'Storage bucket is not properly configured'
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

-- This script sets up:
-- ✅ Storage policies for vehicle-images bucket
-- ✅ Helper function to check bucket status
-- 
-- Manual steps required:
-- 1. Create 'vehicle-images' bucket in Supabase Storage Dashboard
-- 2. Set bucket as public
-- 3. Run: SELECT public.check_storage_bucket_status(); to verify setup
-- 
-- After setup, test image upload in the vehicle management interface