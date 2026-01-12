#!/bin/bash

cat > prisma/schema.prisma << 'SCHEMA'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Основные ENUM
enum Tenant {
  TECHNOPRIME
  RICHMARKET
}

enum Role {
  ADMIN
  MANAGER
  TECHNICAL_SPECIALIST
  SUPER_ADMIN
  RICHMARKET_CEO
  RICHMARKET_MANAGER
}

enum Position {
  OWNER
  MANAGER
  TECHNICIAN
  CEO
}

enum PaymentMethod {
  CASH
  TRANSFER
  TRADE_IN
}

enum OrderStatus {
  NEW
  IN_PROGRESS
  COMPLETED
  CANCELED
}

enum TaskType {
  CALL
  DELIVERY
  SUBSCRIPTION_RENEWAL
  TRADE_IN
  OTHER
}

enum TaskStatus {
  NEW
  IN_PROGRESS
  DONE
}

enum SubscriptionType {
  PS_PLUS
  GAME_PASS
  EA_PLAY
}

enum SubscriptionStatus {
  ACTIVE
  EXPIRED
}

enum ProductCategory {
  CONSOLE
  ACCESSORY
  DISK
  SERVICE
  SUBSCRIPTION_KEY
}

enum ClothingCategory {
  JACKET
  JEANS
  TSHIRT
  VEST
  SHIRT
  SHORTS
  HAT
}

enum ClothingSize {
  XS
  S
  M
  L
  XL
  XXL
  XXXL
}

enum DeliveryService {
  YANDEX
  AVITO
  POST_RUSSIA
  FIVEPOST
  CDEK
}

enum AdSku {
  PS5
  PS4
  XBOX_ONE_S
  XBOX_SERIES_S
  XBOX_SERIES_X
  NINTENDO_SWITCH
  STEAM_DECK
}

enum KitTier {
  BASIC
  STANDARD
  PREMIUM
  PRO
}

// Системы шеринга
enum AccountType {
  PERSONAL
  SHARING_DONOR
  SHARING_CLIENT
}

enum ConsoleType {
  PS4
  PS5
}

enum SubscriptionPeriod {
  MONTH
  THREE_MONTHS
  YEAR
}

// Основные модели
model Employee {
  id                   Int         @id @default(autoincrement())
  name                 String
  firstName            String?
  lastName             String?
  position             Position?
  login                String      @unique
  passwordHash         String
  role                 Role        @default(MANAGER)
  tenant               Tenant?
  createdAt            DateTime    @default(now())
}

model Client {
  id              Int            @id @default(autoincrement())
  tenant          Tenant         @default(TECHNOPRIME)
  name            String
  phone           String
  city            String?
  address         String?
  consoleType     String?
  notes           String?
  status          String?
  emailLogin      String?
  emailPassword   String?
  accountPassword String?
  createdAt       DateTime       @default(now())
}

model Product {
  id           Int             @id @default(autoincrement())
  tenant       Tenant          @default(TECHNOPRIME)
  name         String
  category     ProductCategory
  brand        String?
  model        String?
  version      String?
  stock        Int             @default(0)
  costPrice    Decimal         @db.Decimal(10, 2)
  price        Decimal         @db.Decimal(10, 2)
  isActive     Boolean         @default(true)
  isArchived   Boolean         @default(false)
  serialNumber String?         @unique
  inStock      Boolean         @default(true)
  archivedAt   DateTime?
  adSku        AdSku?
}

model Order {
  id                Int            @id @default(autoincrement())
  tenant            Tenant         @default(TECHNOPRIME)
  date              DateTime       @default(now())
  client            Client         @relation(fields: [clientId], references: [id])
  clientId          Int
  manager           Employee?      @relation(fields: [managerId], references: [id])
  managerId         Int?
  createdBy         Employee       @relation(fields: [createdById], references: [id])
  createdById       Int
  status            OrderStatus    @default(NEW)
  paymentMethod     PaymentMethod
  totalPrice        Decimal        @db.Decimal(10, 2)
  costPrice         Decimal        @db.Decimal(10, 2)
  profit            Decimal        @db.Decimal(10, 2)
  comment           String?
  archiveOnComplete Boolean        @default(false)
}

model OrderItem {
  id        Int     @id @default(autoincrement())
  order     Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  orderId   Int
  product   Product @relation(fields: [productId], references: [id])
  productId Int
  qty       Int     @default(1)
  unitPrice Decimal @db.Decimal(10, 2)
  unitCost  Decimal @db.Decimal(10, 2)
  lineTotal Decimal @db.Decimal(10, 2)
  lineCost  Decimal @db.Decimal(10, 2)
}

model OrderComment {
  id        Int      @id @default(autoincrement())
  order     Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  orderId   Int
  author    Employee @relation(fields: [authorId], references: [id])
  authorId  Int
  text      String
  createdAt DateTime @default(now())
}

// Системы шеринга
model DonorAccount {
  id                 Int                @id @default(autoincrement())
  tenant             Tenant             @default(TECHNOPRIME)
  email              String
  password           String
  consoleType        ConsoleType
  startDate          DateTime
  endDate            DateTime
  subscriptionType   SubscriptionType
  subscriptionPeriod SubscriptionPeriod
  isActive           Boolean            @default(true)
  region             String?            @default("🇺🇦 Украина")
  emailLogin         String?
  emailPassword      String?
  accountPassword    String?
  dateOfBirth        DateTime?
  backupCodes        String?
  notes              String?
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt

  @@unique([tenant, email])
  @@index([tenant, isActive, endDate])
}

model SharingSystem {
  id             Int          @id @default(autoincrement())
  tenant         Tenant       @default(TECHNOPRIME)
  name           String
  donorAccount   DonorAccount @relation(fields: [donorAccountId], references: [id], onDelete: Cascade)
  donorAccountId Int          @unique
  totalSlots     Int          @default(3)
  availableSlots Int          @default(2)
  isActive       Boolean      @default(true)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@index([tenant, isActive])
}

model ClientSlot {
  id              Int           @id @default(autoincrement())
  sharingSystem   SharingSystem @relation(fields: [sharingSystemId], references: [id], onDelete: Cascade)
  sharingSystemId Int
  client          Client?       @relation(fields: [clientId], references: [id])
  clientId        Int?
  consoleType     ConsoleType
  emailLogin      String?
  emailPassword   String?
  accountPassword String?
  startDate       DateTime
  endDate         DateTime
  isActive        Boolean       @default(true)
  notes           String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@unique([sharingSystemId, clientId])
  @@index([sharingSystemId, consoleType, isActive])
}

model Subscription {
  id              Int                @id @default(autoincrement())
  tenant          Tenant             @default(TECHNOPRIME)
  client          Client             @relation(fields: [clientId], references: [id])
  clientId        Int
  type            SubscriptionType
  startDate       DateTime
  endDate         DateTime
  status          SubscriptionStatus @default(ACTIVE)
  psEmail         String?
  psPassword      String?
  accountPassword String?
  serialNumber    String?
  manager         Employee?          @relation(fields: [managerId], references: [id])
  managerId       Int?
  createdAt       DateTime           @default(now())

  accountType        AccountType        @default(PERSONAL)
  subscriptionPeriod SubscriptionPeriod @default(MONTH)
  clientSlot         ClientSlot?        @relation(fields: [clientSlotId], references: [id])
  clientSlotId       Int?               @unique
  donorAccount       DonorAccount?      @relation(fields: [donorAccountId], references: [id])
  donorAccountId     Int?

  @@index([tenant, status])
  @@index([tenant, accountType, status])
}

model Task {
  id           Int        @id @default(autoincrement())
  tenant       Tenant     @default(TECHNOPRIME)
  title        String
  type         TaskType
  assignedTo   Employee   @relation(fields: [assignedToId], references: [id])
  assignedToId Int
  client       Client?    @relation(fields: [clientId], references: [id])
  clientId     Int?
  order        Order?     @relation(fields: [orderId], references: [id])
  orderId      Int?
  dueDate      DateTime
  status       TaskStatus @default(NEW)
  comment      String?
  createdAt    DateTime   @default(now())

  @@index([tenant, status])
}

model Notification {
  id        Int       @id @default(autoincrement())
  user      Employee  @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    Int
  tenant    Tenant?
  type      String
  payload   Json?
  readAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId, readAt])
}

// RichMarket модели
model RichMarketClient {
  id        Int               @id @default(autoincrement())
  tenant    Tenant            @default(RICHMARKET)
  name      String
  phone     String
  city      String?
  address   String?
  notes     String?
  createdAt DateTime          @default(now())
}

model RichMarketProduct {
  id          Int              @id @default(autoincrement())
  tenant      Tenant           @default(RICHMARKET)
  brand       String
  category    ClothingCategory
  color       String
  imageUrl    String?
  description String?
  isActive    Boolean          @default(true)
  isArchived  Boolean          @default(false)
  archivedAt  DateTime?

  costPrice Decimal @db.Decimal(10, 2)
  price     Decimal @db.Decimal(10, 2)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tenant, brand, category, color])
  @@index([tenant, category, brand])
  @@index([tenant, isArchived])
}

model RichMarketProductSize {
  id        Int               @id @default(autoincrement())
  product   RichMarketProduct @relation(fields: [productId], references: [id], onDelete: Cascade)
  productId Int
  size      ClothingSize
  stock     Int               @default(0)
  createdAt DateTime          @default(now())

  @@unique([productId, size])
}

model RichMarketOrder {
  id              Int                      @id @default(autoincrement())
  tenant          Tenant                   @default(RICHMARKET)
  date            DateTime                 @default(now())
  client          RichMarketClient         @relation(fields: [clientId], references: [id])
  clientId        Int
  manager         Employee?                @relation(fields: [managerId], references: [id])
  managerId       Int?
  createdBy       Employee                 @relation(fields: [createdById], references: [id])
  createdById     Int
  status          OrderStatus              @default(NEW)
  paymentMethod   PaymentMethod
  totalPrice      Decimal                  @db.Decimal(10, 2)
  costPrice       Decimal                  @db.Decimal(10, 2)
  profit          Decimal                  @db.Decimal(10, 2)
  comment         String?
  deliveryService DeliveryService?
  trackingCode    String?
  deliveryAddress String?
}

model RichMarketOrderItem {
  id        Int               @id @default(autoincrement())
  order     RichMarketOrder   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  orderId   Int
  product   RichMarketProduct @relation(fields: [productId], references: [id])
  productId Int
  size      ClothingSize
  qty       Int               @default(1)
  unitPrice Decimal           @db.Decimal(10, 2)
  unitCost  Decimal           @db.Decimal(10, 2)
  lineTotal Decimal           @db.Decimal(10, 2)
  lineCost  Decimal           @db.Decimal(10, 2)

  @@index([productId, size])
}

model RichMarketOrderComment {
  id        Int             @id @default(autoincrement())
  order     RichMarketOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  orderId   Int
  author    Employee        @relation(fields: [authorId], references: [id])
  authorId  Int
  text      String
  createdAt DateTime        @default(now())
}

model RichMarketTask {
  id           Int               @id @default(autoincrement())
  tenant       Tenant            @default(RICHMARKET)
  title        String
  type         TaskType
  assignedTo   Employee          @relation(fields: [assignedToId], references: [id])
  assignedToId Int
  client       RichMarketClient? @relation(fields: [clientId], references: [id])
  clientId     Int?
  order        RichMarketOrder?  @relation(fields: [orderId], references: [id])
  orderId      Int?
  dueDate      DateTime
  status       TaskStatus        @default(NEW)
  comment      String?
  createdAt    DateTime          @default(now())

  @@index([tenant, status])
}

model RichMarketSoldProduct {
  id        Int              @id @default(autoincrement())
  tenant    Tenant           @default(RICHMARKET)
  productId Int
  brand     String
  category  ClothingCategory
  color     String
  size      ClothingSize
  quantity  Int
  salePrice Decimal          @db.Decimal(10, 2)
  costPrice Decimal          @db.Decimal(10, 2)
  soldAt    DateTime         @default(now())
  orderId   Int?

  @@index([tenant, soldAt])
  @@index([productId])
  @@index([brand])
  @@map("rich_market_sold_products")
}
SCHEMA

echo "Схема создана"
