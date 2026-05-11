-- ===== Customers =====
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  document TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customers_owner ON public.customers(owner_id);
CREATE INDEX IF NOT EXISTS idx_customers_owner_name ON public.customers(owner_id, name);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own select customers" ON public.customers FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own insert customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "own update customers" ON public.customers FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own delete customers" ON public.customers FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== Customer reference on table_orders and sales =====
ALTER TABLE public.table_orders
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_id UUID;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_id UUID;

-- ===== Theme settings on profiles =====
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme_palette TEXT DEFAULT 'indigo',
  ADD COLUMN IF NOT EXISTS theme_mode TEXT DEFAULT 'light';

-- ===== Update RPCs =====
CREATE OR REPLACE FUNCTION public.open_table_order(_table_id uuid, _customer_name text DEFAULT NULL, _customer_id uuid DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _order_id UUID; _user UUID := auth.uid();
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT id INTO _order_id FROM public.table_orders WHERE table_id = _table_id AND status = 'open' AND owner_id = _user LIMIT 1;
  IF _order_id IS NULL THEN
    INSERT INTO public.table_orders (owner_id, table_id, opened_by, customer_name, customer_id)
    VALUES (_user, _table_id, _user, NULLIF(trim(_customer_name), ''), _customer_id)
    RETURNING id INTO _order_id;
    UPDATE public.tables SET status = 'occupied' WHERE id = _table_id AND owner_id = _user;
  ELSE
    -- atualiza nome do cliente se foi enviado e o atual estiver vazio
    IF _customer_name IS NOT NULL AND trim(_customer_name) <> '' THEN
      UPDATE public.table_orders
      SET customer_name = _customer_name, customer_id = COALESCE(_customer_id, customer_id)
      WHERE id = _order_id AND (customer_name IS NULL OR customer_name = '');
    END IF;
  END IF;
  RETURN _order_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_sale(_items jsonb, _discount numeric, _payment_method payment_method, _amount_received numeric, _notes text, _customer_name text DEFAULT NULL, _customer_id uuid DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _sale_id UUID; _subtotal NUMERIC := 0; _total NUMERIC; _item JSONB;
  _product RECORD; _qty NUMERIC; _price NUMERIC; _line_total NUMERIC;
  _user UUID := auth.uid();
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    SELECT * INTO _product FROM public.products WHERE id = (_item->>'product_id')::uuid AND owner_id = _user FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
    _qty := (_item->>'quantity')::numeric;
    IF _product.stock < _qty THEN RAISE EXCEPTION 'Estoque insuficiente para %', _product.name; END IF;
    _price := COALESCE((_item->>'unit_price')::numeric, _product.price);
    _subtotal := _subtotal + (_qty * _price);
  END LOOP;
  _total := GREATEST(_subtotal - COALESCE(_discount,0), 0);
  INSERT INTO public.sales (owner_id, cashier_id, subtotal, discount, total, payment_method, amount_received, change_amount, notes, customer_name, customer_id)
  VALUES (_user, _user, _subtotal, COALESCE(_discount,0), _total, _payment_method, _amount_received,
          CASE WHEN _amount_received IS NOT NULL THEN GREATEST(_amount_received - _total,0) ELSE NULL END, _notes,
          NULLIF(trim(_customer_name), ''), _customer_id)
  RETURNING id INTO _sale_id;
  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    SELECT * INTO _product FROM public.products WHERE id = (_item->>'product_id')::uuid;
    _qty := (_item->>'quantity')::numeric;
    _price := COALESCE((_item->>'unit_price')::numeric, _product.price);
    _line_total := _qty * _price;
    INSERT INTO public.sale_items (owner_id, sale_id, product_id, product_name, quantity, unit_price, subtotal)
    VALUES (_user, _sale_id, _product.id, _product.name, _qty, _price, _line_total);
    UPDATE public.products SET stock = stock - _qty WHERE id = _product.id;
    INSERT INTO public.stock_movements (owner_id, product_id, type, quantity, reason, reference_id, user_id)
    VALUES (_user, _product.id, 'sale', -_qty, 'Venda #' || _sale_id::text, _sale_id, _user);
  END LOOP;
  RETURN _sale_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.close_table_order(_order_id uuid, _payment_method payment_method, _discount numeric, _amount_received numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _items JSONB; _sale_id UUID; _table UUID; _user UUID := auth.uid();
        _cust_name TEXT; _cust_id UUID;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT table_id, customer_name, customer_id INTO _table, _cust_name, _cust_id
  FROM public.table_orders WHERE id = _order_id AND status = 'open' AND owner_id = _user;
  IF _table IS NULL THEN RAISE EXCEPTION 'Comanda não encontrada ou já fechada'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('product_id', product_id,'quantity', quantity,'unit_price', unit_price)), '[]'::jsonb) INTO _items
  FROM public.table_order_items WHERE order_id = _order_id;
  IF _items = '[]'::jsonb THEN RAISE EXCEPTION 'Comanda vazia'; END IF;
  _sale_id := public.create_sale(_items, COALESCE(_discount, 0), _payment_method, _amount_received,
                                 'Mesa #' || _table::text || COALESCE(' - ' || _cust_name, ''),
                                 _cust_name, _cust_id);
  UPDATE public.table_orders SET status = 'closed', closed_at = now(), sale_id = _sale_id WHERE id = _order_id;
  UPDATE public.tables SET status = 'free' WHERE id = _table AND owner_id = _user;
  RETURN _sale_id;
END;
$function$;