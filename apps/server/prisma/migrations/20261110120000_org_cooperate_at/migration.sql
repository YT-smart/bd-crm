-- 合作时间：默认取录入时间
ALTER TABLE "Org" ADD COLUMN "cooperateAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "Org" SET "cooperateAt" = "createdAt";
