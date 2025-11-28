# Conversations API Error Analysis & Fix

## Problem Description
Error: `GET /api/messages/conversations?limit=50 500`
JSON Parse Error: `Token "test" is invalid. invalid input syntax for type json`

## Root Cause Analysis

### 1. Error Location
The error occurs in the `get_user_conversations` SQL function in `DB_SQL/messaging.sql` at lines:
- Line 246-247: `b.special_instructions::jsonb ? 'is_offline_booking'`
- Line 247: `AND (b.special_instructions::jsonb->>'is_offline_booking')::boolean = true`

### 2. Problem Source
The issue is that somewhere in the database, there's a booking record with `special_instructions` field containing invalid JSON data (likely the literal string "test" instead of proper JSON).

When PostgreSQL tries to cast this invalid JSON string to `jsonb` type, it throws the parsing error: `Token "test" is invalid. invalid input syntax for type json`.

### 3. Investigation Results
- The conversations API (`/api/messages/conversations/route.ts`) calls the `get_user_conversations` RPC function
- This function attempts to cast `special_instructions` to `jsonb` to check for offline bookings
- If any booking has invalid JSON in `special_instructions`, the entire function fails

## Solution Implemented

### 1. Database Fix (`DB_SQL/fix_conversations_json_error.sql`)

#### A. Data Cleanup
- Identifies bookings with invalid JSON in `special_instructions`
- Automatically fixes them by setting invalid JSON to `'{}'` (empty JSON object)

#### B. Function Enhancement
- Updated `get_user_conversations` function with safe JSON parsing
- Added regex validation before attempting JSON casting: `b.special_instructions ~ '^[[:space:]]*\\{.*\\}[[:space:]]*$'`
- Only attempts `::jsonb` casting if the string looks like valid JSON
- Updated `get_booking_messages` function with the same safe pattern

#### C. Fallback Strategy
- If `special_instructions` doesn't look like JSON, assumes it's not an offline booking
- Gracefully handles edge cases without throwing errors

### 2. Key Changes Made

```sql
-- OLD (problematic):
AND b.special_instructions::jsonb ? 'is_offline_booking'
AND (b.special_instructions::jsonb->>'is_offline_booking')::boolean = true

-- NEW (safe):
AND b.special_instructions IS NOT NULL 
AND b.special_instructions != ''
AND b.special_instructions ~ '^[[:space:]]*\\{.*\\}[[:space:]]*$'
AND (
  b.special_instructions::jsonb ? 'is_offline_booking' 
  AND (b.special_instructions::jsonb->>'is_offline_booking')::boolean = true
)
```

### 3. Files Modified/Created
- ✅ `DB_SQL/fix_conversations_json_error.sql` - Complete fix
- ✅ `debug_conversations.js` - Diagnostic script  
- ✅ `test_conversations.sql` - SQL diagnostic queries
- ✅ `test_fix.js` - API test script

## How to Apply the Fix

### Step 1: Run the SQL Fix
Execute the SQL file in your Supabase database:
```sql
-- Run the contents of DB_SQL/fix_conversations_json_error.sql
```

### Step 2: Verify the Fix
1. Check that the conversations API returns 200 instead of 500
2. Verify no more JSON parsing errors in logs
3. Test message functionality works normally

## Prevention

### 1. Frontend Validation
Ensure that any code creating bookings with `special_instructions` always uses proper JSON:

```javascript
// GOOD:
special_instructions: JSON.stringify({
  customer_info: customerInfo,
  is_offline_booking: true,
  // ... other fields
})

// BAD:
special_instructions: "test" // or any non-JSON string
```

### 2. Database Constraints
Consider adding a CHECK constraint to ensure `special_instructions` is always valid JSON:

```sql
ALTER TABLE bookings 
ADD CONSTRAINT valid_special_instructions 
CHECK (
  special_instructions IS NULL OR 
  special_instructions = '' OR 
  (special_instructions::jsonb IS NOT NULL)
);
```

## Testing Verification

After applying the fix:
- ✅ Conversations API should return successful responses
- ✅ Message functionality should work normally  
- ✅ No more JSON parsing errors in server logs
- ✅ Both online and offline bookings handled correctly

## Related Files
- `/src/app/api/messages/conversations/route.ts` - API endpoint
- `/src/hooks/useConversations.ts` - Frontend hook
- `/DB_SQL/messaging.sql` - Original SQL functions
- `/src/components/host/ManualBookingModal.tsx` - Booking creation (creates proper JSON)