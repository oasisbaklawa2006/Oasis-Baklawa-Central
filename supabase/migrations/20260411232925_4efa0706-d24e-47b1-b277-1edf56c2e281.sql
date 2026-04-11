
CREATE TABLE public.premium_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  image_url text,
  video_url text,
  priority text NOT NULL DEFAULT 'greeting' CHECK (priority IN ('critical','offer','launch','greeting')),
  target_audience text NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all','new','region')),
  target_region text,
  display_duration integer NOT NULL DEFAULT 8 CHECK (display_duration BETWEEN 6 AND 30),
  trigger_delay integer NOT NULL DEFAULT 10 CHECK (trigger_delay BETWEEN 0 AND 60),
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  cta_text text,
  cta_link text,
  view_count integer NOT NULL DEFAULT 0,
  skip_count integer NOT NULL DEFAULT 0,
  completion_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.premium_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active announcements"
ON public.premium_announcements FOR SELECT TO authenticated
USING (is_active = true AND start_date <= now() AND (end_date IS NULL OR end_date >= now()));

CREATE POLICY "Staff can manage announcements"
ON public.premium_announcements FOR ALL TO authenticated
USING (public.is_staff_role(public.get_user_role(auth.uid())))
WITH CHECK (public.is_staff_role(public.get_user_role(auth.uid())));

CREATE OR REPLACE FUNCTION public.increment_announcement_counter(ann_id uuid, counter_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF counter_name = 'view' THEN
    UPDATE premium_announcements SET view_count = view_count + 1 WHERE id = ann_id;
  ELSIF counter_name = 'skip' THEN
    UPDATE premium_announcements SET skip_count = skip_count + 1 WHERE id = ann_id;
  ELSIF counter_name = 'completion' THEN
    UPDATE premium_announcements SET completion_count = completion_count + 1 WHERE id = ann_id;
  END IF;
END;
$$;
