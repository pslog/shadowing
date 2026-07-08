# Shadow IT Japanese 🗣️

Web app luyện **shadowing** tiếng Nhật chuyên ngành IT cho người Việt. Nói lại
từng câu thoại → được chấm điểm (phát âm / tốc độ / ngữ điệu) → giữ **streak**,
tích **XP**, lên **level**.

- **Speech-to-text thật**: dùng Web Speech API của trình duyệt (`ja-JP`) để lấy
  transcript, so khớp với câu mẫu bằng Levenshtein → điểm phát âm thật.
- **Supabase-backed**: lessons, sentences, profile, attempts, progress, XP được
  đọc/ghi qua Supabase khi có env. Nếu thiếu env, app fallback về localStorage.

## Chạy dev

```bash
pnpm install
pnpm dev
# mở http://localhost:3000  (Chrome/Edge để có nhận diện giọng nói)
```

> **Micro + STT chỉ hoạt động trên Chrome/Edge.** Firefox/Safari sẽ fallback
> sang chấm điểm ước lượng (vẫn chạy đủ flow).

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Web Speech API +
MediaRecorder · Supabase (sẵn sàng cắm) · Vercel.

## Cấu trúc

```
app/            login · dashboard · lessons · lessons/new · lessons/[id] · progress · api/score
components/     ui/ · layout/ · dashboard/ · lesson/ · progress/
lib/
  scoring/      pronunciation · speed · intonation · total · feedback  (rule-based, thay bằng AI sau)
  gamification/ streak · xp · level
  speech/       useRecorder (MediaRecorder + Web Speech) · tts
  store/        DataProvider (Supabase + local fallback) · engine · selectors · state
  supabase/     client · server
supabase/       schema.sql · seed.sql
```

## Scoring

`POST /api/score` nhận `{ targetText, spokenText?, originalDurationSeconds?,
userDurationSeconds?, passScore? }` và trả `{ pronunciation, speed, intonation,
total, passed, feedback }`. Đây là **điểm nối duy nhất** để sau này thay bằng
API AI thật — hợp đồng request/response giữ nguyên.

Công thức: `total = pronunciation*0.5 + speed*0.3 + intonation*0.2`, pass khi
`total >= 80`.

## Supabase

1. Tạo project Supabase, chạy `supabase/schema.sql` rồi `supabase/seed.sql`.
2. Bật Google OAuth trong Authentication → Providers.
3. Tạo Storage bucket `recordings` public.
4. Copy `.env.example` → `.env.local`, điền `NEXT_PUBLIC_SUPABASE_URL` và
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Để deploy tự động schema, seed resource và audio, thêm `SUPABASE_DB_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, rồi chạy:

```bash
python scripts/deploy-supabase-resources.py
```

## Deploy

Đẩy lên Vercel, thêm 2 biến env ở trên (nếu dùng Supabase). Không cần server
riêng — chấm điểm chạy trong Next.js Route Handler.
