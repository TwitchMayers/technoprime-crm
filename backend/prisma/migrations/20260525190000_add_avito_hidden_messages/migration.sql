-- CreateTable
CREATE TABLE "MarketplaceHiddenMessage" (
    "id" SERIAL NOT NULL,
    "tenant" "Tenant" NOT NULL DEFAULT 'TECHNOPRIME',
    "platform" "MarketplacePlatform" NOT NULL DEFAULT 'AVITO',
    "marketplaceAccountId" INTEGER NOT NULL,
    "chatId" TEXT NOT NULL,
    "messageExternalId" TEXT NOT NULL,
    "hiddenById" INTEGER,
    "hiddenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceHiddenMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceHiddenMessage_tenant_marketplaceAccountId_chatId_mess_key" ON "MarketplaceHiddenMessage"("tenant", "marketplaceAccountId", "chatId", "messageExternalId");

-- CreateIndex
CREATE INDEX "MarketplaceHiddenMessage_tenant_platform_hiddenAt_idx" ON "MarketplaceHiddenMessage"("tenant", "platform", "hiddenAt");

-- CreateIndex
CREATE INDEX "MarketplaceHiddenMessage_hiddenById_hiddenAt_idx" ON "MarketplaceHiddenMessage"("hiddenById", "hiddenAt");

-- AddForeignKey
ALTER TABLE "MarketplaceHiddenMessage" ADD CONSTRAINT "MarketplaceHiddenMessage_marketplaceAccountId_fkey" FOREIGN KEY ("marketplaceAccountId") REFERENCES "MarketplaceAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceHiddenMessage" ADD CONSTRAINT "MarketplaceHiddenMessage_hiddenById_fkey" FOREIGN KEY ("hiddenById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
