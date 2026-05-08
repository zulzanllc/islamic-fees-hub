CREATE TABLE IF NOT EXISTS public.teacher_salary_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  annual_increment_percentage numeric NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.teacher_salary_settings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_teacher_salary_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_teacher_salary_settings_updated_at
ON public.teacher_salary_settings;

CREATE TRIGGER set_teacher_salary_settings_updated_at
BEFORE UPDATE ON public.teacher_salary_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_teacher_salary_settings_updated_at();

INSERT INTO public.teacher_salary_settings (id, annual_increment_percentage)
VALUES (1, 10)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can view teacher salary settings" ON public.teacher_salary_settings;
DROP POLICY IF EXISTS "Users can edit teacher salary settings" ON public.teacher_salary_settings;

CREATE POLICY "Users can view teacher salary settings"
ON public.teacher_salary_settings
FOR SELECT
USING (public.has_permission(auth.uid(), 'view_teachers'));

CREATE POLICY "Users can edit teacher salary settings"
ON public.teacher_salary_settings
FOR ALL
USING (public.has_permission(auth.uid(), 'edit_salaries'))
WITH CHECK (public.has_permission(auth.uid(), 'edit_salaries'));
