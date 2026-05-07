
-- Categorias
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view categories" ON public.categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/manager can insert categories" ON public.categories
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));
CREATE POLICY "Admin/manager can update categories" ON public.categories
  FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));
CREATE POLICY "Admin/manager can delete categories" ON public.categories
  FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));

-- Produtos
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  barcode TEXT UNIQUE,
  sku TEXT UNIQUE,
  description TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock NUMERIC(12,3) NOT NULL DEFAULT 0,
  min_stock NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'un',
  active BOOLEAN NOT NULL DEFAULT true,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_barcode ON public.products(barcode);
CREATE INDEX idx_products_name ON public.products(name);
CREATE INDEX idx_products_active ON public.products(active);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view products" ON public.products
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/manager can insert products" ON public.products
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));
CREATE POLICY "Admin/manager can update products" ON public.products
  FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));
CREATE POLICY "Admin/manager can delete products" ON public.products
  FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vendas
CREATE TYPE public.payment_method AS ENUM ('cash','credit','debit','pix','other');
CREATE TYPE public.sale_status AS ENUM ('completed','cancelled','pending');

CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number BIGSERIAL UNIQUE,
  cashier_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method public.payment_method NOT NULL DEFAULT 'cash',
  amount_received NUMERIC(12,2),
  change_amount NUMERIC(12,2),
  status public.sale_status NOT NULL DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sales_cashier ON public.sales(cashier_id);
CREATE INDEX idx_sales_created ON public.sales(created_at DESC);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cashier views own sales, admin/manager view all" ON public.sales
  FOR SELECT TO authenticated USING (
    cashier_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')
  );
CREATE POLICY "Authenticated can create sales" ON public.sales
  FOR INSERT TO authenticated WITH CHECK (cashier_id = auth.uid());
CREATE POLICY "Admin/manager can update sales" ON public.sales
  FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));
CREATE POLICY "Admin can delete sales" ON public.sales
  FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));

-- Itens da venda
CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sale_items_sale ON public.sale_items(sale_id);

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View items if can view sale" ON public.sale_items
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND (
      s.cashier_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')
    ))
  );
CREATE POLICY "Insert items for own sale" ON public.sale_items
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND s.cashier_id = auth.uid())
  );

-- Movimentações de estoque
CREATE TYPE public.stock_movement_type AS ENUM ('in','out','adjustment','sale');

CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type public.stock_movement_type NOT NULL,
  quantity NUMERIC(12,3) NOT NULL,
  reason TEXT,
  reference_id UUID,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_movements_product ON public.stock_movements(product_id);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view stock movements" ON public.stock_movements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/manager can insert stock movements" ON public.stock_movements
  FOR INSERT TO authenticated WITH CHECK (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR user_id = auth.uid()
  );

-- Função: finalizar venda atomicamente
CREATE OR REPLACE FUNCTION public.create_sale(
  _items JSONB,
  _discount NUMERIC,
  _payment_method public.payment_method,
  _amount_received NUMERIC,
  _notes TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sale_id UUID;
  _subtotal NUMERIC := 0;
  _total NUMERIC;
  _item JSONB;
  _product RECORD;
  _qty NUMERIC;
  _price NUMERIC;
  _line_total NUMERIC;
  _user UUID := auth.uid();
BEGIN
  IF _user IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Calcular subtotal validando estoque
  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    SELECT * INTO _product FROM public.products WHERE id = (_item->>'product_id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
    _qty := (_item->>'quantity')::numeric;
    IF _product.stock < _qty THEN
      RAISE EXCEPTION 'Estoque insuficiente para %', _product.name;
    END IF;
    _price := COALESCE((_item->>'unit_price')::numeric, _product.price);
    _subtotal := _subtotal + (_qty * _price);
  END LOOP;

  _total := GREATEST(_subtotal - COALESCE(_discount,0), 0);

  INSERT INTO public.sales (cashier_id, subtotal, discount, total, payment_method, amount_received, change_amount, notes)
  VALUES (_user, _subtotal, COALESCE(_discount,0), _total, _payment_method, _amount_received,
          CASE WHEN _amount_received IS NOT NULL THEN GREATEST(_amount_received - _total,0) ELSE NULL END,
          _notes)
  RETURNING id INTO _sale_id;

  -- Inserir itens e baixar estoque
  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    SELECT * INTO _product FROM public.products WHERE id = (_item->>'product_id')::uuid;
    _qty := (_item->>'quantity')::numeric;
    _price := COALESCE((_item->>'unit_price')::numeric, _product.price);
    _line_total := _qty * _price;

    INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal)
    VALUES (_sale_id, _product.id, _product.name, _qty, _price, _line_total);

    UPDATE public.products SET stock = stock - _qty WHERE id = _product.id;

    INSERT INTO public.stock_movements (product_id, type, quantity, reason, reference_id, user_id)
    VALUES (_product.id, 'sale', -_qty, 'Venda #' || _sale_id::text, _sale_id, _user);
  END LOOP;

  RETURN _sale_id;
END;
$$;

-- Seed de categorias e produtos demo
INSERT INTO public.categories (name, color) VALUES
  ('Bebidas', '#3b82f6'),
  ('Mercearia', '#10b981'),
  ('Higiene', '#f59e0b'),
  ('Padaria', '#ef4444'),
  ('Limpeza', '#8b5cf6');

INSERT INTO public.products (name, barcode, sku, price, cost, stock, min_stock, unit, category_id) 
SELECT 'Coca-Cola 2L', '7894900011517', 'COCA2L', 9.90, 6.50, 50, 10, 'un', id FROM public.categories WHERE name='Bebidas';
INSERT INTO public.products (name, barcode, sku, price, cost, stock, min_stock, unit, category_id) 
SELECT 'Água Mineral 500ml', '7891910000147', 'AGUA500', 2.50, 1.00, 120, 30, 'un', id FROM public.categories WHERE name='Bebidas';
INSERT INTO public.products (name, barcode, sku, price, cost, stock, min_stock, unit, category_id) 
SELECT 'Arroz 5kg', '7896006711115', 'ARROZ5', 28.90, 22.00, 40, 8, 'un', id FROM public.categories WHERE name='Mercearia';
INSERT INTO public.products (name, barcode, sku, price, cost, stock, min_stock, unit, category_id) 
SELECT 'Feijão Carioca 1kg', '7896006767114', 'FEIJ1', 8.50, 5.50, 60, 15, 'un', id FROM public.categories WHERE name='Mercearia';
INSERT INTO public.products (name, barcode, sku, price, cost, stock, min_stock, unit, category_id) 
SELECT 'Sabonete Dove', '7891150026711', 'DOVE', 4.90, 2.50, 80, 20, 'un', id FROM public.categories WHERE name='Higiene';
INSERT INTO public.products (name, barcode, sku, price, cost, stock, min_stock, unit, category_id) 
SELECT 'Pão Francês', '2000001000007', 'PAOFR', 18.00, 9.00, 15, 5, 'kg', id FROM public.categories WHERE name='Padaria';
INSERT INTO public.products (name, barcode, sku, price, cost, stock, min_stock, unit, category_id) 
SELECT 'Detergente Ypê', '7896098900819', 'DETYPE', 3.20, 1.80, 100, 25, 'un', id FROM public.categories WHERE name='Limpeza';
