CREATE TABLE IF NOT EXISTS public.teacher_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  month text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  date_given date NOT NULL DEFAULT CURRENT_DATE,
  payment_mode text NOT NULL DEFAULT 'cash',
  notes text NOT NULL DEFAULT '',
  proof_image_url text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.teacher_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  date_given date NOT NULL DEFAULT CURRENT_DATE,
  month text NOT NULL,
  notes text NOT NULL DEFAULT '',
  payment_mode text NOT NULL DEFAULT 'cash',
  proof_image_url text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.teacher_salaries
ADD COLUMN IF NOT EXISTS proof_image_url text NOT NULL DEFAULT '';

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS proof_image_url text NOT NULL DEFAULT '';

ALTER TABLE public.teacher_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_bonuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view teacher advances with permission"
ON public.teacher_advances
FOR SELECT
USING (public.has_permission(auth.uid(), 'view_teachers'));

CREATE POLICY "Users can edit teacher advances with salary permission"
ON public.teacher_advances
FOR ALL
USING (public.has_permission(auth.uid(), 'pay_salaries'))
WITH CHECK (public.has_permission(auth.uid(), 'pay_salaries'));

CREATE POLICY "Users can view teacher bonuses with permission"
ON public.teacher_bonuses
FOR SELECT
USING (public.has_permission(auth.uid(), 'view_teachers'));

CREATE POLICY "Users can edit teacher bonuses with teacher permission"
ON public.teacher_bonuses
FOR ALL
USING (public.has_permission(auth.uid(), 'edit_teachers'))
WITH CHECK (public.has_permission(auth.uid(), 'edit_teachers'));

INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public can view payment proofs'
  ) THEN
    CREATE POLICY "Public can view payment proofs"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'payment-proofs');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can upload payment proofs'
  ) THEN
    CREATE POLICY "Authenticated users can upload payment proofs"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'payment-proofs' AND auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can update payment proofs'
  ) THEN
    CREATE POLICY "Authenticated users can update payment proofs"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'payment-proofs' AND auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can delete payment proofs'
  ) THEN
    CREATE POLICY "Authenticated users can delete payment proofs"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'payment-proofs' AND auth.uid() IS NOT NULL);
  END IF;
END $$;
