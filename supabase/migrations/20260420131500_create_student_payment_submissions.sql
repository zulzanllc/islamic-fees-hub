CREATE TABLE IF NOT EXISTS public.student_payment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_month text NOT NULL,
  amount_submitted numeric NOT NULL DEFAULT 0,
  total_collected_at_submission numeric NOT NULL DEFAULT 0,
  previously_submitted_amount numeric NOT NULL DEFAULT 0,
  remaining_after_submission numeric NOT NULL DEFAULT 0,
  submission_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_mode text NOT NULL DEFAULT 'cash',
  notes text NOT NULL DEFAULT '',
  submitted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_payment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view student payment submissions"
ON public.student_payment_submissions
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create student payment submissions"
ON public.student_payment_submissions
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update student payment submissions"
ON public.student_payment_submissions
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
