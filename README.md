# Bestonconnect Web App

Standalone React + Vite e-commerce platform for Bestonconnect.

## Tech Stack

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Supabase (database, auth, edge functions)

## Local Development

Prerequisites:

- Node.js 18+ (or current LTS)
- npm

Install dependencies and run:

```sh
npm install
npm run dev
```

Build for production:

```sh
npm run build
npm run preview
```

## Environment and Deployment

- Configure your Supabase project credentials in the app environment.
- For edge functions, set `APP_BASE_URL` to your production domain (for email links).
- Deploy the generated `dist` output to your hosting provider (Netlify, Vercel, Cloudflare Pages, or any static host with SPA routing support).

## Branding and Domain

All previous Loveable-specific branding hooks have been removed from this repository. Update the following with your final production values if needed:

- `index.html` metadata (`og:url`, social tags)
- Supabase edge function environment variable `APP_BASE_URL`
