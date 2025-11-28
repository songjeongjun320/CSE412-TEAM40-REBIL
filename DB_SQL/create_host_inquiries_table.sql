-- Create host_inquiries table for pre-booking inquiries
CREATE TABLE IF NOT EXISTS host_inquiries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    renter_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    host_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
    message TEXT NOT NULL CHECK (length(trim(message)) > 0),
    inquiry_type TEXT NOT NULL DEFAULT 'general' CHECK (inquiry_type IN ('general', 'booking', 'availability', 'pricing')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'responded', 'closed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_host_inquiries_host_id ON host_inquiries(host_id);
CREATE INDEX IF NOT EXISTS idx_host_inquiries_renter_id ON host_inquiries(renter_id);
CREATE INDEX IF NOT EXISTS idx_host_inquiries_vehicle_id ON host_inquiries(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_host_inquiries_status ON host_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_host_inquiries_created_at ON host_inquiries(created_at DESC);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_host_inquiries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_host_inquiries_updated_at
    BEFORE UPDATE ON host_inquiries
    FOR EACH ROW
    EXECUTE FUNCTION update_host_inquiries_updated_at();