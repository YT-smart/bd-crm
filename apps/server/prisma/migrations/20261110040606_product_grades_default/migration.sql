-- AlterTable
ALTER TABLE "OrgProduct" ALTER COLUMN "grades" SET DEFAULT ARRAY[]::TEXT[];

UPDATE "OrgProduct" SET "grades" = ARRAY[]::TEXT[] WHERE "grades" IS NULL;
