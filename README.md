This is a simple admin app for trending coins.

## Environment Variables

Create `.env.local` from `.env.example` and set:

- `COINGECKO_API_KEY`
- `APP_BASE_URL` (required in production for screenshot generation)
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `AUTH_TWITTER_ID`
- `AUTH_TWITTER_SECRET`

`APP_BASE_URL` must be a public URL (not localhost), because screenshot rendering is performed by an external screenshot service.

For X OAuth callbacks, set your X app callback URL to:

- `http://localhost:3000/api/auth/callback/twitter` (local)
- `https://your-domain.com/api/auth/callback/twitter` (production)

Your X app must have Read and Write permissions to post tweets with images.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Routes:

- `/` main admin page
- `/screenshot` 540x730 screenshot render page
- `/api/trending` trending coin data API
- `/api/screenshot/build` image build API (calls screenshot service)
- `/api/auth/[...nextauth]` NextAuth route handlers for X sign-in
- `/api/x/post-image` posts generated image to connected X account

## Security Notes

- Do not hardcode API keys in source code.
- Use Firebase Security Rules to restrict writes to authorized users only.
- This app is "admin style" UI, but without authentication any user who can open it can trigger writes if your Firebase rules are open.
