-- Decommission RichMarket domain and normalize shared data.

DELETE FROM "MarketingCampaignLog"
WHERE "campaignId" IN (
  SELECT "id" FROM "MarketingCampaign" WHERE "tenant" = 'RICHMARKET'
)
OR "clientId" IN (
  SELECT "id" FROM "Client" WHERE "tenant" = 'RICHMARKET'
);

DELETE FROM "ClientCommunicationLog"
WHERE "tenant" = 'RICHMARKET'
OR "clientId" IN (
  SELECT "id" FROM "Client" WHERE "tenant" = 'RICHMARKET'
);

DELETE FROM "ProductViewEvent"
WHERE "tenant" = 'RICHMARKET'
OR "productId" IN (
  SELECT "id" FROM "Product" WHERE "tenant" = 'RICHMARKET'
);

DELETE FROM "ShopFeaturedItem"
WHERE "productId" IN (
  SELECT "id" FROM "Product" WHERE "tenant" = 'RICHMARKET'
)
OR "kitId" IN (
  SELECT "id" FROM "Kit" WHERE "tenant" = 'RICHMARKET'
);

DELETE FROM "KitItem"
WHERE "kitId" IN (
  SELECT "id" FROM "Kit" WHERE "tenant" = 'RICHMARKET'
)
OR "productId" IN (
  SELECT "id" FROM "Product" WHERE "tenant" = 'RICHMARKET'
);

DELETE FROM "InventoryUnit"
WHERE "tenant" = 'RICHMARKET'
OR "productId" IN (
  SELECT "id" FROM "Product" WHERE "tenant" = 'RICHMARKET'
)
OR "storefrontProductId" IN (
  SELECT "id" FROM "Product" WHERE "tenant" = 'RICHMARKET'
)
OR "orderId" IN (
  SELECT "id" FROM "Order" WHERE "tenant" = 'RICHMARKET'
);

DELETE FROM "OrderComment"
WHERE "orderId" IN (
  SELECT "id" FROM "Order" WHERE "tenant" = 'RICHMARKET'
);

DELETE FROM "Task"
WHERE "tenant" = 'RICHMARKET'
OR "clientId" IN (
  SELECT "id" FROM "Client" WHERE "tenant" = 'RICHMARKET'
)
OR "orderId" IN (
  SELECT "id" FROM "Order" WHERE "tenant" = 'RICHMARKET'
);

DELETE FROM "Subscription"
WHERE "tenant" = 'RICHMARKET'
OR "clientId" IN (
  SELECT "id" FROM "Client" WHERE "tenant" = 'RICHMARKET'
);

DELETE FROM "TradeIn"
WHERE "tenant" = 'RICHMARKET'
OR "clientId" IN (
  SELECT "id" FROM "Client" WHERE "tenant" = 'RICHMARKET'
)
OR "newOrderId" IN (
  SELECT "id" FROM "Order" WHERE "tenant" = 'RICHMARKET'
);

DELETE FROM "OrderItem"
WHERE "orderId" IN (
  SELECT "id" FROM "Order" WHERE "tenant" = 'RICHMARKET'
)
OR "productId" IN (
  SELECT "id" FROM "Product" WHERE "tenant" = 'RICHMARKET'
);

DELETE FROM "ClientSlot"
WHERE "clientId" IN (
  SELECT "id" FROM "Client" WHERE "tenant" = 'RICHMARKET'
)
OR "sharingSystemId" IN (
  SELECT "id" FROM "SharingSystem" WHERE "tenant" = 'RICHMARKET'
);

DELETE FROM "SharingSystem"
WHERE "tenant" = 'RICHMARKET';

DELETE FROM "DonorAccount"
WHERE "tenant" = 'RICHMARKET';

DELETE FROM "Order"
WHERE "tenant" = 'RICHMARKET';

DELETE FROM "ProductMedia"
WHERE "productId" IN (
  SELECT "id" FROM "Product" WHERE "tenant" = 'RICHMARKET'
);

DELETE FROM "Client"
WHERE "tenant" = 'RICHMARKET';

DELETE FROM "Product"
WHERE "tenant" = 'RICHMARKET';

DELETE FROM "Kit"
WHERE "tenant" = 'RICHMARKET';

DELETE FROM "AnalyticsDaily"
WHERE "tenant" = 'RICHMARKET';

DELETE FROM "AdSpend"
WHERE "tenant" = 'RICHMARKET';

DELETE FROM "MarketingCampaign"
WHERE "tenant" = 'RICHMARKET';

DELETE FROM "Notification"
WHERE "tenant" = 'RICHMARKET';

DELETE FROM "AuditLog"
WHERE "tenant" = 'RICHMARKET';

UPDATE "Employee"
SET "role" = 'MANAGER'
WHERE "role" IN ('RICHMARKET_CEO', 'RICHMARKET_MANAGER');

UPDATE "Employee"
SET "tenant" = NULL
WHERE "tenant" = 'RICHMARKET';

DROP TABLE IF EXISTS "RichMarketOrderComment";
DROP TABLE IF EXISTS "RichMarketOrderItem";
DROP TABLE IF EXISTS "RichMarketTask";
DROP TABLE IF EXISTS "RichMarketOrder";
DROP TABLE IF EXISTS "RichMarketProductSize";
DROP TABLE IF EXISTS "RichMarketProduct";
DROP TABLE IF EXISTS "RichMarketClient";
DROP TYPE IF EXISTS "ClothingSize";
DROP TYPE IF EXISTS "ClothingCategory";

ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'TECHNICAL_SPECIALIST', 'SUPER_ADMIN');
ALTER TABLE "Employee" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "Employee"
ALTER COLUMN "role" TYPE "Role"
USING ("role"::text::"Role");
ALTER TABLE "Employee" ALTER COLUMN "role" SET DEFAULT 'MANAGER';
DROP TYPE "Role_old";

ALTER TYPE "Tenant" RENAME TO "Tenant_old";
CREATE TYPE "Tenant" AS ENUM ('TECHNOPRIME');

ALTER TABLE "Employee"
ALTER COLUMN "tenant" TYPE "Tenant"
USING (
  CASE
    WHEN "tenant" IS NULL THEN NULL
    ELSE "tenant"::text::"Tenant"
  END
);

ALTER TABLE "Client" ALTER COLUMN "tenant" DROP DEFAULT;
ALTER TABLE "Client"
ALTER COLUMN "tenant" TYPE "Tenant"
USING ("tenant"::text::"Tenant");
ALTER TABLE "Client" ALTER COLUMN "tenant" SET DEFAULT 'TECHNOPRIME';

ALTER TABLE "Product" ALTER COLUMN "tenant" DROP DEFAULT;
ALTER TABLE "Product"
ALTER COLUMN "tenant" TYPE "Tenant"
USING ("tenant"::text::"Tenant");
ALTER TABLE "Product" ALTER COLUMN "tenant" SET DEFAULT 'TECHNOPRIME';

ALTER TABLE "Order" ALTER COLUMN "tenant" DROP DEFAULT;
ALTER TABLE "Order"
ALTER COLUMN "tenant" TYPE "Tenant"
USING ("tenant"::text::"Tenant");
ALTER TABLE "Order" ALTER COLUMN "tenant" SET DEFAULT 'TECHNOPRIME';

ALTER TABLE "InventoryUnit" ALTER COLUMN "tenant" DROP DEFAULT;
ALTER TABLE "InventoryUnit"
ALTER COLUMN "tenant" TYPE "Tenant"
USING ("tenant"::text::"Tenant");
ALTER TABLE "InventoryUnit" ALTER COLUMN "tenant" SET DEFAULT 'TECHNOPRIME';

ALTER TABLE "Subscription" ALTER COLUMN "tenant" DROP DEFAULT;
ALTER TABLE "Subscription"
ALTER COLUMN "tenant" TYPE "Tenant"
USING ("tenant"::text::"Tenant");
ALTER TABLE "Subscription" ALTER COLUMN "tenant" SET DEFAULT 'TECHNOPRIME';

ALTER TABLE "Task" ALTER COLUMN "tenant" DROP DEFAULT;
ALTER TABLE "Task"
ALTER COLUMN "tenant" TYPE "Tenant"
USING ("tenant"::text::"Tenant");
ALTER TABLE "Task" ALTER COLUMN "tenant" SET DEFAULT 'TECHNOPRIME';

ALTER TABLE "TradeIn" ALTER COLUMN "tenant" DROP DEFAULT;
ALTER TABLE "TradeIn"
ALTER COLUMN "tenant" TYPE "Tenant"
USING ("tenant"::text::"Tenant");
ALTER TABLE "TradeIn" ALTER COLUMN "tenant" SET DEFAULT 'TECHNOPRIME';

ALTER TABLE "Kit" ALTER COLUMN "tenant" DROP DEFAULT;
ALTER TABLE "Kit"
ALTER COLUMN "tenant" TYPE "Tenant"
USING ("tenant"::text::"Tenant");
ALTER TABLE "Kit" ALTER COLUMN "tenant" SET DEFAULT 'TECHNOPRIME';

ALTER TABLE "AnalyticsDaily"
ALTER COLUMN "tenant" TYPE "Tenant"
USING ("tenant"::text::"Tenant");

ALTER TABLE "Notification"
ALTER COLUMN "tenant" TYPE "Tenant"
USING (
  CASE
    WHEN "tenant" IS NULL THEN NULL
    ELSE "tenant"::text::"Tenant"
  END
);

ALTER TABLE "AdSpend" ALTER COLUMN "tenant" DROP DEFAULT;
ALTER TABLE "AdSpend"
ALTER COLUMN "tenant" TYPE "Tenant"
USING ("tenant"::text::"Tenant");
ALTER TABLE "AdSpend" ALTER COLUMN "tenant" SET DEFAULT 'TECHNOPRIME';

ALTER TABLE "AuditLog"
ALTER COLUMN "tenant" TYPE "Tenant"
USING (
  CASE
    WHEN "tenant" IS NULL THEN NULL
    ELSE "tenant"::text::"Tenant"
  END
);

ALTER TABLE "SharingSystem" ALTER COLUMN "tenant" DROP DEFAULT;
ALTER TABLE "SharingSystem"
ALTER COLUMN "tenant" TYPE "Tenant"
USING ("tenant"::text::"Tenant");
ALTER TABLE "SharingSystem" ALTER COLUMN "tenant" SET DEFAULT 'TECHNOPRIME';

ALTER TABLE "DonorAccount" ALTER COLUMN "tenant" DROP DEFAULT;
ALTER TABLE "DonorAccount"
ALTER COLUMN "tenant" TYPE "Tenant"
USING ("tenant"::text::"Tenant");
ALTER TABLE "DonorAccount" ALTER COLUMN "tenant" SET DEFAULT 'TECHNOPRIME';

ALTER TABLE "MarketingCampaign" ALTER COLUMN "tenant" DROP DEFAULT;
ALTER TABLE "MarketingCampaign"
ALTER COLUMN "tenant" TYPE "Tenant"
USING ("tenant"::text::"Tenant");
ALTER TABLE "MarketingCampaign" ALTER COLUMN "tenant" SET DEFAULT 'TECHNOPRIME';

ALTER TABLE "ClientCommunicationLog" ALTER COLUMN "tenant" DROP DEFAULT;
ALTER TABLE "ClientCommunicationLog"
ALTER COLUMN "tenant" TYPE "Tenant"
USING ("tenant"::text::"Tenant");
ALTER TABLE "ClientCommunicationLog" ALTER COLUMN "tenant" SET DEFAULT 'TECHNOPRIME';

ALTER TABLE "ProductViewEvent" ALTER COLUMN "tenant" DROP DEFAULT;
ALTER TABLE "ProductViewEvent"
ALTER COLUMN "tenant" TYPE "Tenant"
USING ("tenant"::text::"Tenant");
ALTER TABLE "ProductViewEvent" ALTER COLUMN "tenant" SET DEFAULT 'TECHNOPRIME';

DROP TYPE "Tenant_old";
