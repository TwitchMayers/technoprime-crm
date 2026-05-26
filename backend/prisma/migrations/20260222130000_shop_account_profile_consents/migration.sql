ALTER TABLE "ShopCustomer"
ADD COLUMN "birthDate" TIMESTAMP(3),
ADD COLUMN "deliveryCity" TEXT,
ADD COLUMN "deliveryAddress" TEXT,
ADD COLUMN "notifyOrderStatus" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notifySubscription" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notifyService" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notifyMarketing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "cookieConsentAt" TIMESTAMP(3),
ADD COLUMN "cookieConsentVersion" TEXT,
ADD COLUMN "cookieConsentAnalytics" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ShopTelegramConsent" (
  "id" SERIAL NOT NULL,
  "telegramUserId" TEXT NOT NULL,
  "telegramChatId" TEXT,
  "telegramUsername" TEXT,
  "policyVersion" TEXT NOT NULL DEFAULT '2026-02',
  "consentedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ShopTelegramConsent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShopTelegramConsent_telegramUserId_key" ON "ShopTelegramConsent"("telegramUserId");
CREATE INDEX "ShopTelegramConsent_consentedAt_idx" ON "ShopTelegramConsent"("consentedAt");
