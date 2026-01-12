BEGIN;
TRUNCATE TABLE
  "Notification",
  "AdSpend",
  "OrderComment",
  "OrderItem",
  "Task",
  "Subscription",
  "TradeIn",
  "KitItem",
  "Kit",
  "Order",
  "Product",
  "Client",
  "AnalyticsDaily"
RESTART IDENTITY CASCADE;
COMMIT;