-- 成交的线索来源（二级渠道）
ALTER TABLE "Deal" ADD COLUMN "leadSource" TEXT;
CREATE INDEX "Deal_leadSource_idx" ON "Deal"("leadSource");
