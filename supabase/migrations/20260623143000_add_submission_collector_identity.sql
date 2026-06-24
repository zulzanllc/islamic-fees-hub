ALTER TABLE public.student_payment_submissions
ADD COLUMN IF NOT EXISTS collected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS collected_by_email text;

UPDATE public.student_payment_submissions
SET
  collected_by = submitted_by,
  collected_by_email = submitted_by_email
WHERE collected_by IS NULL
  AND collected_by_email IS NULL;

CREATE INDEX IF NOT EXISTS student_payment_submissions_collected_by_idx
ON public.student_payment_submissions (collected_by);

CREATE INDEX IF NOT EXISTS student_payment_submissions_collected_by_email_idx
ON public.student_payment_submissions (collected_by_email);
