ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS pending_fee_paid numeric NOT NULL DEFAULT 0;
