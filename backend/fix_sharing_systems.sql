-- Добавляем новые типы если их нет
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'consoletype') THEN
        CREATE TYPE "ConsoleType" AS ENUM ('PS4', 'PS5');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscriptionperiod') THEN
        CREATE TYPE "SubscriptionPeriod" AS ENUM ('MONTH', 'THREE_MONTHS', 'YEAR');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'accounttype') THEN
        CREATE TYPE "AccountType" AS ENUM ('PERSONAL', 'SHARING_DONOR', 'SHARING_CLIENT');
    END IF;
END $$;

-- Создаем таблицу DonorAccount
CREATE TABLE IF NOT EXISTS "DonorAccount" (
  "id" SERIAL PRIMARY KEY,
  "tenant" TEXT NOT NULL DEFAULT 'TECHNOPRIME',
  "email" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "consoleType" "ConsoleType" NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "subscriptionType" "SubscriptionType" NOT NULL,
  "subscriptionPeriod" "SubscriptionPeriod" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "region" TEXT DEFAULT '🇺🇦 Украина',
  "emailLogin" TEXT,
  "emailPassword" TEXT,
  "accountPassword" TEXT,
  "dateOfBirth" TIMESTAMP(3),
  "backupCodes" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Создаем таблицу SharingSystem
CREATE TABLE IF NOT EXISTS "SharingSystem" (
  "id" SERIAL PRIMARY KEY,
  "tenant" TEXT NOT NULL DEFAULT 'TECHNOPRIME',
  "name" TEXT NOT NULL,
  "donorAccountId" INTEGER NOT NULL UNIQUE,
  "totalSlots" INTEGER NOT NULL DEFAULT 3,
  "availableSlots" INTEGER NOT NULL DEFAULT 2,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("donorAccountId") REFERENCES "DonorAccount"("id") ON DELETE CASCADE
);

-- Создаем таблицу ClientSlot
CREATE TABLE IF NOT EXISTS "ClientSlot" (
  "id" SERIAL PRIMARY KEY,
  "sharingSystemId" INTEGER NOT NULL,
  "clientId" INTEGER,
  "consoleType" "ConsoleType" NOT NULL,
  "emailLogin" TEXT,
  "emailPassword" TEXT,
  "accountPassword" TEXT,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("sharingSystemId") REFERENCES "SharingSystem"("id") ON DELETE CASCADE,
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL,
  UNIQUE("sharingSystemId", "clientId")
);

-- Добавляем новые поля в Subscription
ALTER TABLE "Subscription" 
ADD COLUMN IF NOT EXISTS "accountType" "AccountType" DEFAULT 'PERSONAL',
ADD COLUMN IF NOT EXISTS "subscriptionPeriod" "SubscriptionPeriod" DEFAULT 'MONTH',
ADD COLUMN IF NOT EXISTS "clientSlotId" INTEGER UNIQUE,
ADD COLUMN IF NOT EXISTS "donorAccountId" INTEGER;

-- Создаем индексы
CREATE INDEX IF NOT EXISTS "DonorAccount_tenant_isActive_endDate_idx" ON "DonorAccount"("tenant", "isActive", "endDate");
CREATE INDEX IF NOT EXISTS "SharingSystem_tenant_isActive_idx" ON "SharingSystem"("tenant", "isActive");
CREATE INDEX IF NOT EXISTS "ClientSlot_sharingSystemId_consoleType_isActive_idx" ON "ClientSlot"("sharingSystemId", "consoleType", "isActive");
CREATE INDEX IF NOT EXISTS "Subscription_tenant_accountType_status_idx" ON "Subscription"("tenant", "accountType", "status");

-- Создаем связи
ALTER TABLE "Subscription"
ADD CONSTRAINT IF NOT EXISTS "Subscription_clientSlotId_fkey" FOREIGN KEY ("clientSlotId") REFERENCES "ClientSlot"("id") ON DELETE SET NULL,
ADD CONSTRAINT IF NOT EXISTS "Subscription_donorAccountId_fkey" FOREIGN KEY ("donorAccountId") REFERENCES "DonorAccount"("id") ON DELETE SET NULL;