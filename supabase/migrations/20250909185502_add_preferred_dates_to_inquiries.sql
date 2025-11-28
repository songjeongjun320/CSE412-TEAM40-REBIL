-- Add preferred dates to host_inquiries table
ALTER TABLE host_inquiries 
ADD COLUMN preferred_start_date DATE,
ADD COLUMN preferred_end_date DATE;

-- Add index for date range queries
CREATE INDEX IF NOT EXISTS idx_host_inquiries_dates ON host_inquiries(preferred_start_date, preferred_end_date);