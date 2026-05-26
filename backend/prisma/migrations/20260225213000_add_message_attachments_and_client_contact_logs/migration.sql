ALTER TABLE "MarketingCampaign"
  ADD COLUMN IF NOT EXISTS "attachments" JSONB;

CREATE TABLE IF NOT EXISTS "ClientCommunicationLog" (
  "id" SERIAL PRIMARY KEY,
  "tenant" "Tenant" NOT NULL DEFAULT 'TECHNOPRIME',
  "clientId" INTEGER NOT NULL,
  "channel" "CommunicationChannel" NOT NULL,
  "status" "MarketingDeliveryStatus" NOT NULL,
  "text" TEXT,
  "attachments" JSONB,
  "errorMessage" TEXT,
  "createdById" INTEGER,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientCommunicationLog_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ClientCommunicationLog_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ClientCommunicationLog_tenant_clientId_sentAt_idx"
  ON "ClientCommunicationLog"("tenant", "clientId", "sentAt");
CREATE INDEX IF NOT EXISTS "ClientCommunicationLog_tenant_channel_sentAt_idx"
  ON "ClientCommunicationLog"("tenant", "channel", "sentAt");
CREATE INDEX IF NOT EXISTS "ClientCommunicationLog_tenant_status_sentAt_idx"
  ON "ClientCommunicationLog"("tenant", "status", "sentAt");
