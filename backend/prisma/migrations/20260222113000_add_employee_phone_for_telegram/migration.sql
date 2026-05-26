ALTER TABLE "Employee"
ADD COLUMN "phone" TEXT;

CREATE UNIQUE INDEX "Employee_phone_key" ON "Employee"("phone");
