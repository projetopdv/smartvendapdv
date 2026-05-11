-- ============ LIMPAR DADOS ============
TRUNCATE TABLE public.cash_movements, public.cash_registers,
  public.accounts_payable, public.accounts_receivable,
  public.table_order_items, public.table_orders, public.tables,
  public.sale_items, public.sales, public.stock_movements,
  public.products, public.categories CASCADE;

-- ============ ADICIONAR owner_id ============
ALTER TABLE public.products          ADD COLUMN IF NOT EXISTS owner_id UUID NOT NULL;
ALTER TABLE public.categories        ADD COLUMN IF NOT EXISTS owner_id UUID NOT NULL;
ALTER TABLE public.sales             ADD COLUMN IF NOT EXISTS owner_id UUID NOT NULL;
ALTER TABLE public.sale_items        ADD COLUMN IF NOT EXISTS owner_id UUID NOT NULL;
ALTER TABLE public.stock_movements   ADD COLUMN IF NOT EXISTS owner_id UUID NOT NULL;
ALTER TABLE public.tables            ADD COLUMN IF NOT EXISTS owner_id UUID NOT NULL;
ALTER TABLE public.table_orders      ADD COLUMN IF NOT EXISTS owner_id UUID NOT NULL;
ALTER TABLE public.table_order_items ADD COLUMN IF NOT EXISTS owner_id UUID NOT NULL;
ALTER TABLE public.cash_registers    ADD COLUMN IF NOT EXISTS owner_id UUID NOT NULL;
ALTER TABLE public.cash_movements    ADD COLUMN IF NOT EXISTS owner_id UUID NOT NULL;
ALTER TABLE public.accounts_payable  ADD COLUMN IF NOT EXISTS owner_id UUID NOT NULL;
ALTER TABLE public.accounts_receivable ADD COLUMN IF NOT EXISTS owner_id UUID NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_owner ON public.products(owner_id);
CREATE INDEX IF NOT EXISTS idx_sales_owner ON public.sales(owner_id);
CREATE INDEX IF NOT EXISTS idx_tables_owner ON public.tables(owner_id);
CREATE INDEX IF NOT EXISTS idx_categories_owner ON public.categories(owner_id);

-- ============ DROP TODAS POLICIES ANTIGAS ============
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies
           WHERE schemaname='public' AND tablename IN
           ('products','categories','sales','sale_items','stock_movements',
            'tables','table_orders','table_order_items','cash_registers',
            'cash_movements','accounts_payable','accounts_receivable')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ============ NOVAS POLICIES POR owner_id ============
-- Helper genérico: select/insert/update/delete só para próprio owner
-- PRODUCTS
CREATE POLICY "own select products" ON public.products FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "own update products" ON public.products FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own delete products" ON public.products FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- CATEGORIES
CREATE POLICY "own select categories" ON public.categories FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own insert categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "own update categories" ON public.categories FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own delete categories" ON public.categories FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- SALES
CREATE POLICY "own select sales" ON public.sales FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own insert sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "own update sales" ON public.sales FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own delete sales" ON public.sales FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- SALE_ITEMS
CREATE POLICY "own select sale_items" ON public.sale_items FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own insert sale_items" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

-- STOCK_MOVEMENTS
CREATE POLICY "own select stock" ON public.stock_movements FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own insert stock" ON public.stock_movements FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

-- TABLES
CREATE POLICY "own select tables" ON public.tables FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own insert tables" ON public.tables FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "own update tables" ON public.tables FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own delete tables" ON public.tables FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- TABLE_ORDERS
CREATE POLICY "own select torders" ON public.table_orders FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own insert torders" ON public.table_orders FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "own update torders" ON public.table_orders FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own delete torders" ON public.table_orders FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- TABLE_ORDER_ITEMS
CREATE POLICY "own select toitems" ON public.table_order_items FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own insert toitems" ON public.table_order_items FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "own update toitems" ON public.table_order_items FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own delete toitems" ON public.table_order_items FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- CASH_REGISTERS
CREATE POLICY "own select creg" ON public.cash_registers FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own insert creg" ON public.cash_registers FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "own update creg" ON public.cash_registers FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own delete creg" ON public.cash_registers FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- CASH_MOVEMENTS
CREATE POLICY "own select cmov" ON public.cash_movements FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own insert cmov" ON public.cash_movements FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

-- ACCOUNTS_PAYABLE
CREATE POLICY "own select ap" ON public.accounts_payable FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own insert ap" ON public.accounts_payable FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "own update ap" ON public.accounts_payable FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own delete ap" ON public.accounts_payable FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- ACCOUNTS_RECEIVABLE
CREATE POLICY "own select ar" ON public.accounts_receivable FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own insert ar" ON public.accounts_receivable FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "own update ar" ON public.accounts_receivable FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own delete ar" ON public.accounts_receivable FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- ============ ATUALIZAR FUNÇÕES RPC ============
CREATE OR REPLACE FUNCTION public.create_sale(_items jsonb, _discount numeric, _payment_method payment_method, _amount_received numeric, _notes text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
  INSERT INTO public.sales (owner_id, cashier_id, subtotal, discount, total, payment_method, amount_received, change_amount, notes)
  VALUES (_user, _user, _subtotal, COALESCE(_discount,0), _total, _payment_method, _amount_received,
          CASE WHEN _amount_received IS NOT NULL THEN GREATEST(_amount_received - _total,0) ELSE NULL END, _notes)
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

CREATE OR REPLACE FUNCTION public.open_table_order(_table_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _order_id UUID; _user UUID := auth.uid();
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT id INTO _order_id FROM public.table_orders WHERE table_id = _table_id AND status = 'open' AND owner_id = _user LIMIT 1;
  IF _order_id IS NULL THEN
    INSERT INTO public.table_orders (owner_id, table_id, opened_by) VALUES (_user, _table_id, _user) RETURNING id INTO _order_id;
    UPDATE public.tables SET status = 'occupied' WHERE id = _table_id AND owner_id = _user;
  END IF;
  RETURN _order_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.add_table_item(_order_id uuid, _product_id uuid, _quantity numeric)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _product RECORD; _item_id UUID; _user UUID := auth.uid();
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO _product FROM public.products WHERE id = _product_id AND owner_id = _user;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
  INSERT INTO public.table_order_items (owner_id, order_id, product_id, product_name, quantity, unit_price, subtotal)
  VALUES (_user, _order_id, _product.id, _product.name, _quantity, _product.price, _quantity * _product.price)
  RETURNING id INTO _item_id;
  RETURN _item_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.close_table_order(_order_id uuid, _payment_method payment_method, _discount numeric, _amount_received numeric)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _items JSONB; _sale_id UUID; _table UUID; _user UUID := auth.uid();
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT table_id INTO _table FROM public.table_orders WHERE id = _order_id AND status = 'open' AND owner_id = _user;
  IF _table IS NULL THEN RAISE EXCEPTION 'Comanda não encontrada ou já fechada'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('product_id', product_id,'quantity', quantity,'unit_price', unit_price)), '[]'::jsonb) INTO _items
  FROM public.table_order_items WHERE order_id = _order_id;
  IF _items = '[]'::jsonb THEN RAISE EXCEPTION 'Comanda vazia'; END IF;
  _sale_id := public.create_sale(_items, COALESCE(_discount, 0), _payment_method, _amount_received, 'Mesa #' || _table::text);
  UPDATE public.table_orders SET status = 'closed', closed_at = now(), sale_id = _sale_id WHERE id = _order_id;
  UPDATE public.tables SET status = 'free' WHERE id = _table AND owner_id = _user;
  RETURN _sale_id;
END;
$function$;

-- ============ TRIGGER: novo usuário vira admin da própria empresa + plano free ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _free_plan UUID;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), NEW.email);

  -- Todo novo usuário é admin da SUA própria empresa (isolamento via owner_id)
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;

  -- Atribui plano free se existir
  SELECT id INTO _free_plan FROM public.plans WHERE active = true ORDER BY price ASC LIMIT 1;
  IF _free_plan IS NOT NULL THEN
    INSERT INTO public.user_subscriptions (user_id, plan_id, status, starts_at, expires_at)
    VALUES (NEW.id, _free_plan, 'active', now(), now() + interval '30 days');
  END IF;

  RETURN NEW;
END;
$function$;

-- Garantir trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Plano gratuito padrão
INSERT INTO public.plans (name, description, price, billing_cycle, active)
SELECT 'Trial', 'Plano gratuito de 30 dias', 0, 'monthly', true
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE price = 0);