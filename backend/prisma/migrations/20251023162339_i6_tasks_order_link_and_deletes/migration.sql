-- AlterEnum
ALTER TYPE "Position" ADD VALUE 'TECHNICIAN';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "orderId" INTEGER;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
