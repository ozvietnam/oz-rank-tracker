-- OZ Rank Tracker — Supabase schema
-- Chay trong Supabase Studio -> SQL Editor.
--
-- Moi tu khoa luu nhu mot blob JSONB (schema-light, de tien hoa).
-- Lich su rank nam trong data->'history' = [{ "date": "YYYY-MM-DD", "rank": 7 }, ...]

create table if not exists public.keywords (
  id          text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

create index if not exists keywords_updated_at_idx on public.keywords (updated_at);

-- App chi truy cap qua Serverless Functions bang SERVICE ROLE key (bypass RLS),
-- nen bat RLS va KHONG tao policy public -> client browser khong doc truc tiep duoc.
alter table public.keywords enable row level security;
