-- CreateTable
CREATE TABLE "MarketplaceBalanceSnapshot" (
    "id" SERIAL NOT NULL,
    "tenant" "Tenant" NOT NULL DEFAULT 'TECHNOPRIME',
    "platform" "MarketplacePlatform" NOT NULL,
    "marketplaceAccountId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "realBalance" DECIMAL(12,2),
    "bonusBalance" DECIMAL(12,2),
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceBalanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceListingDailyStat" (
    "id" SERIAL NOT NULL,
    "tenant" "Tenant" NOT NULL DEFAULT 'TECHNOPRIME',
    "platform" "MarketplacePlatform" NOT NULL,
    "marketplaceAccountId" INTEGER NOT NULL,
    "externalItemId" TEXT NOT NULL,
    "statDate" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "priceLabel" TEXT,
    "statusLabel" TEXT,
    "services" JSONB,
    "uniqViews" INTEGER NOT NULL DEFAULT 0,
    "uniqFavorites" INTEGER NOT NULL DEFAULT 0,
    "uniqContacts" INTEGER NOT NULL DEFAULT 0,
    "startAt" TIMESTAMP(3),
    "finishAt" TIMESTAMP(3),
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceListingDailyStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceConversationLearning" (
    "id" SERIAL NOT NULL,
    "tenant" "Tenant" NOT NULL DEFAULT 'TECHNOPRIME',
    "platform" "MarketplacePlatform" NOT NULL,
    "marketplaceAccountId" INTEGER NOT NULL,
    "chatId" TEXT NOT NULL,
    "messageExternalId" TEXT NOT NULL,
    "itemExternalId" TEXT,
    "itemTitle" TEXT,
    "priceLabel" TEXT,
    "counterpartName" TEXT,
    "direction" TEXT NOT NULL,
    "messageType" TEXT,
    "text" TEXT,
    "hasImage" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB,
    "messageAt" TIMESTAMP(3) NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceConversationLearning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceBalanceSnapshot_tenant_marketplaceAccountId_date_key" ON "MarketplaceBalanceSnapshot"("tenant", "marketplaceAccountId", "date");

-- CreateIndex
CREATE INDEX "MarketplaceBalanceSnapshot_tenant_platform_date_idx" ON "MarketplaceBalanceSnapshot"("tenant", "platform", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceListingDailyStat_tenant_marketplaceAccountId_externa_key" ON "MarketplaceListingDailyStat"("tenant", "marketplaceAccountId", "externalItemId", "statDate");

-- CreateIndex
CREATE INDEX "MarketplaceListingDailyStat_tenant_platform_statDate_idx" ON "MarketplaceListingDailyStat"("tenant", "platform", "statDate");

-- CreateIndex
CREATE INDEX "MarketplaceListingDailyStat_tenant_externalItemId_statDate_idx" ON "MarketplaceListingDailyStat"("tenant", "externalItemId", "statDate");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceConversationLearning_tenant_marketplaceAccountId_mes_key" ON "MarketplaceConversationLearning"("tenant", "marketplaceAccountId", "messageExternalId");

-- CreateIndex
CREATE INDEX "MarketplaceConversationLearning_tenant_platform_messageAt_idx" ON "MarketplaceConversationLearning"("tenant", "platform", "messageAt");

-- CreateIndex
CREATE INDEX "MarketplaceConversationLearning_tenant_itemExternalId_messageAt_idx" ON "MarketplaceConversationLearning"("tenant", "itemExternalId", "messageAt");

-- AddForeignKey
ALTER TABLE "MarketplaceBalanceSnapshot" ADD CONSTRAINT "MarketplaceBalanceSnapshot_marketplaceAccountId_fkey" FOREIGN KEY ("marketplaceAccountId") REFERENCES "MarketplaceAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListingDailyStat" ADD CONSTRAINT "MarketplaceListingDailyStat_marketplaceAccountId_fkey" FOREIGN KEY ("marketplaceAccountId") REFERENCES "MarketplaceAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceConversationLearning" ADD CONSTRAINT "MarketplaceConversationLearning_marketplaceAccountId_fkey" FOREIGN KEY ("marketplaceAccountId") REFERENCES "MarketplaceAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
