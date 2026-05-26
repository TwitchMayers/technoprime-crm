-- AlterEnum
ALTER TYPE "CommunicationChannel" ADD VALUE IF NOT EXISTS 'WEBSITE';

-- AlterTable
ALTER TABLE "ClientCommunicationLog"
ADD COLUMN "readByCustomerAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ClientCommunicationLog_tenant_clientId_readByCustomerAt_idx"
ON "ClientCommunicationLog"("tenant", "clientId", "readByCustomerAt");
