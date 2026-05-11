-- =========================================
-- TABELAS DE MESAS
-- =========================================
CREATE TYPE public.table_status AS ENUM ('free', 'occupied', 'reserved');
CREATE TYPE public.table_order_status AS ENUM ('open', 'closed', 'cancelled');

CREATE TABLE public.tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INTEGER NOT NULL UNIQUE,
  name TEXT,
  seats INTEGER NOT NULL DEFAULT 4,
  status public.table_status NOT NULL DEFAULT 'free',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.table_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  status public.table_order_status NOT NULL DEFAULT 'open',
  opened_by UUID NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  sale_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- só uma comanda aberta por mesa
CREATE UNIQUE INDEX one_open_order_per_table ON public.table_orders(table_id) WHERE status = 'open';

CREATE TABLE public.table_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.table_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  subtotal NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_order_items ENABLE ROW LEVEL SECURITY;

-- RLS tables
CREATE POLICY "Authenticated view tables" ON public.tables FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/manager insert tables" ON public.tables FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "Admin/manager update tables" ON public.tables FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "Admin/manager delete tables" ON public.tables FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- RLS table_orders
CREATE POLICY "Authenticated view orders" ON public.table_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert orders" ON public.table_orders FOR INSERT TO authenticated
  WITH CHECK (opened_by = auth.uid());
CREATE POLICY "Authenticated update orders" ON public.table_orders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin delete orders" ON public.table_orders FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- RLS table_order_items
CREATE POLICY "Authenticated view order items" ON public.table_order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert order items" ON public.table_order_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update order items" ON public.table_order_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete order items" ON public.table_order_items FOR DELETE TO authenticated USING (true);

CREATE TRIGGER tg_tables_updated_at BEFORE UPDATE ON public.tables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tg_table_orders_updated_at BEFORE UPDATE ON public.table_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- FUNÇÕES
-- =========================================

-- Abrir/garantir comanda aberta para a mesa
CREATE OR REPLACE FUNCTION public.open_table_order(_table_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order_id UUID;
  _user UUID := auth.uid();
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT id INTO _order_id FROM public.table_orders
   WHERE table_id = _table_id AND status = 'open' LIMIT 1;

  IF _order_id IS NULL THEN
    INSERT INTO public.table_orders (table_id, opened_by) VALUES (_table_id, _user)
    RETURNING id INTO _order_id;
    UPDATE public.tables SET status = 'occupied' WHERE id = _table_id;
  END IF;

  RETURN _order_id;
END;
$$;

-- Adicionar item na comanda
CREATE OR REPLACE FUNCTION public.add_table_item(_order_id UUID, _product_id UUID, _quantity NUMERIC)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _product RECORD;
  _item_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO _product FROM public.products WHERE id = _product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;

  INSERT INTO public.table_order_items (order_id, product_id, product_name, quantity, unit_price, subtotal)
  VALUES (_order_id, _product.id, _product.name, _quantity, _product.price, _quantity * _product.price)
  RETURNING id INTO _item_id;

  RETURN _item_id;
END;
$$;

-- Fechar comanda criando venda
CREATE OR REPLACE FUNCTION public.close_table_order(_order_id UUID, _payment_method payment_method, _discount NUMERIC, _amount_received NUMERIC)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _items JSONB;
  _sale_id UUID;
  _table UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT table_id INTO _table FROM public.table_orders WHERE id = _order_id AND status = 'open';
  IF _table IS NULL THEN RAISE EXCEPTION 'Comanda não encontrada ou já fechada'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'product_id', product_id,
    'quantity', quantity,
    'unit_price', unit_price
  )), '[]'::jsonb) INTO _items
  FROM public.table_order_items WHERE order_id = _order_id;

  IF _items = '[]'::jsonb THEN RAISE EXCEPTION 'Comanda vazia'; END IF;

  _sale_id := public.create_sale(_items, COALESCE(_discount, 0), _payment_method, _amount_received, 'Mesa #' || _table::text);

  UPDATE public.table_orders SET status = 'closed', closed_at = now(), sale_id = _sale_id WHERE id = _order_id;
  UPDATE public.tables SET status = 'free' WHERE id = _table;

  RETURN _sale_id;
END;
$$;