-- Fix for conversations API JSON parsing error
-- The issue is that the get_user_conversations function tries to cast special_instructions to jsonb
-- but if there's invalid JSON in the database, it fails

-- First, let's find any bookings with invalid JSON in special_instructions
DO $$
DECLARE
  booking_record RECORD;
  invalid_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Checking for bookings with invalid JSON in special_instructions...';
  
  FOR booking_record IN 
    SELECT id, special_instructions FROM bookings 
    WHERE special_instructions IS NOT NULL 
    AND special_instructions != ''
  LOOP
    BEGIN
      -- Try to cast to jsonb
      PERFORM booking_record.special_instructions::jsonb;
    EXCEPTION 
      WHEN OTHERS THEN
        invalid_count := invalid_count + 1;
        RAISE NOTICE 'Found invalid JSON in booking %: %', booking_record.id, SUBSTRING(booking_record.special_instructions, 1, 100);
        
        -- Fix the invalid JSON by setting it to a valid empty JSON object
        UPDATE bookings 
        SET special_instructions = '{}' 
        WHERE id = booking_record.id;
        
        RAISE NOTICE 'Fixed booking % - set special_instructions to empty JSON object', booking_record.id;
    END;
  END LOOP;
  
  IF invalid_count = 0 THEN
    RAISE NOTICE 'No invalid JSON found in special_instructions';
  ELSE
    RAISE NOTICE 'Fixed % bookings with invalid JSON', invalid_count;
  END IF;
END $$;

-- Now let's create a safer version of the get_user_conversations function that handles JSON errors gracefully
CREATE OR REPLACE FUNCTION get_user_conversations_safe(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  booking_id UUID,
  other_user_id UUID,
  other_user_name TEXT,
  vehicle_name TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INTEGER,
  booking_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH conversation_summary AS (
    SELECT DISTINCT
      m.booking_id,
      CASE 
        WHEN b.host_id = p_user_id THEN b.renter_id
        ELSE b.host_id
      END as other_user_id,
      CASE 
        WHEN b.host_id = p_user_id THEN renter.full_name
        ELSE host.full_name
      END as other_user_name,
      CONCAT(c.year, ' ', c.make, ' ', c.model) as vehicle_name,
      b.status::text as booking_status
    FROM messages m
    INNER JOIN bookings b ON m.booking_id = b.id
    INNER JOIN cars c ON b.car_id = c.id
    LEFT JOIN user_profiles host ON b.host_id = host.id
    LEFT JOIN user_profiles renter ON b.renter_id = renter.id
    WHERE (b.host_id = p_user_id OR b.renter_id = p_user_id)
      -- Safe JSON check that handles invalid JSON gracefully
      AND NOT (
        b.special_instructions IS NOT NULL 
        AND b.special_instructions != ''
        AND (
          -- Only check for is_offline_booking if JSON is valid
          CASE 
            WHEN b.special_instructions ~ '^[[:space:]]*\{.*\}[[:space:]]*$' 
            THEN (
              -- Valid JSON structure, safe to cast
              b.special_instructions::jsonb ? 'is_offline_booking' 
              AND (b.special_instructions::jsonb->>'is_offline_booking')::boolean = true
            )
            ELSE false  -- Invalid JSON, assume not offline booking
          END
        )
      )
  ),
  last_messages AS (
    SELECT DISTINCT ON (m.booking_id)
      m.booking_id,
      m.message as last_message,
      m.created_at as last_message_at
    FROM messages m
    WHERE EXISTS (
      SELECT 1 FROM conversation_summary cs 
      WHERE cs.booking_id = m.booking_id
    )
    ORDER BY m.booking_id, m.created_at DESC
  ),
  unread_counts AS (
    SELECT 
      m.booking_id,
      COUNT(*)::INTEGER as unread_count
    FROM messages m
    WHERE m.receiver_id = p_user_id 
      AND m.is_read = false
      AND EXISTS (
        SELECT 1 FROM conversation_summary cs 
        WHERE cs.booking_id = m.booking_id
      )
    GROUP BY m.booking_id
  )
  SELECT 
    cs.booking_id,
    cs.other_user_id,
    cs.other_user_name,
    cs.vehicle_name,
    lm.last_message,
    lm.last_message_at,
    COALESCE(uc.unread_count, 0) as unread_count,
    cs.booking_status
  FROM conversation_summary cs
  LEFT JOIN last_messages lm ON cs.booking_id = lm.booking_id
  LEFT JOIN unread_counts uc ON cs.booking_id = uc.booking_id
  ORDER BY lm.last_message_at DESC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Update the original function to use the safer logic
CREATE OR REPLACE FUNCTION get_user_conversations(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  booking_id UUID,
  other_user_id UUID,
  other_user_name TEXT,
  vehicle_name TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INTEGER,
  booking_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH conversation_summary AS (
    SELECT DISTINCT
      m.booking_id,
      CASE 
        WHEN b.host_id = p_user_id THEN b.renter_id
        ELSE b.host_id
      END as other_user_id,
      CASE 
        WHEN b.host_id = p_user_id THEN renter.full_name
        ELSE host.full_name
      END as other_user_name,
      CONCAT(c.year, ' ', c.make, ' ', c.model) as vehicle_name,
      b.status::text as booking_status
    FROM messages m
    INNER JOIN bookings b ON m.booking_id = b.id
    INNER JOIN cars c ON b.car_id = c.id
    LEFT JOIN user_profiles host ON b.host_id = host.id
    LEFT JOIN user_profiles renter ON b.renter_id = renter.id
    WHERE (b.host_id = p_user_id OR b.renter_id = p_user_id)
      -- Safe JSON check - only process if special_instructions looks like valid JSON
      AND NOT (
        b.special_instructions IS NOT NULL 
        AND b.special_instructions != ''
        AND b.special_instructions ~ '^[[:space:]]*\{.*\}[[:space:]]*$'
        AND (
          b.special_instructions::jsonb ? 'is_offline_booking' 
          AND (b.special_instructions::jsonb->>'is_offline_booking')::boolean = true
        )
      )
  ),
  last_messages AS (
    SELECT DISTINCT ON (m.booking_id)
      m.booking_id,
      m.message as last_message,
      m.created_at as last_message_at
    FROM messages m
    WHERE EXISTS (
      SELECT 1 FROM conversation_summary cs 
      WHERE cs.booking_id = m.booking_id
    )
    ORDER BY m.booking_id, m.created_at DESC
  ),
  unread_counts AS (
    SELECT 
      m.booking_id,
      COUNT(*)::INTEGER as unread_count
    FROM messages m
    WHERE m.receiver_id = p_user_id 
      AND m.is_read = false
      AND EXISTS (
        SELECT 1 FROM conversation_summary cs 
        WHERE cs.booking_id = m.booking_id
      )
    GROUP BY m.booking_id
  )
  SELECT 
    cs.booking_id,
    cs.other_user_id,
    cs.other_user_name,
    cs.vehicle_name,
    lm.last_message,
    lm.last_message_at,
    COALESCE(uc.unread_count, 0) as unread_count,
    cs.booking_status
  FROM conversation_summary cs
  LEFT JOIN last_messages lm ON cs.booking_id = lm.booking_id
  LEFT JOIN unread_counts uc ON cs.booking_id = uc.booking_id
  ORDER BY lm.last_message_at DESC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Also fix the other functions that use special_instructions::jsonb casting
CREATE OR REPLACE FUNCTION get_booking_messages(
  p_booking_id UUID,
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  booking_id UUID,
  sender_id UUID,
  receiver_id UUID,
  message TEXT,
  is_read BOOLEAN,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  sender_name TEXT,
  receiver_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify user is part of this booking (either host or renter)
  IF NOT EXISTS (
    SELECT 1 FROM bookings b 
    WHERE b.id = p_booking_id 
    AND (b.host_id = p_user_id OR b.renter_id = p_user_id)
  ) THEN
    RAISE EXCEPTION 'User not authorized to view this conversation';
  END IF;

  -- Check if this is an offline booking - with safe JSON handling
  IF EXISTS (
    SELECT 1 FROM bookings b 
    WHERE b.id = p_booking_id 
    AND b.special_instructions IS NOT NULL
    AND b.special_instructions != ''
    AND b.special_instructions ~ '^[[:space:]]*\{.*\}[[:space:]]*$'
    AND b.special_instructions::jsonb ? 'is_offline_booking'
    AND (b.special_instructions::jsonb->>'is_offline_booking')::boolean = true
  ) THEN
    RAISE EXCEPTION 'Messaging not available for offline bookings';
  END IF;

  RETURN QUERY
  SELECT 
    m.id,
    m.booking_id,
    m.sender_id,
    m.receiver_id,
    m.message,
    m.is_read,
    m.read_at,
    m.created_at,
    sender.full_name as sender_name,
    receiver.full_name as receiver_name
  FROM messages m
  LEFT JOIN user_profiles sender ON m.sender_id = sender.id
  LEFT JOIN user_profiles receiver ON m.receiver_id = receiver.id
  WHERE m.booking_id = p_booking_id
  ORDER BY m.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_conversations_safe(UUID, INTEGER, INTEGER) TO authenticated;