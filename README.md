# OZ Rank Tracker v3.0

**Theo doi tu khoa SEO cho thutucxuatnhapkhau.com**

Dashboard quan ly rank keywords — React + Vite, deploy tren Vercel (static + serverless functions),
co dong bo cloud, lich su rank, auto-check theo lich va canh bao Telegram.

## Kien truc

- **Frontend**: React 18 + Vite (build ra `dist/`, khong con Babel chay tren trinh duyet).
- **Serverless Functions** (`/api`): chay tren Vercel, giu toan bo secret o server.
  - `GET /api/check-rank?q=` — proxy SerpAPI (an key + tranh CORS).
  - `GET /api/account` — quota that cua tai khoan SerpAPI.
  - `GET|POST /api/sync` — dong bo tu khoa qua Supabase.
  - `GET /api/cron-check` — cron hang ngay: check rank + luu lich su + canh bao Telegram.
  - `GET /api/gsc` — keo Clicks/Impressions tu Google Search Console.
- **Luu tru**: localStorage (offline cache) + Supabase (dong bo da thiet bi). App van chay khi chua cau hinh gi.

## Tinh nang

- Them / xoa / sua rank keywords, theo cluster.
- **Check rank Google Vietnam tu dong** qua SerpAPI (server-side).
- **Lich su rank + sparkline** cho moi tu khoa.
- Metrics: Top 3, Top 10, CTR TB, Clicks, Leads, Conv%.
- **Dong bo cloud** (Supabase) — khong mat data khi doi may/trinh duyet.
- **Cron tu dong** check rank hang ngay + **canh bao Telegram** khi rank tut/len Top.
- **Sync GSC**: tu dong dien Clicks/Impressions tu Search Console.
- Export CSV.

## Chay local

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build production -> dist/
```

> App chay duoc ngay khong can env. Cac tinh nang server (check rank, sync, cron, GSC)
> chi bat khi ban cau hinh bien moi truong tuong ung (xem `.env.example`).

## Deploy len Vercel

1. Import repo vao https://vercel.com/new (framework tu nhan dien la **Vite**).
2. Vao **Settings → Environment Variables**, them cac bien can dung (xem `.env.example`).
3. Redeploy.

### Phase 1 — SerpAPI (bat buoc de auto-check rank)
- Lay key tai https://serpapi.com/manage-api-key.
- Set `SERP_API_KEY`. (Key cu da hardcode trong code phai **revoke** o SerpAPI.)

### Phase 2 — Supabase (dong bo + lich su)
1. Tao project tai https://supabase.com → SQL Editor → chay `supabase-schema.sql`.
2. Project Settings → API: copy **Project URL** va **service_role key**.
3. Set `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`.

### Phase 3 — Cron + Telegram (auto-check + canh bao)
1. Cron da khai bao trong `vercel.json` (`/api/cron-check`, 01:00 UTC hang ngay).
2. Set `CRON_SECRET` (chuoi ngau nhien) — Vercel cron tu gui kem de xac thuc.
3. Tao bot Telegram qua **@BotFather** → lay token; lay chat ID (vd qua @userinfobot).
4. Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. Tuy chon `ALERT_DROP_THRESHOLD` (mac dinh 3).

### Phase 3 (tuy chon) — Google Search Console (auto Clicks/Impr)
1. Tao **service account** tren Google Cloud, bat **Search Console API**, tao JSON key.
2. Trong GSC, chia se property voi email service account.
3. Set `GSC_CLIENT_EMAIL`, `GSC_PRIVATE_KEY`, `GSC_SITE_URL`. Bam **Sync GSC** trong app.

## Brand
OZ Viet Nam — thu tuc XNK, van chuyen hang Trung Quoc, tu van HS code.
Website: https://thutucxuatnhapkhau.com
