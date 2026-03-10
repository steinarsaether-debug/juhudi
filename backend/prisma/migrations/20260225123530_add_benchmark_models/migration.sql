-- CreateEnum
CREATE TYPE "BenchmarkCategory" AS ENUM ('FOOD_NUTRITION', 'ACCOMMODATION', 'TRANSPORT', 'EDUCATION', 'HEALTHCARE_UTILITIES', 'CLOTHING_PERSONAL', 'CROP_INCOME', 'LIVESTOCK_INCOME', 'LABOUR_WAGES', 'AGRICULTURAL_INPUTS');

-- CreateEnum
CREATE TYPE "BenchmarkScope" AS ENUM ('NATIONAL', 'REGION', 'COUNTY');

-- CreateEnum
CREATE TYPE "BenchmarkItemType" AS ENUM ('MONTHLY_EXPENSE', 'ANNUAL_EXPENSE', 'INCOME_PER_UNIT', 'MONTHLY_INCOME', 'PRICE_PER_UNIT', 'WAGE_RATE');

-- CreateTable
CREATE TABLE "data_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "dataTypes" TEXT[],
    "updateFrequency" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benchmark_items" (
    "id" TEXT NOT NULL,
    "category" "BenchmarkCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL,
    "itemType" "BenchmarkItemType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "benchmark_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benchmark_values" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "scope" "BenchmarkScope" NOT NULL DEFAULT 'NATIONAL',
    "county" TEXT,
    "region" TEXT,
    "valueLow" DOUBLE PRECISION NOT NULL,
    "valueMid" DOUBLE PRECISION NOT NULL,
    "valueHigh" DOUBLE PRECISION NOT NULL,
    "referenceYear" INTEGER NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "notes" TEXT,
    "assumptions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "benchmark_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "data_sources_shortName_key" ON "data_sources"("shortName");

-- CreateIndex
CREATE UNIQUE INDEX "benchmark_items_category_name_key" ON "benchmark_items"("category", "name");

-- CreateIndex
CREATE INDEX "benchmark_values_itemId_scope_county_idx" ON "benchmark_values"("itemId", "scope", "county");

-- CreateIndex
CREATE INDEX "benchmark_values_referenceYear_idx" ON "benchmark_values"("referenceYear");

-- AddForeignKey
ALTER TABLE "benchmark_values" ADD CONSTRAINT "benchmark_values_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "benchmark_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benchmark_values" ADD CONSTRAINT "benchmark_values_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
