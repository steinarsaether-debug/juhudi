-- CreateEnum
CREATE TYPE "ConfigDataType" AS ENUM ('NUMBER', 'PERCENTAGE', 'AMOUNT_KES', 'DAYS', 'MONTHS', 'RATIO', 'BOOLEAN', 'SCORE_POINTS');

-- AlterTable: add with defaults so existing rows (e.g. mpesa_analysis_prompt) are preserved
ALTER TABLE "system_configs"
  ADD COLUMN "category"   TEXT               NOT NULL DEFAULT 'General',
  ADD COLUMN "dataType"   "ConfigDataType"   NOT NULL DEFAULT 'NUMBER',
  ADD COLUMN "isEditable" BOOLEAN            NOT NULL DEFAULT true,
  ADD COLUMN "label"      TEXT               NOT NULL DEFAULT '',
  ADD COLUMN "maxValue"   DOUBLE PRECISION,
  ADD COLUMN "minValue"   DOUBLE PRECISION,
  ADD COLUMN "unit"       TEXT;

-- Back-fill any pre-existing rows so they have sensible labels
UPDATE "system_configs" SET "label" = "key", "category" = 'General' WHERE "label" = '';

-- CreateIndex
CREATE INDEX "system_configs_category_idx" ON "system_configs"("category");
