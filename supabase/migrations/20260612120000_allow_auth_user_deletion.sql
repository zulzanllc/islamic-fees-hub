ALTER TABLE public.payments
DROP CONSTRAINT IF EXISTS payments_collected_by_fkey;

ALTER TABLE public.payments
ADD CONSTRAINT payments_collected_by_fkey
FOREIGN KEY (collected_by)
REFERENCES auth.users(id)
ON DELETE SET NULL;

ALTER TABLE public.student_payment_submissions
DROP CONSTRAINT IF EXISTS student_payment_submissions_submitted_by_fkey;

ALTER TABLE public.student_payment_submissions
ADD CONSTRAINT student_payment_submissions_submitted_by_fkey
FOREIGN KEY (submitted_by)
REFERENCES auth.users(id)
ON DELETE SET NULL;

ALTER TABLE public.app_logs
DROP CONSTRAINT IF EXISTS app_logs_actor_user_id_fkey;

ALTER TABLE public.app_logs
ADD CONSTRAINT app_logs_actor_user_id_fkey
FOREIGN KEY (actor_user_id)
REFERENCES auth.users(id)
ON DELETE SET NULL;

ALTER TABLE public.app_log_settings
DROP CONSTRAINT IF EXISTS app_log_settings_updated_by_fkey;

ALTER TABLE public.app_log_settings
ADD CONSTRAINT app_log_settings_updated_by_fkey
FOREIGN KEY (updated_by)
REFERENCES auth.users(id)
ON DELETE SET NULL;
