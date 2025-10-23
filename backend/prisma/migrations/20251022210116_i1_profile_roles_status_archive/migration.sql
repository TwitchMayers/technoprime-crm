/*
  Warnings:

  - The values [PENDING] on the enum `OrderStatus` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `createdById` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Position" AS ENUM ('OWNER', 'MANAGER');

-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('NEW', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');
ALTER TABLE "public"."Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "public"."OrderStatus_old";
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'NEW';
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."Order" DROP CONSTRAINT "Order_managerId_fkey";

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "position" "Position";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "archiveOnComplete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "createdById" INTEGER NOT NULL,
ALTER COLUMN "managerId" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'NEW';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "OrderComment" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Product_isArchived_category_idx" ON "Product"("isArchived", "category");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderComment" ADD CONSTRAINT "OrderComment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderComment" ADD CONSTRAINT "OrderComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
