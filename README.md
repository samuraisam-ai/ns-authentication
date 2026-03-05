This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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

## Optional allowlist

Set these in `.env.local` to restrict access. If unset, all authenticated users are allowed.

```bash
ALLOWED_EMAILS="a@b.com,c@d.com"
ALLOWED_DOMAINS="networkspace.co.za,example.com"
N8N_WEBHOOK_URL="https://n8n.srv1232006.hstgr.cloud/webhook/12c8e872-c1e9-429f-b89d-bb377e30db22"
N8N_WEBHOOK_SECRET="7e03931ecca19cca35056796812178bc9624712896145cabfa7dafde5cbf2d49"
N8N_LOG_WEBHOOK_URL="https://<n8n-host>/webhook/<log-id>"
N8N_WEBHOOK_SECRET="same secret as before"
```

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
