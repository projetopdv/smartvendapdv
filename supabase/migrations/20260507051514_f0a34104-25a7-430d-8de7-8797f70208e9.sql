ALTER TABLE public.tables DROP CONSTRAINT IF EXISTS tables_number_key;
ALTER TABLE public.tables ADD CONSTRAINT tables_owner_number_key UNIQUE (owner_id, number);