\if :{?ALLOW_DANGEROUS_SCRIPT}
\else
\echo 'DANGEROUS SQL SCRIPT blocked. Re-run with psql -v ALLOW_DANGEROUS_SCRIPT=true only for an audited local maintenance run.'
\quit 1
\endif
\if :ALLOW_DANGEROUS_SCRIPT
\else
\echo 'DANGEROUS SQL SCRIPT blocked. ALLOW_DANGEROUS_SCRIPT must be true.'
\quit 1
\endif

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
