ALTER TABLE appointments ADD COLUMN booked_at TEXT;
UPDATE appointments SET booked_at = scheduled_at WHERE booked_at IS NULL;
CREATE INDEX IF NOT EXISTS appointments_booked_idx ON appointments (hospital_id, booked_at);

ALTER TABLE payments ADD COLUMN gross_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN refund_amount INTEGER NOT NULL DEFAULT 0;
UPDATE payments SET gross_amount = net_amount WHERE gross_amount = 0;

ALTER TABLE ad_spend ADD COLUMN conversions INTEGER NOT NULL DEFAULT 0;
