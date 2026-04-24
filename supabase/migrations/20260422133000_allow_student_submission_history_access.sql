DROP POLICY IF EXISTS "Users can view student payment submissions with student permission"
ON public.student_payment_submissions;

CREATE POLICY "Users can view student payment submissions with student permission"
ON public.student_payment_submissions
FOR SELECT
USING (public.has_permission(auth.uid(), 'view_students'));

DROP POLICY IF EXISTS "Users can create student payment submissions with collection permission"
ON public.student_payment_submissions;

CREATE POLICY "Users can create student payment submissions with collection permission"
ON public.student_payment_submissions
FOR INSERT
WITH CHECK (public.has_permission(auth.uid(), 'collect_fees'));
