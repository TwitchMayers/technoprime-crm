-- CreateTable
CREATE TABLE "MarketplaceBalanceOperation" (
    "id" SERIAL NOT NULL,
    "tenant" "Tenant" NOT NULL DEFAULT 'TECHNOPRIME',
    "platform" "MarketplacePlatform" NOT NULL,
    "marketplaceAccountId" INTEGER NOT NULL,
    "operationKey" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "itemExternalId" TEXT,
    "operationName" TEXT,
    "operationType" TEXT,
    "serviceId" INTEGER,
    "serviceName" TEXT,
    "serviceType" TEXT,
    "amountRub" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amountBonus" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payload" JSONB,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceBalanceOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceBalanceOperation_tenant_marketplaceAccountId_oper_key" ON "MarketplaceBalanceOperation"("tenant", "marketplaceAccountId", "operationKey");

-- CreateIndex
CREATE INDEX "MarketplaceBalanceOperation_tenant_platform_paidAt_idx" ON "MarketplaceBalanceOperation"("tenant", "platform", "paidAt");

-- CreateIndex
CREATE INDEX "MarketplaceBalanceOperation_tenant_itemExternalId_paidAt_idx" ON "MarketplaceBalanceOperation"("tenant", "itemExternalId", "paidAt");

-- AddForeignKey
ALTER TABLE "MarketplaceBalanceOperation" ADD CONSTRAINT "MarketplaceBalanceOperation_marketplaceAccountId_fkey" FOREIGN KEY ("marketplaceAccountId") REFERENCES "MarketplaceAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
