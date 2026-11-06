-- AlterTable
ALTER TABLE "OrgProduct" ADD COLUMN     "level" INTEGER;

-- CreateTable
CREATE TABLE "OrgReview" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgReview_orgId_createdAt_idx" ON "OrgReview"("orgId", "createdAt");

-- AddForeignKey
ALTER TABLE "OrgReview" ADD CONSTRAINT "OrgReview_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgReview" ADD CONSTRAINT "OrgReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 业务类型改为常用短名：留学申请 -> 留学，语言培训 -> 语培（其余旧值作为自定义类型保留）
UPDATE "Org" SET "businessTypes" = (
  SELECT COALESCE(array_agg(DISTINCT CASE t WHEN '留学申请' THEN '留学' WHEN '语言培训' THEN '语培' ELSE t END), '{}')
  FROM unnest("businessTypes") AS t
) WHERE "businessTypes" && ARRAY['留学申请', '语言培训'];
UPDATE "OrgProduct" SET "type" = '留学' WHERE "type" = '留学申请';
UPDATE "OrgProduct" SET "type" = '语培' WHERE "type" = '语言培训';
