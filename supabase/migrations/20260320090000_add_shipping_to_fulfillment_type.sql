-- Add SHIPPING fulfillment type for parcel delivery orders.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e
      ON t.oid = e.enumtypid
    WHERE t.typnamespace = 'public'::regnamespace
      AND t.typname = 'fulfillment_type'
      AND e.enumlabel = 'SHIPPING'
  ) THEN
    ALTER TYPE public.fulfillment_type ADD VALUE 'SHIPPING';
  END IF;
END $$;
