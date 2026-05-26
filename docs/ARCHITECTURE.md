# TechnoPrime Architecture

## Overview
- `frontend/` — CRM (staff-only)
- `shop/` — public storefront (customers)
- `backend/` — API + business logic
- `packages/` — shared UI + utilities

## Auth separation
CRM and Shop are independent auth systems:
- CRM users live in Employee table, JWT for CRM only
- Shop customers live in `ShopCustomer`, session cookie for shop only
- Tokens/cookies are not interchangeable

Shop auth (phone + Telegram):
- Phone OTP stored in `ShopAuthCode`, session in `ShopSession` cookie
- Telegram login verified via bot token (`SHOP_BOT_TOKEN`)

## API access model
- Backend listens on `127.0.0.1` in production
- Nginx exposes only CRM/Shop web apps
- Shop uses server-side calls or app routes to talk to backend
- CRM uses authenticated API routes only
- Optional `SHOP_API_KEY` protects storefront endpoints (server-side only)

## Next steps
- Add Prisma models for `ShopCustomer`, `ShopSession`, `ShopOrder`
- Add `shop-auth` module in backend
- Add API gateway routes for shop (public read, private write)

## Development notes
- Check the local Next.js docs in `node_modules/next/dist/docs/` before changing framework-specific APIs or file conventions.
