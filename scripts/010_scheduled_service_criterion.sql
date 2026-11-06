-- Fail explicitly on legacy invalid rows. Repair them from verified user intent
-- before retrying; this migration never deletes or rewrites user data.
BEGIN;
LOCK TABLE public.scheduled_services IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.scheduled_services
    WHERE scheduled_date IS NULL AND scheduled_mileage IS NULL
  ) THEN
    RAISE EXCEPTION 'scheduled_services contains rows without date or mileage; explicitly repair these rows before applying script010';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.scheduled_services'::regclass
      AND conname = 'scheduled_services_requires_criterion'
  ) THEN
    ALTER TABLE public.scheduled_services
      ADD CONSTRAINT scheduled_services_requires_criterion
      CHECK (scheduled_date IS NOT NULL OR scheduled_mileage IS NOT NULL);
  END IF;
END;
$$;
COMMIT;
