ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS collected_by_email text;

UPDATE public.payments AS payment
SET collected_by_email = auth_user.email
FROM auth.users AS auth_user
WHERE payment.collected_by = auth_user.id
  AND payment.collected_by_email IS NULL;

CREATE OR REPLACE FUNCTION public.set_payment_collector_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.collected_by IS NULL THEN
    NEW.collected_by := auth.uid();
  END IF;

  IF NEW.collected_by IS NOT NULL AND NEW.collected_by_email IS NULL THEN
    SELECT auth_user.email
    INTO NEW.collected_by_email
    FROM auth.users AS auth_user
    WHERE auth_user.id = NEW.collected_by;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_payment_collector_identity ON public.payments;

CREATE TRIGGER set_payment_collector_identity
BEFORE INSERT OR UPDATE OF collected_by ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.set_payment_collector_identity();
