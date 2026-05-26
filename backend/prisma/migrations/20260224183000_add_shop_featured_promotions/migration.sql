-- Add promotion metadata for storefront featured blocks
ALTER TABLE "ShopFeaturedItem"
  ADD COLUMN "promoBlock" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "promoEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "promoPrice" DECIMAL(10,2),
  ADD COLUMN "promoOldPrice" DECIMAL(10,2),
  ADD COLUMN "promoEndsAt" TIMESTAMP(3);

CREATE INDEX "ShopFeaturedItem_promoBlock_promoEnabled_promoEndsAt_idx"
  ON "ShopFeaturedItem"("promoBlock", "promoEnabled", "promoEndsAt");
