-- RPC Functions for Messaging System
-- These functions handle message operations with proper validation and security

-- Function to get conversation messages for a specific booking
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

  -- Check if this is an offline booking
  IF EXISTS (
    SELECT 1 FROM bookings b 
    WHERE b.id = p_booking_id 
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

-- Function to send a message
CREATE OR REPLACE FUNCTION send_booking_message(
  p_booking_id UUID,
  p_sender_id UUID,
  p_receiver_id UUID,
  p_message TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_message_id UUID;
  booking_record RECORD;
BEGIN
  -- Validate message content
  IF p_message IS NULL OR LENGTH(TRIM(p_message)) = 0 THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;

  IF LENGTH(p_message) > 2000 THEN
    RAISE EXCEPTION 'Message too long (max 2000 characters)';
  END IF;

  -- Get booking details and verify participants
  SELECT * INTO booking_record 
  FROM bookings 
  WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- Verify sender is part of the booking
  IF booking_record.host_id != p_sender_id AND booking_record.renter_id != p_sender_id THEN
    RAISE EXCEPTION 'Sender not authorized for this booking';
  END IF;

  -- Verify receiver is part of the booking
  IF booking_record.host_id != p_receiver_id AND booking_record.renter_id != p_receiver_id THEN
    RAISE EXCEPTION 'Receiver not authorized for this booking';
  END IF;

  -- Check if this is an offline booking
  IF booking_record.special_instructions::jsonb ? 'is_offline_booking' 
     AND (booking_record.special_instructions::jsonb->>'is_offline_booking')::boolean = true THEN
    RAISE EXCEPTION 'Messaging not available for offline bookings';
  END IF;

  -- Insert the message
  INSERT INTO messages (
    booking_id,
    sender_id,
    receiver_id,
    message,
    created_at
  ) VALUES (
    p_booking_id,
    p_sender_id,
    p_receiver_id,
    TRIM(p_message),
    NOW()
  ) RETURNING id INTO new_message_id;

  RETURN new_message_id;
END;
$$;

-- Function to mark messages as read
CREATE OR REPLACE FUNCTION mark_messages_read(
  p_booking_id UUID,
  p_user_id UUID,
  p_message_ids UUID[] DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Verify user is part of this booking
  IF NOT EXISTS (
    SELECT 1 FROM bookings b 
    WHERE b.id = p_booking_id 
    AND (b.host_id = p_user_id OR b.renter_id = p_user_id)
  ) THEN
    RAISE EXCEPTION 'User not authorized to update messages for this booking';
  END IF;

  -- Update messages as read
  IF p_message_ids IS NULL THEN
    -- Mark all unread messages for this user as read
    UPDATE messages 
    SET is_read = true, read_at = NOW()
    WHERE booking_id = p_booking_id 
      AND receiver_id = p_user_id 
      AND is_read = false;
  ELSE
    -- Mark specific messages as read
    UPDATE messages 
    SET is_read = true, read_at = NOW()
    WHERE booking_id = p_booking_id 
      AND receiver_id = p_user_id 
      AND id = ANY(p_message_ids)
      AND is_read = false;
  END IF;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Function to get unread message count for a user
CREATE OR REPLACE FUNCTION get_unread_message_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  unread_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO unread_count
  FROM messages m
  INNER JOIN bookings b ON m.booking_id = b.id
  WHERE m.receiver_id = p_user_id 
    AND m.is_read = false
    AND (b.host_id = p_user_id OR b.renter_id = p_user_id)
    AND NOT (
      b.special_instructions::jsonb ? 'is_offline_booking' 
      AND (b.special_instructions::jsonb->>'is_offline_booking')::boolean = true
    );

  RETURN COALESCE(unread_count, 0);
END;
$$;

-- Function to get user's conversation list
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
      AND NOT (
        b.special_instructions::jsonb ? 'is_offline_booking' 
        AND (b.special_instructions::jsonb->>'is_offline_booking')::boolean = true
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_booking_id ON messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_messages_participants ON messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread ON messages(receiver_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_booking_messages(UUID, UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION send_booking_message(UUID, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_messages_read(UUID, UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_message_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_conversations(UUID, INTEGER, INTEGER) TO authenticated;