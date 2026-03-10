-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "customerNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "customers_customerNumber_key" ON "customers"("customerNumber");
