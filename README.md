# OZ Rank Tracker v3.1

**Theo doi tu khoa SEO cho thutucxuatnhapkhau.com**

Dashboard quan ly rank keywords — React + Vite, deploy tren Vercel (static + serverless functions),
co dong bo cloud, lich su rank, auto-check theo lich, bao cao SEO va canh bao Telegram.

## Kien truc

- **Frontend**: React 18 + Vite (build ra `dist/`, khong con Babel chay tren trinh duyet).
- **Serverless Functions** (`/api`): chay tren Vercel, giu toan bo secret o server.
  - `GET /api/check-rank?q=` — proxy SerpAPI (an key + tranh CORS).
  - `GET /api/account` — quota that cua tai khoan SerpAPI.
  - `GET|POST /api/sync` — dong bo tu khoa qua Supabase (POST chi upsert phan da sua).
  - `GET /api/cron-check` — cron hang ngay: check rank + GSC + lich su + canh bao/digest Telegram.
  - `GET /api/gsc` — keo Clicks/Impressions/Position tu Google Search Console.
  - `POST /api/lead` — webhook cho form website: tu cong don leads vao tu khoa khop.
- **Bao mat**: set `APP_TOKEN` de khoa toan bo `/api/*` (nhap token qua nut 🔑 tren dashboard).
- **Luu tru**: localStorage (offline cache) + Supabase (dong bo da thiet bi). App van chay khi chua cau hinh gi.

## Tinh nang

- Them / xoa / sua rank keywords, theo cluster.
- **Check rank Google Vietnam tu dong** qua SerpAPI (server-side).
- **Tiet kiem quota SerpAPI**: tu khoa ⭐ (uu tien) check hang ngay, con lai moi `CHECK_INTERVAL_DAYS` ngay;
  cron chay theo ngan sach thoi gian nen khong bao gio timeout — phan chua kip check don sang lan sau.
- **Lich su rank + sparkline** cho moi tu khoa.
- **Bao cao SEO** (nut "Bao Cao"): xu huong rank trung binh 30 ngay, phan bo Top 3/10/20, top bien dong 7 ngay.
- Metrics: Top 3, Top 10, CTR TB, Clicks, Leads, Conv%.
- **Dong bo cloud** (Supabase) — chi push keyword da sua (an toan khi dung nhieu may).
- **Cron tu dong** hang ngay: check rank + sync GSC + **canh bao Telegram** khi rank tut/len Top
  + **digest tuan** (thu Hai) tong hop Top 3/10, clicks, leads.
- **Sync GSC**: tu dong dien Clicks/Impressions/Position tu Search Console (ca trong cron).
- **Webhook leads**: form tren website goi `POST /api/lead` de tu cong don leads.
- Export CSV (escape chuan RFC 4180).

## Chay local

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests (node --test)
npm run build    # build production -> dist/
```

> App chay duoc ngay khong can env. Cac tinh nang server (check rank, sync, cron, GSC)
> chi bat khi ban cau hinh bien moi truong tuong ung (xem `.env.example`).

CI: GitHub Actions chay `npm test` + `npm run build` cho moi push/PR vao `main`.

## Deploy len Vercel

1. Import repo vao https://vercel.com/new (framework tu nhan dien la **Vite**).
2. Vao **Settings → Environment Variables**, them cac bien can dung (xem `.env.example`).
3. Redeploy.

### Phase 0 — Bao mat API (khuyen nghi)
- Set `APP_TOKEN` = chuoi ngau nhien dai. Sau khi deploy, mo dashboard → bam nut **🔑** → dan token.
- Khong set thi API mo nhu truoc (tien test, khong khuyen nghi cho production).

### Phase 1 — SerpAPI (bat buoc de auto-check rank)
- Lay key tai https://serpapi.com/manage-api-key.
- Set `SERP_API_KEY`. (Key cu da hardcode trong code phai **revoke** o SerpAPI.)

### Phase 2 — Supabase (dong bo + lich su)
1. Tao project tai https://supabase.com → SQL Editor → chay `supabase-schema.sql`.
2. Project Settings → API: copy **Project URL** va **service_role key**.
3. Set `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`.

### Phase 3 — Cron + Telegram (auto-check + canh bao)
1. Cron da khai bao trong `vercel.json` (`/api/cron-check`, 01:00 UTC hang ngay, `maxDuration` 60s).
2. Set `CRON_SECRET` (chuoi ngau nhien) — Vercel cron tu gui kem de xac thuc.
3. Tao bot Telegram qua **@BotFather** → lay token; lay chat ID (vd qua @userinfobot).
4. Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. Tuy chon:
   - `ALERT_DROP_THRESHOLD` (mac dinh 3) — nguong canh bao tut hang.
   - `CHECK_INTERVAL_DAYS` (mac dinh 3) — tan suat check tu khoa thuong (tu khoa ⭐ luon check hang ngay).
   - `CRON_TIME_BUDGET_MS` (mac dinh 45000) — ngan sach thoi gian moi lan cron.
   - `WEEKLY_DIGEST_DAY` (mac dinh 1 = thu Hai UTC) — ngay gui digest tuan.

### Phase 3 (tuy chon) — Google Search Console (auto Clicks/Impr/Position)
1. Tao **service account** tren Google Cloud, bat **Search Console API**, tao JSON key.
2. Trong GSC, chia se property voi email service account.
3. Set `GSC_CLIENT_EMAIL`, `GSC_PRIVATE_KEY`, `GSC_SITE_URL`. Cron se tu sync moi ngay,
   hoac bam **Sync GSC** trong app.

### Phase 4 (tuy chon) — Webhook leads tu form website
1. Set `LEAD_WEBHOOK_SECRET` (fallback: dung chung `APP_TOKEN`).
2. Form tren website goi:
   ```bash
   curl -X POST https://<domain-app>/api/lead \
     -H 'Content-Type: application/json' \
     -H 'x-lead-secret: <LEAD_WEBHOOK_SECRET>' \
     -d '{"url": "https://thutucxuatnhapkhau.com/cach-xin-co-form-e/"}'
   ```
   Khop theo `url` (bo qua dau `/` cuoi) hoac `keyword` (khong phan biet hoa thuong);
   tuy chon `count` de cong nhieu lead mot luc.

## Brand
OZ Viet Nam — thu tuc XNK, van chuyen hang Trung Quoc, tu van HS code.
Website: https://thutucxuatnhapkhau.com
