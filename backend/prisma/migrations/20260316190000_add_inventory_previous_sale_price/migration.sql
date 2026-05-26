ALTER TABLE "InventoryUnit"
ADD COLUMN IF NOT EXISTS "previousSalePrice" DECIMAL(10, 2);
