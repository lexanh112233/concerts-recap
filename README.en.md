# Concert Journal

[Tiếng Việt](README.md) · **English**

A personal website for the concerts you have been to: **tickets, photos, videos, your notes and what you spent**. Every night becomes a ticket; the admin area is a paper notebook you flip through. The interface comes in Vietnamese and English (your journal text stays as you wrote it).

- **No coding needed.** Follow the 5 steps below (about 30–45 minutes); nothing to install on your computer.
- Runs entirely on **free tiers** of MongoDB Atlas, Cloudflare R2 and Vercel.
- Your data lives in your own accounts.

> The Vietnamese README has the full, screenshot-free walkthrough for non-technical users, a troubleshooting table and a FAQ. This page is the short version. Dashboards of the services below change often, so button names may differ slightly; every step links to the official docs.

## Overview

You will create three free accounts and copy a few values between them:

| Service | Used for |
| --- | --- |
| [GitHub](https://github.com/signup) | Holds your copy of the code |
| [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) | Database for the text (events, dates, notes, costs) |
| [Cloudflare R2](https://dash.cloudflare.com/sign-up) | Storage for photos and videos (optional; may ask for a payment card to activate, free within the free quota) |
| [Vercel](https://vercel.com) | Hosts the website (Hobby plan is for **personal, non-commercial** use only) |

Keep a private note with the values you collect (they contain passwords and keys, never share them):

```text
MONGODB_URI, ADMIN_PASSWORD, NEXT_PUBLIC_YOUR_NAME
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL
```

## Step 1: MongoDB Atlas (database)

1. Sign up and create a free **M0** cluster ([guide](https://www.mongodb.com/docs/atlas/getting-started/)).
2. **Database Access → Add New Database User:** choose a username and a password made of **letters and digits only** (special characters must be URL-encoded), with the **Read and write to any database** role.
3. **Network Access → Add IP Address → Allow Access From Anywhere** (`0.0.0.0/0`). Vercel's free tier has no fixed IP, so the database is protected by the user/password instead.
4. **Database → Connect → Drivers**, copy the `mongodb+srv://…` string, replace `<password>` with your password and **add a database name** right after `.mongodb.net/` and before `?`:

   ```text
   mongodb+srv://nhatky:MYPASSWORD@cluster0.abcde.mongodb.net/concerts-recap?retryWrites=true&w=majority
   ```

   This is your `MONGODB_URI`.

## Step 2: Cloudflare R2 (photos and videos, optional, can be done later)

Without it the site works, you just cannot attach photos or videos.

1. In the Cloudflare dashboard open **R2 Object Storage → Create bucket** (name → `R2_BUCKET`).
2. Bucket → **Settings → Public Development URL → Enable** (type `allow`). Copy the **Public Bucket URL** (`https://pub-….r2.dev`, no trailing `/`) → `R2_PUBLIC_URL`. `r2.dev` URLs are rate-limited and meant for development: for a busy site attach a custom domain instead ([docs](https://developers.cloudflare.com/r2/buckets/public-buckets/)).
3. **R2 → Account Details → API Tokens → Manage → Create Account API token**, permission **Object Read & Write** (needed to upload *and* delete), scoped to your bucket. Copy the **Access Key ID** and **Secret Access Key** (shown only once) → `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`. Your **Account ID** is on the R2 page → `R2_ACCOUNT_ID` ([docs](https://developers.cloudflare.com/r2/api/tokens/)).

## Step 3: Deploy on Vercel

Click the button, sign in with GitHub, keep the suggested names, and fill in the three variables (`MONGODB_URI`, `ADMIN_PASSWORD` — a long passphrase —, `NEXT_PUBLIC_YOUR_NAME` — your name, shown as "Your Name đi show"). Deploy takes 2–3 minutes.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Flexanh112233%2Fconcerts-recap&project-name=nhat-ky-di-show&repository-name=nhat-ky-di-show&env=MONGODB_URI,ADMIN_PASSWORD,NEXT_PUBLIC_YOUR_NAME&envDescription=MONGODB_URI%3A%20chu%E1%BB%97i%20k%E1%BA%BFt%20n%E1%BB%91i%20MongoDB%20%28B%C6%B0%E1%BB%9Bc%202%29.%20ADMIN_PASSWORD%3A%20m%E1%BA%ADt%20kh%E1%BA%A9u%20v%C3%A0o%20trang%20qu%E1%BA%A3n%20tr%E1%BB%8B,%20t%E1%BB%B1%20%C4%91%E1%BA%B7t%20v%C3%A0%20n%C3%AAn%20%C4%91%E1%BA%B7t%20d%C3%A0i.%20NEXT_PUBLIC_YOUR_NAME%3A%20t%C3%AAn%20c%E1%BB%A7a%20b%E1%BA%A1n.&envLink=https%3A%2F%2Fgithub.com%2Flexanh112233%2Fconcerts-recap%23bien-moi-truong&envDefaults=%7B%22NEXT_PUBLIC_YOUR_NAME%22%3A%22M%C3%ACnh%22%7D)

You will get an address like `https://nhat-ky-di-show.vercel.app` showing an empty stage ("No nights yet"; the English version is at `/en`).

## Step 4: First use, and enable photos

1. Open `/en/admin` (or `/admin` for Vietnamese). Type your `ADMIN_PASSWORD` on the notebook's cover label and press the button; the notebook opens. **Add event**, fill in the details, save: a ticket appears on the home page.
2. Photos/videos (only if you did Step 2): in Vercel → **Settings → Environment Variables** add the five `R2_…` variables, then **Deployments → ⋯ → Redeploy** (variables only take effect after a redeploy).
3. Allow uploads from your site: Cloudflare → R2 → your bucket → **Settings → CORS Policy → Add CORS policy**:

   ```json
   [
     {
       "AllowedOrigins": ["https://nhat-ky-di-show.vercel.app"],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["Content-Type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   Use your real address, without a trailing `/`. Add your custom domain here later if you set one up.

## Environment variables

| Variable | Required | Meaning |
| --- | --- | --- |
| `MONGODB_URI` | yes | MongoDB connection string, **including a database name** |
| `ADMIN_PASSWORD` | yes | Password for `/admin` (use 12+ characters). Unset = admin is disabled |
| `NEXT_PUBLIC_YOUR_NAME` | no | Your name, shown as "Your Name đi show" (default "Mình"). Baked in at build time: redeploy after changing |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | for photos/videos | Cloudflare R2. All five are needed. Token needs **Object Read & Write**. `R2_PUBLIC_URL` is also the only host images may be shown from |

## Security

Built in: HTML sanitizing for journal text (XSS), Server Actions with Origin checks + `SameSite`/`HttpOnly`/`Secure` `__Host-` cookie (CSRF), Content-Security-Policy and anti-framing headers, login throttling (10 wrong passwords / 15 min / IP), scrypt-derived session signing key. Known limitations and how to report a vulnerability privately: [SECURITY.md](SECURITY.md). Use a long admin password and never share your environment variables. Files in the R2 bucket are public to anyone with the link.

## For developers

Node 22 and pnpm 10 (`corepack enable`):

```bash
git clone https://github.com/lexanh112233/concerts-recap.git
cd concerts-recap
corepack enable && pnpm install
cp .env.example .env.local   # fill in MONGODB_URI and ADMIN_PASSWORD (and R2_* if needed)
pnpm dev                     # http://localhost:3000

pnpm lint && pnpm typecheck && pnpm test:run
```

Next.js 16 (App Router, Server Actions, ISR), React 19, TypeScript, Tailwind CSS 4, Mongoose, Cloudflare R2 (S3 API), TipTap, Vitest. Language is path-based (`/` Vietnamese, `/en` English; `/admin` and `/en/admin`), so public pages stay static. More architecture notes are in the Vietnamese README ("Dành cho lập trình viên"); advanced operations in [docs/deploy.md](docs/deploy.md).

## License

[MIT](LICENSE) © 2026 lexanh112233. (Vercel's Hobby plan itself is restricted to personal, non-commercial projects.)
