-- Remove overloads antigos que conflitam com as novas versões (com customer_name/customer_id)
DROP FUNCTION IF EXISTS public.create_sale(jsonb, numeric, payment_method, numeric, text);
DROP FUNCTION IF EXISTS public.open_table_order(uuid);