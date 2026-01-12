-- CreateEnum
CREATE TYPE "Tenant" AS ENUM ('TECHNOPRIME', 'RICHMARKET');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'TECHNICAL_SPECIALIST', 'SUPER_ADMIN', 'RICHMARKET_CEO', 'RICHMARKET_MANAGER');

-- CreateEnum
CREATE TYPE "Position" AS ENUM ('OWNER', 'MANAGER', 'TECHNICIAN', 'CEO');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'TRADE_IN');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('CALL', 'DELIVERY', 'SUBSCRIPTION_RENEWAL', 'TRADE_IN', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "SubscriptionType" AS ENUM ('PS_PLUS', 'GAME_PASS', 'EA_PLAY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('CONSOLE', 'ACCESSORY', 'DISK', 'SERVICE', 'SUBSCRIPTION_KEY');

-- CreateEnum
CREATE TYPE "ClothingCategory" AS ENUM ('JACKET', 'JEANS', 'TSHIRT', 'VEST', 'SHIRT', 'SHORTS', 'HAT');

-- CreateEnum
CREATE TYPE "ClothingSize" AS ENUM ('XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL');

-- CreateEnum
CREATE TYPE "DeliveryService" AS ENUM ('YANDEX', 'AVITO', 'POST_RUSSIA', 'FIVEPOST', 'CDEK');

-- CreateEnum
CREATE TYPE "AdSku" AS ENUM ('PS5', 'PS4', 'XBOX_ONE_S', 'XBOX_SERIES_S', 'XBOX_SERIES_X', 'NINTENDO_SWITCH', 'STEAM_DECK');

-- CreateEnum
CREATE TYPE "KitTier" AS ENUM ('BASIC', 'STANDARD', 'PREMIUM', 'PRO');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('PERSONAL', 'SHARING_DONOR', 'SHARING_CLIENT');

-- CreateEnum
CREATE TYPE "ConsoleType" AS ENUM ('PS4', 'PS5');

-- CreateEnum
CREATE TYPE "SubscriptionPeriod" AS ENUM ('MONTH', 'THREE_MONTHS', 'YEAR');

-- CreateTable
CREATE TABLE "Employee" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "position" "Position",
    "login" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MANAGER',
    "tenant" "Tenant",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" SERIAL NOT NULL,
    "tenant" "Tenant" NOT NULL DEFAULT 'TECHNOPRIME',
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "city" TEXT,
    "address" TEXT,
    "consoleType" TEXT,
    "notes" TEXT,
    "status" TEXT,
    "emailLogin" TEXT,
    "emailPassword" TEXT,
    "accountPassword" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "tenant" "Tenant" NOT NULL DEFAULT 'TECHNOPRIME',
    "name" TEXT NOT NULL,
    "category" "ProductCategory" NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "version" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "costPrice" DECIMAL(10,2) NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "serialNumber" TEXT,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "adSku" "AdSku",

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" SERIAL NOT NULL,
    "tenant" "Tenant" NOT NULL DEFAULT 'TECHNOPRIME',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" INTEGER NOT NULL,
    "managerId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'NEW',
    "paymentMethod" "PaymentMethod" NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "costPrice" DECIMAL(10,2) NOT NULL,
    "profit" DECIMAL(10,2) NOT NULL,
    "comment" TEXT,
    "archiveOnComplete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "unitCost" DECIMAL(10,2) NOT NULL,
    "lineTotal" DECIMAL(10,2) NOT NULL,
    "lineCost" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderComment" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" SERIAL NOT NULL,
    "tenant" "Tenant" NOT NULL DEFAULT 'TECHNOPRIME',
    "clientId" INTEGER NOT NULL,
    "type" "SubscriptionType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "psEmail" TEXT,
    "psPassword" TEXT,
    "accountPassword" TEXT,
    "serialNumber" TEXT,
    "managerId" INTEGER,
    "accountType" "AccountType" NOT NULL DEFAULT 'PERSONAL',
    "subscriptionPeriod" "SubscriptionPeriod" NOT NULL DEFAULT 'MONTH',
    "clientSlotId" INTEGER,
    "donorAccountId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" SERIAL NOT NULL,
    "tenant" "Tenant" NOT NULL DEFAULT 'TECHNOPRIME',
    "title" TEXT NOT NULL,
    "type" "TaskType" NOT NULL,
    "assignedToId" INTEGER NOT NULL,
    "clientId" INTEGER,
    "orderId" INTEGER,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'NEW',
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeIn" (
    "id" SERIAL NOT NULL,
    "tenant" "Tenant" NOT NULL DEFAULT 'TECHNOPRIME',
    "clientId" INTEGER NOT NULL,
    "oldModel" TEXT NOT NULL,
    "estimatedValue" DECIMAL(10,2) NOT NULL,
    "surcharge" DECIMAL(10,2) NOT NULL,
    "newOrderId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kit" (
    "id" SERIAL NOT NULL,
    "tenant" "Tenant" NOT NULL DEFAULT 'TECHNOPRIME',
    "name" TEXT NOT NULL,
    "tier" "KitTier" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Kit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitItem" (
    "id" SERIAL NOT NULL,
    "kitId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "KitItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsDaily" (
    "id" SERIAL NOT NULL,
    "tenant" "Tenant" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalSales" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DECIMAL(12,2) NOT NULL,
    "totalProfit" DECIMAL(12,2) NOT NULL,
    "avgCheck" DECIMAL(12,2) NOT NULL,
    "activeClients" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AnalyticsDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tenant" "Tenant",
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdSpend" (
    "id" SERIAL NOT NULL,
    "tenant" "Tenant" NOT NULL DEFAULT 'TECHNOPRIME',
    "date" TIMESTAMP(3) NOT NULL,
    "adSku" "AdSku" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdSpend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "tenant" "Tenant",
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER,
    "oldData" JSONB,
    "newData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RichMarketClient" (
    "id" SERIAL NOT NULL,
    "tenant" "Tenant" NOT NULL DEFAULT 'RICHMARKET',
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "city" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RichMarketClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RichMarketProduct" (
    "id" SERIAL NOT NULL,
    "tenant" "Tenant" NOT NULL DEFAULT 'RICHMARKET',
    "brand" TEXT NOT NULL,
    "category" "ClothingCategory" NOT NULL,
    "color" TEXT NOT NULL,
    "imageUrl" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "costPrice" DECIMAL(10,2) NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RichMarketProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RichMarketProductSize" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "size" "ClothingSize" NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RichMarketProductSize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RichMarketOrder" (
    "id" SERIAL NOT NULL,
    "tenant" "Tenant" NOT NULL DEFAULT 'RICHMARKET',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" INTEGER NOT NULL,
    "managerId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'NEW',
    "paymentMethod" "PaymentMethod" NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "costPrice" DECIMAL(10,2) NOT NULL,
    "profit" DECIMAL(10,2) NOT NULL,
    "comment" TEXT,
    "deliveryService" "DeliveryService",
    "trackingCode" TEXT,
    "deliveryAddress" TEXT,

    CONSTRAINT "RichMarketOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RichMarketOrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "size" "ClothingSize" NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "unitCost" DECIMAL(10,2) NOT NULL,
    "lineTotal" DECIMAL(10,2) NOT NULL,
    "lineCost" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "RichMarketOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RichMarketOrderComment" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RichMarketOrderComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RichMarketTask" (
    "id" SERIAL NOT NULL,
    "tenant" "Tenant" NOT NULL DEFAULT 'RICHMARKET',
    "title" TEXT NOT NULL,
    "type" "TaskType" NOT NULL,
    "assignedToId" INTEGER NOT NULL,
    "clientId" INTEGER,
    "orderId" INTEGER,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'NEW',
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RichMarketTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharingSystem" (
    "id" SERIAL NOT NULL,
    "tenant" "Tenant" NOT NULL DEFAULT 'TECHNOPRIME',
    "name" TEXT NOT NULL,
    "donorAccountId" INTEGER NOT NULL,
    "totalSlots" INTEGER NOT NULL DEFAULT 3,
    "availableSlots" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharingSystem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonorAccount" (
    "id" SERIAL NOT NULL,
    "tenant" "Tenant" NOT NULL DEFAULT 'TECHNOPRIME',
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "consoleType" "ConsoleType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "subscriptionType" "SubscriptionType" NOT NULL,
    "subscriptionPeriod" "SubscriptionPeriod" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "region" TEXT,
    "emailLogin" TEXT,
    "emailPassword" TEXT,
    "accountPassword" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "backupCodes" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonorAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientSlot" (
    "id" SERIAL NOT NULL,
    "sharingSystemId" INTEGER NOT NULL,
    "clientId" INTEGER,
    "consoleType" "ConsoleType" NOT NULL,
    "emailLogin" TEXT,
    "emailPassword" TEXT,
    "accountPassword" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_login_key" ON "Employee"("login");

-- CreateIndex
CREATE INDEX "Client_tenant_phone_idx" ON "Client"("tenant", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Product_serialNumber_key" ON "Product"("serialNumber");

-- CreateIndex
CREATE INDEX "Product_tenant_isArchived_category_idx" ON "Product"("tenant", "isArchived", "category");

-- CreateIndex
CREATE INDEX "Order_tenant_status_idx" ON "Order"("tenant", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_clientSlotId_key" ON "Subscription"("clientSlotId");

-- CreateIndex
CREATE INDEX "Subscription_tenant_status_idx" ON "Subscription"("tenant", "status");

-- CreateIndex
CREATE INDEX "Subscription_tenant_accountType_status_idx" ON "Subscription"("tenant", "accountType", "status");

-- CreateIndex
CREATE INDEX "Task_tenant_status_idx" ON "Task"("tenant", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TradeIn_newOrderId_key" ON "TradeIn"("newOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsDaily_tenant_date_key" ON "AnalyticsDaily"("tenant", "date");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdSpend_tenant_date_adSku_key" ON "AdSpend"("tenant", "date", "adSku");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RichMarketClient_tenant_phone_idx" ON "RichMarketClient"("tenant", "phone");

-- CreateIndex
CREATE INDEX "RichMarketProduct_tenant_category_brand_idx" ON "RichMarketProduct"("tenant", "category", "brand");

-- CreateIndex
CREATE INDEX "RichMarketProduct_tenant_isArchived_idx" ON "RichMarketProduct"("tenant", "isArchived");

-- CreateIndex
CREATE UNIQUE INDEX "RichMarketProduct_tenant_brand_category_color_key" ON "RichMarketProduct"("tenant", "brand", "category", "color");

-- CreateIndex
CREATE UNIQUE INDEX "RichMarketProductSize_productId_size_key" ON "RichMarketProductSize"("productId", "size");

-- CreateIndex
CREATE INDEX "RichMarketOrder_tenant_status_idx" ON "RichMarketOrder"("tenant", "status");

-- CreateIndex
CREATE INDEX "RichMarketOrderItem_productId_size_idx" ON "RichMarketOrderItem"("productId", "size");

-- CreateIndex
CREATE INDEX "RichMarketTask_tenant_status_idx" ON "RichMarketTask"("tenant", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SharingSystem_donorAccountId_key" ON "SharingSystem"("donorAccountId");

-- CreateIndex
CREATE INDEX "SharingSystem_tenant_isActive_idx" ON "SharingSystem"("tenant", "isActive");

-- CreateIndex
CREATE INDEX "DonorAccount_tenant_isActive_endDate_idx" ON "DonorAccount"("tenant", "isActive", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "DonorAccount_tenant_email_key" ON "DonorAccount"("tenant", "email");

-- CreateIndex
CREATE INDEX "ClientSlot_sharingSystemId_clientId_idx" ON "ClientSlot"("sharingSystemId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientSlot_sharingSystemId_consoleType_key" ON "ClientSlot"("sharingSystemId", "consoleType");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderComment" ADD CONSTRAINT "OrderComment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderComment" ADD CONSTRAINT "OrderComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_clientSlotId_fkey" FOREIGN KEY ("clientSlotId") REFERENCES "ClientSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_donorAccountId_fkey" FOREIGN KEY ("donorAccountId") REFERENCES "DonorAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeIn" ADD CONSTRAINT "TradeIn_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeIn" ADD CONSTRAINT "TradeIn_newOrderId_fkey" FOREIGN KEY ("newOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitItem" ADD CONSTRAINT "KitItem_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Kit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitItem" ADD CONSTRAINT "KitItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RichMarketProductSize" ADD CONSTRAINT "RichMarketProductSize_productId_fkey" FOREIGN KEY ("productId") REFERENCES "RichMarketProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RichMarketOrder" ADD CONSTRAINT "RichMarketOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "RichMarketClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RichMarketOrder" ADD CONSTRAINT "RichMarketOrder_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RichMarketOrder" ADD CONSTRAINT "RichMarketOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RichMarketOrderItem" ADD CONSTRAINT "RichMarketOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "RichMarketOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RichMarketOrderItem" ADD CONSTRAINT "RichMarketOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "RichMarketProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RichMarketOrderComment" ADD CONSTRAINT "RichMarketOrderComment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "RichMarketOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RichMarketOrderComment" ADD CONSTRAINT "RichMarketOrderComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RichMarketTask" ADD CONSTRAINT "RichMarketTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RichMarketTask" ADD CONSTRAINT "RichMarketTask_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "RichMarketClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RichMarketTask" ADD CONSTRAINT "RichMarketTask_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "RichMarketOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharingSystem" ADD CONSTRAINT "SharingSystem_donorAccountId_fkey" FOREIGN KEY ("donorAccountId") REFERENCES "DonorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientSlot" ADD CONSTRAINT "ClientSlot_sharingSystemId_fkey" FOREIGN KEY ("sharingSystemId") REFERENCES "SharingSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientSlot" ADD CONSTRAINT "ClientSlot_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
