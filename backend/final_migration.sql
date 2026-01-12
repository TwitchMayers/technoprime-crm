-- 1. Удаляем старые constraints и индексы
ALTER TABLE "RichMarketProduct" 
DROP CONSTRAINT IF EXISTS "RichMarketProduct_tenant_brand_category_size_color_key";

DROP INDEX IF EXISTS "RichMarketProduct_tenant_category_brand_idx";

-- 2. Удаляем старые колонки которые нам не нужны
ALTER TABLE "RichMarketProduct" 
DROP COLUMN IF EXISTS "size",
DROP COLUMN IF EXISTS "stock";

-- 3. Добавляем новые колонки
ALTER TABLE "RichMarketProduct" 
ADD COLUMN "imageUrl" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "archivedAt" TIMESTAMP(3);

-- 4. Создаем таблицу размеров
CREATE TABLE "RichMarketProductSize" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "size" "ClothingSize" NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RichMarketProductSize_pkey" PRIMARY KEY ("id")
);

-- 5. Создаем уникальный индекс для размеров
CREATE UNIQUE INDEX "RichMarketProductSize_productId_size_key" 
ON "RichMarketProductSize"("productId", "size");

-- 6. Добавляем внешний ключ
ALTER TABLE "RichMarketProductSize" 
ADD CONSTRAINT "RichMarketProductSize_productId_fkey" 
FOREIGN KEY ("productId") REFERENCES "RichMarketProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 7. Добавляем size в OrderItem
ALTER TABLE "RichMarketOrderItem" ADD COLUMN "size" "ClothingSize";

-- 8. Создаем индекс для OrderItem
CREATE INDEX "RichMarketOrderItem_productId_size_idx" 
ON "RichMarketOrderItem"("productId", "size");

-- 9. Создаем новый уникальный constraint
ALTER TABLE "RichMarketProduct" 
ADD CONSTRAINT "RichMarketProduct_tenant_brand_category_color_key" 
UNIQUE ("tenant", "brand", "category", "color");

-- 10. Создаем индексы
CREATE INDEX "RichMarketProduct_tenant_category_brand_idx" 
ON "RichMarketProduct"("tenant", "category", "brand");

CREATE INDEX "RichMarketProduct_tenant_isArchived_idx" 
ON "RichMarketProduct"("tenant", "isArchived");