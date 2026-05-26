DO $$
BEGIN
  CREATE TYPE "CommunicationChannel" AS ENUM ('TELEGRAM', 'VK', 'MAX');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END$$;

DO $$
BEGIN
  CREATE TYPE "MarketingCampaignStatus" AS ENUM ('DRAFT', 'SENT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END$$;

DO $$
BEGIN
  CREATE TYPE "MarketingAudienceType" AS ENUM ('ALL', 'ACTIVE_ORDERS', 'SUBSCRIPTIONS', 'REGISTERED_RANGE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END$$;

DO $$
BEGIN
  CREATE TYPE "MarketingDeliveryStatus" AS ENUM ('SENT', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END$$;

ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "telegramId" TEXT,
  ADD COLUMN IF NOT EXISTS "vkId" TEXT,
  ADD COLUMN IF NOT EXISTS "maxId" TEXT,
  ADD COLUMN IF NOT EXISTS "marketingConsent" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ShopCustomer"
  ADD COLUMN IF NOT EXISTS "vkId" TEXT,
  ADD COLUMN IF NOT EXISTS "maxId" TEXT,
  ADD COLUMN IF NOT EXISTS "marketingConsent" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "MarketingCampaign" (
  "id" SERIAL PRIMARY KEY,
  "tenant" "Tenant" NOT NULL DEFAULT 'TECHNOPRIME',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "channels" "CommunicationChannel"[] NOT NULL,
  "audienceType" "MarketingAudienceType" NOT NULL DEFAULT 'ALL',
  "registeredFrom" TIMESTAMP(3),
  "registeredTo" TIMESTAMP(3),
  "status" "MarketingCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "isSending" BOOLEAN NOT NULL DEFAULT false,
  "sentCount" INTEGER NOT NULL DEFAULT 0,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "createdById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  CONSTRAINT "MarketingCampaign_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "MarketingCampaignLog" (
  "id" SERIAL PRIMARY KEY,
  "campaignId" INTEGER NOT NULL,
  "clientId" INTEGER NOT NULL,
  "channel" "CommunicationChannel" NOT NULL,
  "status" "MarketingDeliveryStatus" NOT NULL,
  "errorMessage" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketingCampaignLog_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MarketingCampaignLog_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Client_tenant_telegramId_idx"
  ON "Client"("tenant", "telegramId");
CREATE INDEX IF NOT EXISTS "Client_tenant_vkId_idx"
  ON "Client"("tenant", "vkId");
CREATE INDEX IF NOT EXISTS "Client_tenant_maxId_idx"
  ON "Client"("tenant", "maxId");
CREATE INDEX IF NOT EXISTS "Client_tenant_marketingConsent_idx"
  ON "Client"("tenant", "marketingConsent");

CREATE INDEX IF NOT EXISTS "MarketingCampaign_tenant_status_createdAt_idx"
  ON "MarketingCampaign"("tenant", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "MarketingCampaign_tenant_sentAt_idx"
  ON "MarketingCampaign"("tenant", "sentAt");
CREATE INDEX IF NOT EXISTS "MarketingCampaign_createdById_idx"
  ON "MarketingCampaign"("createdById");

CREATE INDEX IF NOT EXISTS "MarketingCampaignLog_campaignId_sentAt_idx"
  ON "MarketingCampaignLog"("campaignId", "sentAt");
CREATE INDEX IF NOT EXISTS "MarketingCampaignLog_campaignId_status_idx"
  ON "MarketingCampaignLog"("campaignId", "status");
CREATE INDEX IF NOT EXISTS "MarketingCampaignLog_clientId_channel_idx"
  ON "MarketingCampaignLog"("clientId", "channel");
