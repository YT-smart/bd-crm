-- 每个校区城市一条详细地址
ALTER TABLE "Org" ADD COLUMN "campusAddresses" JSONB NOT NULL DEFAULT '[]';

-- 原来的单个详细地址归到总部城市（没有总部城市时归到第一个校区）
UPDATE "Org"
SET "campusAddresses" = jsonb_build_array(jsonb_build_object('city', COALESCE("city", "officeCities"[1]), 'address', btrim("address")))
WHERE "address" IS NOT NULL AND btrim("address") <> '' AND COALESCE("city", "officeCities"[1]) IS NOT NULL;
