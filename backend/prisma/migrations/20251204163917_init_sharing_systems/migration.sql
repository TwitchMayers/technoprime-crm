/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `ClientSlot` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[sharingSystemId,clientId,consoleType]` on the table `ClientSlot` will be added. If there are existing duplicate values, this will fail.
  - Made the column `clientId` on table `ClientSlot` required. This step will fail if there are existing NULL values in that column.
  - Changed the type of `consoleType` on the `ClientSlot` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "public"."ClientSlot" DROP CONSTRAINT "ClientSlot_clientId_fkey";

-- DropIndex
DROP INDEX "public"."ClientSlot_sharingSystemId_clientId_idx";

-- DropIndex
DROP INDEX "public"."ClientSlot_sharingSystemId_consoleType_key";

-- AlterTable
ALTER TABLE "ClientSlot" DROP COLUMN "updatedAt",
ALTER COLUMN "clientId" SET NOT NULL,
DROP COLUMN "consoleType",
ADD COLUMN     "consoleType" "ClothingSize" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ClientSlot_sharingSystemId_clientId_consoleType_key" ON "ClientSlot"("sharingSystemId", "clientId", "consoleType");

-- AddForeignKey
ALTER TABLE "ClientSlot" ADD CONSTRAINT "ClientSlot_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
