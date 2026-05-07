
-- ============ PROFILES: extra fields ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS pix_key TEXT,
  ADD COLUMN IF NOT EXISTS pix_key_type TEXT,
  ADD COLUMN IF NOT EXISTS pix_merchant_name TEXT,
  ADD COLUMN IF NOT EXISTS pix_merchant_city TEXT,
  ADD COLUMN IF NOT EXISTS printer_name TEXT,
  ADD COLUMN IF NOT EXISTS printer_width_mm INTEGER DEFAULT 80,
  ADD COLUMN IF NOT EXISTS printer_copies INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS auto_print BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS store_name TEXT;

-- Allow users to insert their own profile (in case trigger missed)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ============ CASH REGISTERS ============
CREATE TYPE cash_register_status AS ENUM ('open', 'closed');

CREATE TABLE public.cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_by UUID NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opening_amount NUMERIC NOT NULL DEFAULT 0,
  closing_amount NUMERIC,
  expected_amount NUMERIC,
  difference NUMERIC,
  status cash_register_status NOT NULL DEFAULT 'open',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view cash registers" ON public.cash_registers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert cash registers" ON public.cash_registers
  FOR INSERT TO authenticated WITH CHECK (opened_by = auth.uid());
CREATE POLICY "Authenticated update cash registers" ON public.cash_registers
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin delete cash registers" ON public.cash_registers
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_cash_registers_updated
  BEFORE UPDATE ON public.cash_registers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CASH MOVEMENTS ============
CREATE TYPE cash_movement_type AS ENUM ('sale', 'withdrawal', 'supply', 'expense', 'income');

CREATE TABLE public.cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  register_id UUID REFERENCES public.cash_registers(id) ON DELETE SET NULL,
  type cash_movement_type NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT,
  reference_id UUID,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view cash movements" ON public.cash_movements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert cash movements" ON public.cash_movements
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admin delete cash movements" ON public.cash_movements
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ============ ACCOUNTS PAYABLE ============
CREATE TYPE bill_status AS ENUM ('pending', 'paid', 'overdue', 'canceled');

CREATE TABLE public.accounts_payable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier TEXT,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  status bill_status NOT NULL DEFAULT 'pending',
  category TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.accounts_payable ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth view accounts payable" ON public.accounts_payable
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Auth insert accounts payable" ON public.accounts_payable
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Auth update accounts payable" ON public.accounts_payable
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Auth delete accounts payable" ON public.accounts_payable
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_accounts_payable_updated
  BEFORE UPDATE ON public.accounts_payable
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ACCOUNTS RECEIVABLE ============
CREATE TABLE public.accounts_receivable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer TEXT,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  received_at TIMESTAMPTZ,
  status bill_status NOT NULL DEFAULT 'pending',
  category TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.accounts_receivable ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth view accounts receivable" ON public.accounts_receivable
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Auth insert accounts receivable" ON public.accounts_receivable
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Auth update accounts receivable" ON public.accounts_receivable
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Auth delete accounts receivable" ON public.accounts_receivable
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_accounts_receivable_updated
  BEFORE UPDATE ON public.accounts_receivable
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
