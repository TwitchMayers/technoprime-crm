-- CreateTable
CREATE TABLE "EmployeePinnedChat" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "platform" "MarketplacePlatform" NOT NULL DEFAULT 'AVITO',
    "marketplaceAccountId" INTEGER NOT NULL,
    "chatId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeePinnedChat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeePinnedChat_employeeId_platform_marketplaceAccountId_key"
ON "EmployeePinnedChat"("employeeId", "platform", "marketplaceAccountId", "chatId");

-- CreateIndex
CREATE INDEX "EmployeePinnedChat_employeeId_platform_createdAt_idx"
ON "EmployeePinnedChat"("employeeId", "platform", "createdAt");

-- CreateIndex
CREATE INDEX "EmployeePinnedChat_marketplaceAccountId_platform_createdAt_idx"
ON "EmployeePinnedChat"("marketplaceAccountId", "platform", "createdAt");

-- AddForeignKey
ALTER TABLE "EmployeePinnedChat"
ADD CONSTRAINT "EmployeePinnedChat_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePinnedChat"
ADD CONSTRAINT "EmployeePinnedChat_marketplaceAccountId_fkey"
FOREIGN KEY ("marketplaceAccountId") REFERENCES "MarketplaceAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
