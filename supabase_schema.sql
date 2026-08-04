-- ==============================================================================
-- LinkHive Modular Database Schema for Supabase
-- ==============================================================================
-- This script splits LinkHive's storage into granular tables.
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor).
-- ==============================================================================

-- 1. BOOKMARKS TABLE
CREATE TABLE IF NOT EXISTS public.user_bookmarks (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '[]'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TODOS TABLE
CREATE TABLE IF NOT EXISTS public.user_todos (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '[]'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. NOTES / NOTEPADS TABLE
CREATE TABLE IF NOT EXISTS public.user_notes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '[]'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. CARDS TABLE
CREATE TABLE IF NOT EXISTS public.user_cards (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '[]'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TABS TABLE
CREATE TABLE IF NOT EXISTS public.user_tabs (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '[]'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.user_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Helper to create CRUD policies for a table
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY['user_bookmarks', 'user_todos', 'user_notes', 'user_cards', 'user_tabs', 'user_settings'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    -- Drop existing policies if re-running
    EXECUTE format('DROP POLICY IF EXISTS "Users can view their own %I" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Users can insert their own %I" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Users can update their own %I" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Users can delete their own %I" ON public.%I', tbl, tbl);

    -- Create individual policies
    EXECUTE format('CREATE POLICY "Users can view their own %I" ON public.%I FOR SELECT USING (auth.uid() = user_id)', tbl, tbl);
    EXECUTE format('CREATE POLICY "Users can insert their own %I" ON public.%I FOR INSERT WITH CHECK (auth.uid() = user_id)', tbl, tbl);
    EXECUTE format('CREATE POLICY "Users can update their own %I" ON public.%I FOR UPDATE USING (auth.uid() = user_id)', tbl, tbl);
    EXECUTE format('CREATE POLICY "Users can delete their own %I" ON public.%I FOR DELETE USING (auth.uid() = user_id)', tbl, tbl);
  END LOOP;
END $$;

-- ==============================================================================
-- AUTOMATIC MIGRATION FROM LEGACY `user_data` TABLE (IF EXISTS)
-- ==============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_data') THEN
    -- Migrate Bookmarks
    INSERT INTO public.user_bookmarks (user_id, data, updated_at)
    SELECT 
      user_id, 
      COALESCE(data->'bookmarks', '[]'::jsonb),
      COALESCE(to_timestamp(((data->>'lastModified')::double precision)/1000.0), NOW())
    FROM public.user_data
    WHERE data ? 'bookmarks'
    ON CONFLICT (user_id) DO NOTHING;

    -- Migrate Todos
    INSERT INTO public.user_todos (user_id, data, updated_at)
    SELECT 
      user_id, 
      COALESCE(data->'todos', '[]'::jsonb),
      COALESCE(to_timestamp(((data->>'lastModified')::double precision)/1000.0), NOW())
    FROM public.user_data
    WHERE data ? 'todos'
    ON CONFLICT (user_id) DO NOTHING;

    -- Migrate Notepads / Notes
    INSERT INTO public.user_notes (user_id, data, updated_at)
    SELECT 
      user_id, 
      COALESCE(data->'notepads', '[]'::jsonb),
      COALESCE(to_timestamp(((data->>'lastModified')::double precision)/1000.0), NOW())
    FROM public.user_data
    WHERE data ? 'notepads'
    ON CONFLICT (user_id) DO NOTHING;

    -- Migrate Cards
    INSERT INTO public.user_cards (user_id, data, updated_at)
    SELECT 
      user_id, 
      COALESCE(data->'cards', '[]'::jsonb),
      COALESCE(to_timestamp(((data->>'lastModified')::double precision)/1000.0), NOW())
    FROM public.user_data
    WHERE data ? 'cards'
    ON CONFLICT (user_id) DO NOTHING;

    -- Migrate Tabs
    INSERT INTO public.user_tabs (user_id, data, updated_at)
    SELECT 
      user_id, 
      COALESCE(data->'tabs', '[]'::jsonb),
      COALESCE(to_timestamp(((data->>'lastModified')::double precision)/1000.0), NOW())
    FROM public.user_data
    WHERE data ? 'tabs'
    ON CONFLICT (user_id) DO NOTHING;

    -- Migrate Settings (if present in user_data)
    INSERT INTO public.user_settings (user_id, data, updated_at)
    SELECT 
      user_id, 
      COALESCE(data->'settings', '{}'::jsonb),
      COALESCE(to_timestamp(((data->>'lastModified')::double precision)/1000.0), NOW())
    FROM public.user_data
    WHERE data ? 'settings'
    ON CONFLICT (user_id) DO NOTHING;
    
    RAISE NOTICE 'Migration from user_data completed successfully.';
  END IF;
END $$;
