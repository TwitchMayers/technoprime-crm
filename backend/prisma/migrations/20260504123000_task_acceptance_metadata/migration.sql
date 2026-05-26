ALTER TABLE "Task"
ADD COLUMN "acceptedById" INTEGER,
ADD COLUMN "acceptedAt" TIMESTAMP(3);

ALTER TABLE "Task"
ADD CONSTRAINT "Task_acceptedById_fkey"
FOREIGN KEY ("acceptedById") REFERENCES "Employee"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Task_tenant_acceptedById_idx" ON "Task"("tenant", "acceptedById");
