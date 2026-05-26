-- CreateEnum
CREATE TYPE "EmployeeShiftStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "EmployeeSaleCreditSource" AS ENUM ('ORDER', 'MANUAL');

-- CreateTable
CREATE TABLE "EmployeeShift" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "status" "EmployeeShiftStatus" NOT NULL DEFAULT 'OPEN',
    "startedById" INTEGER,
    "endedById" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSaleCredit" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "source" "EmployeeSaleCreditSource" NOT NULL DEFAULT 'MANUAL',
    "orderId" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "amount" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "creditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeSaleCredit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeShift_employeeId_startedAt_idx" ON "EmployeeShift"("employeeId", "startedAt");

-- CreateIndex
CREATE INDEX "EmployeeShift_employeeId_status_idx" ON "EmployeeShift"("employeeId", "status");

-- CreateIndex
CREATE INDEX "EmployeeShift_startedById_idx" ON "EmployeeShift"("startedById");

-- CreateIndex
CREATE INDEX "EmployeeShift_endedById_idx" ON "EmployeeShift"("endedById");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeSaleCredit_employeeId_orderId_key" ON "EmployeeSaleCredit"("employeeId", "orderId");

-- CreateIndex
CREATE INDEX "EmployeeSaleCredit_employeeId_creditedAt_idx" ON "EmployeeSaleCredit"("employeeId", "creditedAt");

-- CreateIndex
CREATE INDEX "EmployeeSaleCredit_orderId_idx" ON "EmployeeSaleCredit"("orderId");

-- CreateIndex
CREATE INDEX "EmployeeSaleCredit_createdById_creditedAt_idx" ON "EmployeeSaleCredit"("createdById", "creditedAt");

-- AddForeignKey
ALTER TABLE "EmployeeShift"
ADD CONSTRAINT "EmployeeShift_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeShift"
ADD CONSTRAINT "EmployeeShift_startedById_fkey"
FOREIGN KEY ("startedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeShift"
ADD CONSTRAINT "EmployeeShift_endedById_fkey"
FOREIGN KEY ("endedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSaleCredit"
ADD CONSTRAINT "EmployeeSaleCredit_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSaleCredit"
ADD CONSTRAINT "EmployeeSaleCredit_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSaleCredit"
ADD CONSTRAINT "EmployeeSaleCredit_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
