-- 去掉审核环节：录入的成交直接进入「待到账」，管理员确认到账即为已结算。
-- 已有的待审核记录转为待到账；已驳回的记录保留在库中，但列表和统计不再显示。
ALTER TABLE "Deal" ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT';
UPDATE "Deal" SET "status" = 'PENDING_PAYMENT' WHERE "status" = 'PENDING_AUDIT';
