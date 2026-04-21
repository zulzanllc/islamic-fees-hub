CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin') OR COALESCE((
    SELECT CASE _permission
      WHEN 'view_students' THEN can_view_students
      WHEN 'edit_students' THEN can_edit_students
      WHEN 'collect_fees' THEN (
        can_manage_roles OR
        can_edit_fees OR
        (can_view_students AND can_edit_students AND NOT can_view_teachers)
      )
      WHEN 'edit_fees' THEN (
        can_manage_roles OR (
          can_view_students AND can_edit_students AND
          can_view_teachers AND can_edit_teachers AND
          can_edit_fees
        )
      )
      WHEN 'view_teachers' THEN can_view_teachers
      WHEN 'edit_teachers' THEN can_edit_teachers
      WHEN 'pay_salaries' THEN (
        can_manage_roles OR
        can_edit_salaries OR
        (can_view_teachers AND can_edit_teachers AND NOT can_view_students)
      )
      WHEN 'edit_salaries' THEN (
        can_manage_roles OR (
          can_view_students AND can_edit_students AND
          can_view_teachers AND can_edit_teachers AND
          can_edit_salaries
        )
      )
      WHEN 'manage_roles' THEN can_manage_roles
      ELSE false
    END
    FROM public.user_permissions
    WHERE user_id = _user_id
  ), false)
$$;

DROP POLICY IF EXISTS "Users can edit payments with fee permission" ON public.payments;
DROP POLICY IF EXISTS "Users can insert payments with collection permission" ON public.payments;
DROP POLICY IF EXISTS "Users can update payments with fee permission" ON public.payments;
DROP POLICY IF EXISTS "Users can delete payments with fee permission" ON public.payments;

CREATE POLICY "Users can insert payments with collection permission"
ON public.payments
FOR INSERT
WITH CHECK (public.has_permission(auth.uid(), 'collect_fees'));

CREATE POLICY "Users can update payments with fee permission"
ON public.payments
FOR UPDATE
USING (public.has_permission(auth.uid(), 'edit_fees'))
WITH CHECK (public.has_permission(auth.uid(), 'edit_fees'));

CREATE POLICY "Users can delete payments with fee permission"
ON public.payments
FOR DELETE
USING (public.has_permission(auth.uid(), 'edit_fees'));

DROP POLICY IF EXISTS "Users can edit teacher salaries with salary permission" ON public.teacher_salaries;
DROP POLICY IF EXISTS "Users can insert teacher salaries with payment permission" ON public.teacher_salaries;
DROP POLICY IF EXISTS "Users can update teacher salaries with salary permission" ON public.teacher_salaries;
DROP POLICY IF EXISTS "Users can delete teacher salaries with salary permission" ON public.teacher_salaries;

CREATE POLICY "Users can insert teacher salaries with payment permission"
ON public.teacher_salaries
FOR INSERT
WITH CHECK (public.has_permission(auth.uid(), 'pay_salaries'));

CREATE POLICY "Users can update teacher salaries with salary permission"
ON public.teacher_salaries
FOR UPDATE
USING (public.has_permission(auth.uid(), 'edit_salaries'))
WITH CHECK (public.has_permission(auth.uid(), 'edit_salaries'));

CREATE POLICY "Users can delete teacher salaries with salary permission"
ON public.teacher_salaries
FOR DELETE
USING (public.has_permission(auth.uid(), 'edit_salaries'));
