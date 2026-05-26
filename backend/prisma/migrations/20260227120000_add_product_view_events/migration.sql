-- CreateTable
CREATE TABLE "ProductViewEvent" (
    "id" SERIAL NOT NULL,
    "tenant" "Tenant" NOT NULL DEFAULT 'TECHNOPRIME',
    "productId" INTEGER NOT NULL,
    "cookieId" TEXT,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductViewEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductViewEvent_tenant_viewedAt_idx" ON "ProductViewEvent"("tenant", "viewedAt");

-- CreateIndex
CREATE INDEX "ProductViewEvent_tenant_productId_viewedAt_idx" ON "ProductViewEvent"("tenant", "productId", "viewedAt");

-- CreateIndex
CREATE INDEX "ProductViewEvent_tenant_cookieId_viewedAt_idx" ON "ProductViewEvent"("tenant", "cookieId", "viewedAt");

-- AddForeignKey
ALTER TABLE "ProductViewEvent" ADD CONSTRAINT "ProductViewEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
