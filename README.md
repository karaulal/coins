This is a simple admin app for trending coins.

## Environment Variables

Create `.env.local` from `.env.example` and set:

- `COINGECKO_API_KEY`
- `APP_BASE_URL` (required in production for screenshot generation)

`APP_BASE_URL` must be a public URL (not localhost), because screenshot rendering is performed by an external screenshot service.

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
- `/screenshot` 540x750 screenshot render page
- `/api/trending` trending coin data API
- `/api/screenshot/build` image build API (calls screenshot service)

## Security Notes

- Do not hardcode API keys in source code.
- Use Firebase Security Rules to restrict writes to authorized users only.
- This app is "admin style" UI, but without authentication any user who can open it can trigger writes if your Firebase rules are open.
