/*
  Warnings:

  - Changed the type of `consoleType` on the `ClientSlot` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "ClientSlot" DROP COLUMN "consoleType",
ADD COLUMN     "consoleType" "ConsoleType" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ClientSlot_sharingSystemId_clientId_consoleType_key" ON "ClientSlot"("sharingSystemId", "clientId", "consoleType");
