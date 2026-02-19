-- Add DINE_IN fulfillment type for dine-in orders.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public'
      AND t.typname = 'fulfillment_type'
      AND e.enumlabel = 'DINE_IN'
  ) THEN
    ALTER TYPE public.fulfillment_type ADD VALUE 'DINE_IN';
  END IF;
END
$$;
