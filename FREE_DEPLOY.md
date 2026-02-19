# Free Deploy Guide (Render + Vercel)

This guide keeps monthly cost at 0 for a small/personal project.

## Architecture
- Backend API: Render Free Web Service (Docker)
- Frontend Web: Vercel Hobby (Next.js)
- Database/Auth: Supabase Free (existing project)

## 1) Backend deploy (Render)
1. Push this repository to GitHub.
2. In Render, create a new Blueprint and select this repo.
3. Render will detect `render.yaml` and create `orderfriends-api-free`.
4. Set environment variables in Render service settings:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SENTRY_DSN` (optional)
- `TOSS_SECRET_KEY` (optional)
- `TOSS_CLIENT_KEY` (optional)
5. Deploy and verify health:
- `https://<your-render-service>.onrender.com/health`

## 2) Frontend deploy (Vercel)
1. Import `apps/web` as a new Vercel project.
2. Framework preset: Next.js.
3. Set Vercel environment variables:
- `NEXT_PUBLIC_API_BASE_URL=https://<your-render-service>.onrender.com`
- `NEXT_PUBLIC_SUPABASE_URL=<your supabase url>`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<your supabase anon key>`
4. Deploy and open your Vercel URL.

## 3) CORS check
If frontend calls fail by CORS, set backend env:
- `CORS_ORIGIN=https://<your-vercel-project>.vercel.app`

## 4) About existing GitHub Actions
Current CI includes DockerHub and deploy-webhook jobs for `main/develop`.
For this free path, Render/Vercel can auto-deploy directly from GitHub, so DockerHub/webhook secrets are optional.

## 5) Free-tier caveats
- Render free services may spin down when idle.
- Vercel Hobby is for personal/non-commercial usage.
- Keep production traffic expectations low on free tier.
