# Deploy on TimeWeb (VPS)

## 1) Build
```bash
# backend
cd backend
npm ci
npm run build

# CRM frontend
cd ../frontend
npm ci
npm run build

# Shop
cd ../shop
npm ci
npm run build
```

## 2) PM2
```bash
cd /path/to/repo
pm2 start infra/pm2/ecosystem.config.cjs --env production
pm2 save
```

## 3) Nginx
- Place `infra/nginx/technoprimestore.conf` into `/etc/nginx/sites-available/`
- Symlink to `sites-enabled/` and reload nginx

## 4) SSL
```bash
sudo certbot --nginx -d technoprimestore.ru -d crm.technoprimestore.ru
```

## 5) Security
- Keep backend bound to `127.0.0.1`
- Do not open port 4000 in firewall
- Shop uses server-side API calls only
- Optional: set `SHOP_API_KEY` in pm2 envs and shop `.env` for extra protection

## 6) Shop Auth
- `SHOP_BOT_TOKEN` for Telegram login
- `NEXT_PUBLIC_TELEGRAM_BOT_NAME` in shop env
- `SHOP_OTP_SECRET` for phone OTP hashing
