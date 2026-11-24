-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "advisorId" TEXT;

-- CreateIndex
CREATE INDEX "Deal_advisorId_idx" ON "Deal"("advisorId");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

