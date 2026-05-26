ALTER TABLE "Employee"
ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Employee_isActive_createdAt_idx"
ON "Employee"("isActive", "createdAt");
