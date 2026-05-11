-- ============ AUDIT LOG DE CHAMADOS ============
CREATE TABLE IF NOT EXISTS public.support_ticket_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL,
  actor_id UUID NOT NULL,
  actor_name TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  outcome TEXT,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stl_ticket ON public.support_ticket_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_stl_created ON public.support_ticket_logs(created_at DESC);

ALTER TABLE public.support_ticket_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stl_select ON public.support_ticket_logs;
CREATE POLICY stl_select ON public.support_ticket_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'support'::app_role));

DROP POLICY IF EXISTS stl_insert ON public.support_ticket_logs;
CREATE POLICY stl_insert ON public.support_ticket_logs FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- ============ IMAGENS NO CHAT ============
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS image_url TEXT;

-- ============ DELETE DE CHAMADOS ============
DROP POLICY IF EXISTS tickets_delete ON public.support_tickets;
CREATE POLICY tickets_delete ON public.support_tickets FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'support'::app_role));

DROP POLICY IF EXISTS msg_delete ON public.messages;
CREATE POLICY msg_delete ON public.messages FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = messages.ticket_id
      AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'support'::app_role))
  ));

-- ============ STORAGE: chat-images ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "chat-images public read" ON storage.objects;
CREATE POLICY "chat-images public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-images');

DROP POLICY IF EXISTS "chat-images auth insert" ON storage.objects;
CREATE POLICY "chat-images auth insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-images');

-- ============ STORAGE: avatars (idempotente) ============
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
CREATE POLICY "avatars public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars auth insert" ON storage.objects;
CREATE POLICY "avatars auth insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars auth update" ON storage.objects;
CREATE POLICY "avatars auth update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars auth delete" ON storage.objects;
CREATE POLICY "avatars auth delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars');