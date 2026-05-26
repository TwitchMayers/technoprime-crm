-- CreateTable
CREATE TABLE "ConsoleInstruction" (
    "id" SERIAL NOT NULL,
    "tenant" "Tenant" NOT NULL DEFAULT 'TECHNOPRIME',
    "consoleKey" TEXT NOT NULL,
    "consoleLabel" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "searchAliases" JSONB,
    "sections" JSONB NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" INTEGER,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsoleInstruction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConsoleInstruction_tenant_consoleKey_key"
ON "ConsoleInstruction"("tenant", "consoleKey");

-- CreateIndex
CREATE INDEX "ConsoleInstruction_tenant_isPublished_sortOrder_idx"
ON "ConsoleInstruction"("tenant", "isPublished", "sortOrder");

-- AddForeignKey
ALTER TABLE "ConsoleInstruction"
ADD CONSTRAINT "ConsoleInstruction_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsoleInstruction"
ADD CONSTRAINT "ConsoleInstruction_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed: Steam Deck instruction
INSERT INTO "ConsoleInstruction" (
  "tenant",
  "consoleKey",
  "consoleLabel",
  "title",
  "subtitle",
  "searchAliases",
  "sections",
  "isPublished",
  "sortOrder"
)
VALUES (
  'TECHNOPRIME',
  'steam_deck',
  'Steam Deck',
  'Инструкция по Steam Deck',
  'Быстрые сценарии запуска систем и восстановления SteamOS.',
  '["steam deck","steamdeck","deck","dualboot","steamos","windows"]'::jsonb,
  '[
    {
      "key": "dualboot",
      "title": "DualBoot (Переключение)",
      "content": "Необходимо полностью выключить приставку (через питание / Power).\n\nПосле полного выключения приставки:\n1. Зажмите кнопку уменьшения громкости «-» и держите.\n2. Параллельно, удерживая громкость, нажмите кнопку питания 1 раз.\n3. После открытия Boot Menu выберите систему.\n4. Для запуска Steam выберите SteamOS.\n\nЧтобы включить Windows, достаточно полностью выключить приставку и снова включить её: Windows запустится автоматически, так как стоит первой в приоритете загрузки."
    },
    {
      "key": "lost_steamos",
      "title": "Пропала SteamOS",
      "content": "Ручной запуск через BIOS (самый вероятный сценарий):\n1. Полностью выключите Steam Deck.\n2. Удерживайте кнопку громкости вверх «+» и нажмите питание.\n3. В BIOS выберите: Boot from file.\n4. Откройте путь: esp > efi > steamos > steamcl.efi.\n5. После загрузки в SteamOS откройте режим рабочего стола — загрузчик обычно восстанавливается."
    }
  ]'::jsonb,
  true,
  10
)
ON CONFLICT ("tenant", "consoleKey") DO NOTHING;
