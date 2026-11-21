# Vedhin Digital

Done-for-you online shops for small sellers (ladies dress + jewellery, Jodhpur/Jaipur first). Docs are in `/docs`; rules for Claude Code are in `CLAUDE.md`.

## Run
```
npm install
npm test
npm run typecheck
npm run dev      # local Worker
```

## Deploy
Cloudflare dashboard, Workers & Pages, Create, Import from Git, pick this repo. Every push to the production branch deploys. Database `vedhin-db` is already created; migrations live in `/migrations` (`npm run db:migrate:remote`).

## Status
M1 foundation: health, tenant resolution, public shop/products API, tests. Next: M2 dress template, M3 checkout.
