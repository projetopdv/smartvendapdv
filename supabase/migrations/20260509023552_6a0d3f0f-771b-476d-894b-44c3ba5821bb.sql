
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS support_display_name TEXT;

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  assigned_to UUID,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_unread INTEGER NOT NULL DEFAULT 0,
  support_unread INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tickets_select" ON public.support_tickets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'support') OR has_role(auth.uid(),'admin'));
CREATE POLICY "tickets_insert" ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "tickets_update" ON public.support_tickets FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'support') OR has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_role TEXT NOT NULL DEFAULT 'user',
  type TEXT NOT NULL DEFAULT 'text',
  content TEXT,
  audio_url TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_ticket ON public.messages(ticket_id, created_at);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msg_select" ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id
    AND (t.user_id = auth.uid() OR has_role(auth.uid(),'support') OR has_role(auth.uid(),'admin'))));
CREATE POLICY "msg_insert" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id
      AND (t.user_id = auth.uid() OR has_role(auth.uid(),'support') OR has_role(auth.uid(),'admin'))));
CREATE POLICY "msg_update" ON public.messages FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id
    AND (t.user_id = auth.uid() OR has_role(auth.uid(),'support') OR has_role(auth.uid(),'admin'))));

CREATE TABLE IF NOT EXISTS public.broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bc_select" ON public.broadcasts FOR SELECT TO authenticated USING (true);
CREATE POLICY "bc_insert" ON public.broadcasts FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND has_role(auth.uid(),'admin'));
CREATE POLICY "bc_delete" ON public.broadcasts FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.broadcast_reads (
  broadcast_id UUID NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (broadcast_id, user_id)
);
ALTER TABLE public.broadcast_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "br_all" ON public.broadcast_reads FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id UUID PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'offline',
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "presence_self_write" ON public.user_presence FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "presence_admins_read" ON public.user_presence FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'support') OR user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcasts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;

INSERT INTO storage.buckets (id, name, public) VALUES ('avatars','avatars',true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-audio','chat-audio',true) ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "avatars_read" ON storage.objects;
CREATE POLICY "avatars_read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "avatars_write" ON storage.objects;
CREATE POLICY "avatars_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
CREATE POLICY "avatars_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "avatars_delete" ON storage.objects;
CREATE POLICY "avatars_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "chat_audio_read" ON storage.objects;
CREATE POLICY "chat_audio_read" ON storage.objects FOR SELECT USING (bucket_id = 'chat-audio');
DROP POLICY IF EXISTS "chat_audio_write" ON storage.objects;
CREATE POLICY "chat_audio_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-audio');

CREATE OR REPLACE FUNCTION public.get_or_create_my_ticket()
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id UUID; _u UUID := auth.uid();
BEGIN
  IF _u IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT id INTO _id FROM public.support_tickets WHERE user_id = _u AND status <> 'closed' LIMIT 1;
  IF _id IS NULL THEN
    INSERT INTO public.support_tickets (user_id) VALUES (_u) RETURNING id INTO _id;
  END IF;
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.touch_ticket_on_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.support_tickets SET
    last_message_at = NEW.created_at,
    updated_at = now(),
    user_unread = CASE WHEN NEW.sender_role <> 'user' THEN user_unread + 1 ELSE user_unread END,
    support_unread = CASE WHEN NEW.sender_role = 'user' THEN support_unread + 1 ELSE support_unread END
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_touch_ticket ON public.messages;
CREATE TRIGGER trg_touch_ticket AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_ticket_on_message();
