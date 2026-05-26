-- CreateEnum
CREATE TYPE "InventoryUnitStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD', 'RETURNED', 'WRITEOFF');

-- CreateTable
CREATE TABLE "InventoryUnit" (
    "id" SERIAL NOT NULL,
    "tenant" "Tenant" NOT NULL DEFAULT 'TECHNOPRIME',
    "productId" INTEGER NOT NULL,
    "category" "ProductCategory" NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "version" TEXT,
    "displayName" TEXT,
    "serialNumber" TEXT,
    "variantKey" TEXT,
    "variantLabel" TEXT,
    "memoryGb" INTEGER,
    "status" "InventoryUnitStatus" NOT NULL DEFAULT 'AVAILABLE',
    "attachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reservedAt" TIMESTAMP(3),
    "soldAt" TIMESTAMP(3),
    "orderId" INTEGER,
    "orderItemId" INTEGER,
    "purchasePrice" DECIMAL(10,2),
    "salePrice" DECIMAL(10,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryUnit_serialNumber_key" ON "InventoryUnit"("serialNumber");

-- CreateIndex
CREATE INDEX "InventoryUnit_tenant_productId_status_attachedAt_idx" ON "InventoryUnit"("tenant", "productId", "status", "attachedAt");

-- CreateIndex
CREATE INDEX "InventoryUnit_tenant_status_attachedAt_idx" ON "InventoryUnit"("tenant", "status", "attachedAt");

-- CreateIndex
CREATE INDEX "InventoryUnit_tenant_serialNumber_idx" ON "InventoryUnit"("tenant", "serialNumber");

-- CreateIndex
CREATE INDEX "InventoryUnit_orderId_idx" ON "InventoryUnit"("orderId");

-- CreateIndex
CREATE INDEX "InventoryUnit_orderItemId_idx" ON "InventoryUnit"("orderItemId");

-- AddForeignKey
ALTER TABLE "InventoryUnit" ADD CONSTRAINT "InventoryUnit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryUnit" ADD CONSTRAINT "InventoryUnit_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryUnit" ADD CONSTRAINT "InventoryUnit_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
