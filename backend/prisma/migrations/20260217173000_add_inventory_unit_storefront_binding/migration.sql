-- Add storefront binding for inventory units without moving them out of warehouse position
ALTER TABLE "InventoryUnit"
ADD COLUMN "storefrontProductId" INTEGER;

-- Backfill legacy rows that were moved to storefront cards before this migration
UPDATE "InventoryUnit" iu
SET "storefrontProductId" = iu."productId"
FROM "Product" p
WHERE iu."productId" = p."id"
  AND p."storefrontCategory" IS NOT NULL
  AND iu."storefrontProductId" IS NULL;

CREATE INDEX "InventoryUnit_tenant_storefrontProductId_status_attachedAt_idx"
ON "InventoryUnit"("tenant", "storefrontProductId", "status", "attachedAt");

ALTER TABLE "InventoryUnit"
ADD CONSTRAINT "InventoryUnit_storefrontProductId_fkey"
FOREIGN KEY ("storefrontProductId") REFERENCES "Product"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
