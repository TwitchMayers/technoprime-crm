-- Logistics and marketplace account support
CREATE TYPE "SalesChannel" AS ENUM ('WEBSITE', 'RETAIL', 'AVITO', 'OZON', 'OTHER');
CREATE TYPE "FulfillmentMethod" AS ENUM ('LOCAL_DELIVERY', 'TRANSPORT_COMPANY');
CREATE TYPE "ShipmentCarrier" AS ENUM ('AVITO_DELIVERY', 'AVITO_CDEK', 'AVITO_YANDEX', 'AVITO_POST_RUSSIA', 'CDEK_PERSONAL', 'YANDEX_DELIVERY', 'OZON_DELIVERY', 'POST_RUSSIA', 'OTHER');
CREATE TYPE "ShipmentStatus" AS ENUM ('NOT_REQUIRED', 'AWAITING_SHIPMENT_DATA', 'READY_FOR_HANDOVER', 'HANDED_TO_CARRIER', 'IN_TRANSIT', 'ARRIVED_AT_PICKUP_POINT', 'AWAITING_CUSTOMER_PICKUP', 'RECEIVED_BY_CUSTOMER', 'RETURN_IN_TRANSIT', 'RETURNED_TO_SELLER', 'DELIVERY_ISSUE', 'CANCELED');
CREATE TYPE "SettlementStatus" AS ENUM ('NOT_REQUIRED', 'AWAITING_PAYMENT', 'PAID', 'AWAITING_CUSTOMER_RECEIPT', 'AWAITING_FUNDS_RECEIPT', 'FUNDS_RECEIVED', 'REFUND_PENDING', 'REFUNDED', 'CANCELED');
CREATE TYPE "ShipmentSyncMode" AS ENUM ('MANUAL', 'API', 'WEBHOOK');
CREATE TYPE "MarketplacePlatform" AS ENUM ('AVITO', 'OZON', 'YANDEX_DELIVERY', 'CDEK');
CREATE TYPE "MarketplaceAuthType" AS ENUM ('MANUAL', 'OAUTH', 'API_KEY');
CREATE TYPE "MarketplaceAccountStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR');

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'RETURNED';
ALTER TYPE "TaskType" ADD VALUE IF NOT EXISTS 'LOGISTICS';
ALTER TYPE "InventoryUnitStatus" ADD VALUE IF NOT EXISTS 'HANDOVER_PENDING';
ALTER TYPE "InventoryUnitStatus" ADD VALUE IF NOT EXISTS 'IN_TRANSIT';
ALTER TYPE "InventoryUnitStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE "InventoryUnitStatus" ADD VALUE IF NOT EXISTS 'RETURN_IN_TRANSIT';

ALTER TABLE "Order" ADD COLUMN "salesChannel" "SalesChannel" NOT NULL DEFAULT 'RETAIL';
ALTER TABLE "Order" ADD COLUMN "fulfillmentMethod" "FulfillmentMethod" NOT NULL DEFAULT 'LOCAL_DELIVERY';
ALTER TABLE "Order" ADD COLUMN "settlementStatus" "SettlementStatus" NOT NULL DEFAULT 'NOT_REQUIRED';
ALTER TABLE "Order" ADD COLUMN "expectedPayout" DECIMAL(10,2);
ALTER TABLE "Order" ADD COLUMN "actualPayout" DECIMAL(10,2);
ALTER TABLE "Order" ADD COLUMN "marketplaceCommission" DECIMAL(10,2);

CREATE TABLE "Shipment" (
  "id" SERIAL PRIMARY KEY,
  "tenant" "Tenant" NOT NULL DEFAULT 'TECHNOPRIME',
  "orderId" INTEGER NOT NULL UNIQUE,
  "carrier" "ShipmentCarrier" NOT NULL,
  "status" "ShipmentStatus" NOT NULL DEFAULT 'AWAITING_SHIPMENT_DATA',
  "syncMode" "ShipmentSyncMode" NOT NULL DEFAULT 'MANUAL',
  "externalOrderNumber" TEXT,
  "trackingNumber" TEXT,
  "barcode" TEXT,
  "senderPoint" TEXT,
  "receiverPoint" TEXT,
  "expectedDeliveryAt" TIMESTAMP(3),
  "handedOverAt" TIMESTAMP(3),
  "arrivedAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3),
  "returnedAt" TIMESTAMP(3),
  "lastSyncedAt" TIMESTAMP(3),
  "managerComment" TEXT,
  "customerNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ShipmentEvent" (
  "id" SERIAL PRIMARY KEY,
  "tenant" "Tenant" NOT NULL DEFAULT 'TECHNOPRIME',
  "shipmentId" INTEGER NOT NULL,
  "status" "ShipmentStatus" NOT NULL,
  "source" "ShipmentSyncMode" NOT NULL DEFAULT 'MANUAL',
  "title" TEXT NOT NULL,
  "comment" TEXT,
  "rawPayload" JSONB,
  "createdById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShipmentEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ShipmentEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "OrderCustomerLinkToken" (
  "id" SERIAL PRIMARY KEY,
  "tenant" "Tenant" NOT NULL DEFAULT 'TECHNOPRIME',
  "orderId" INTEGER NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3),
  "usedAt" TIMESTAMP(3),
  "shopCustomerId" INTEGER,
  "createdById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderCustomerLinkToken_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrderCustomerLinkToken_shopCustomerId_fkey" FOREIGN KEY ("shopCustomerId") REFERENCES "ShopCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "OrderCustomerLinkToken_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "MarketplaceAccount" (
  "id" SERIAL PRIMARY KEY,
  "tenant" "Tenant" NOT NULL DEFAULT 'TECHNOPRIME',
  "platform" "MarketplacePlatform" NOT NULL,
  "displayName" TEXT NOT NULL,
  "authType" "MarketplaceAuthType" NOT NULL DEFAULT 'MANUAL',
  "status" "MarketplaceAccountStatus" NOT NULL DEFAULT 'CONNECTED',
  "externalAccountId" TEXT,
  "clientId" TEXT,
  "scopes" TEXT,
  "accessTokenEncrypted" TEXT,
  "refreshTokenEncrypted" TEXT,
  "apiKeyEncrypted" TEXT,
  "expiresAt" TIMESTAMP(3),
  "connectedById" INTEGER,
  "disconnectedAt" TIMESTAMP(3),
  "lastSyncAt" TIMESTAMP(3),
  "lastSyncError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceAccount_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Order_tenant_salesChannel_fulfillmentMethod_idx" ON "Order"("tenant", "salesChannel", "fulfillmentMethod");
CREATE INDEX "Order_tenant_settlementStatus_idx" ON "Order"("tenant", "settlementStatus");
CREATE INDEX "Shipment_tenant_status_idx" ON "Shipment"("tenant", "status");
CREATE INDEX "Shipment_tenant_carrier_idx" ON "Shipment"("tenant", "carrier");
CREATE INDEX "Shipment_tenant_trackingNumber_idx" ON "Shipment"("tenant", "trackingNumber");
CREATE INDEX "Shipment_tenant_externalOrderNumber_idx" ON "Shipment"("tenant", "externalOrderNumber");
CREATE INDEX "ShipmentEvent_tenant_shipmentId_createdAt_idx" ON "ShipmentEvent"("tenant", "shipmentId", "createdAt");
CREATE INDEX "OrderCustomerLinkToken_tenant_orderId_idx" ON "OrderCustomerLinkToken"("tenant", "orderId");
CREATE INDEX "OrderCustomerLinkToken_tenant_shopCustomerId_idx" ON "OrderCustomerLinkToken"("tenant", "shopCustomerId");
CREATE INDEX "MarketplaceAccount_tenant_platform_status_idx" ON "MarketplaceAccount"("tenant", "platform", "status");
