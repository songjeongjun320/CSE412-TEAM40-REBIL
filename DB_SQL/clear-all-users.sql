-- Clear all existing users for fresh start
-- WARNING: This will delete ALL users and their data!

-- Step 1: Delete all user-related data in correct order (foreign key dependencies)
DELETE FROM public.admin_actions;
DELETE FROM public.reviews;
DELETE FROM public.messages;
DELETE FROM public.payments;
DELETE FROM public.bookings;
DELETE FROM public.car_availability;
DELETE FROM public.car_images;
DELETE FROM public.cars;
DELETE FROM public.user_verifications;
DELETE FROM public.user_roles;
DELETE FROM public.user_profiles;

-- Step 2: Delete all auth users (this will cascade to related auth tables)
DELETE FROM auth.users;

-- Step 3: Verification - should all be 0
SELECT 'CLEANUP COMPLETE - User counts:' as status;
SELECT 
  'auth.users' as table_name,
  COUNT(*) as count
FROM auth.users
UNION ALL
SELECT 
  'user_profiles' as table_name,
  COUNT(*) as count
FROM public.user_profiles
UNION ALL
SELECT 
  'user_roles' as table_name,
  COUNT(*) as count
FROM public.user_roles;

SELECT 'All users cleared! Ready for fresh OAuth login testing.' as message;