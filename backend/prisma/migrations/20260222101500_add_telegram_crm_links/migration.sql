CREATE TABLE "TelegramCrmLink" (
  "id" SERIAL NOT NULL,
  "employeeId" INTEGER NOT NULL,
  "telegramUserId" TEXT NOT NULL,
  "telegramChatId" TEXT NOT NULL,
  "telegramUsername" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastSeenOrderId" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TelegramCrmLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TelegramCrmLink_employeeId_key" ON "TelegramCrmLink"("employeeId");
CREATE UNIQUE INDEX "TelegramCrmLink_telegramUserId_key" ON "TelegramCrmLink"("telegramUserId");
CREATE UNIQUE INDEX "TelegramCrmLink_telegramChatId_key" ON "TelegramCrmLink"("telegramChatId");
CREATE INDEX "TelegramCrmLink_isActive_idx" ON "TelegramCrmLink"("isActive");

ALTER TABLE "TelegramCrmLink"
ADD CONSTRAINT "TelegramCrmLink_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
