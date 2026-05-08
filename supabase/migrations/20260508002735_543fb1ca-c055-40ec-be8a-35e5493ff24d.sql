
-- Categories: unique per owner
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_name_key;
ALTER TABLE public.categories ADD CONSTRAINT categories_owner_name_key UNIQUE (owner_id, name);

-- Suppliers table
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  document TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own select suppliers" ON public.suppliers FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own insert suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "own update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own delete suppliers" ON public.suppliers FOR DELETE TO authenticated USING (owner_id = auth.uid());
CREATE TRIGGER suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Accounts payable: receipt_url + order_description
ALTER TABLE public.accounts_payable ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE public.accounts_payable ADD COLUMN IF NOT EXISTS order_description TEXT;
ALTER TABLE public.accounts_receivable ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- Storage bucket for receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Receipts public read" ON storage.objects FOR SELECT USING (bucket_id = 'receipts');
CREATE POLICY "Users upload own receipts" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own receipts" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own receipts" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Trial expires_at editable on user_subscriptions already exists. Add admin policy (admin can update expires_at).
-- already exists: "Admin can update subscriptions"

-- Stock helper RPC: increment stock
CREATE OR REPLACE FUNCTION public.increment_product_stock(_product_id UUID, _quantity NUMERIC, _reason TEXT DEFAULT 'Entrada manual')
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _user UUID := auth.uid(); _new NUMERIC;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _quantity <= 0 THEN RAISE EXCEPTION 'Quantidade deve ser positiva'; END IF;
  UPDATE public.products SET stock = stock + _quantity WHERE id = _product_id AND owner_id = _user RETURNING stock INTO _new;
  IF _new IS NULL THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
  INSERT INTO public.stock_movements (owner_id, product_id, type, quantity, reason, user_id)
  VALUES (_user, _product_id, 'entry', _quantity, _reason, _user);
  RETURN _new;
END;
$$;
