-- CreateEnum
CREATE TYPE "QualityFlagType" AS ENUM ('SIMILAR_NAME_SAME_BRANCH', 'SIMILAR_NAME_CROSS_BRANCH', 'NAME_DOB_MATCH', 'GPS_PROXIMITY', 'FINANCIAL_PROFILE_COPY', 'LOAN_PURPOSE_COPY_PASTE', 'ROUND_NUMBER_INCOME', 'NEGATIVE_DISPOSABLE_INCOME', 'HIGH_DEBT_BURDEN', 'RAPID_SUCCESSION', 'GENERIC_LOAN_PURPOSE');

-- CreateEnum
CREATE TYPE "FlagSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "data_quality_flags" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "flagType" "QualityFlagType" NOT NULL,
    "severity" "FlagSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_quality_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "data_quality_flags_entityType_entityId_idx" ON "data_quality_flags"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "data_quality_flags_isResolved_severity_idx" ON "data_quality_flags"("isResolved", "severity");

-- CreateIndex
CREATE INDEX "data_quality_flags_flagType_idx" ON "data_quality_flags"("flagType");

-- AddForeignKey
ALTER TABLE "data_quality_flags" ADD CONSTRAINT "data_quality_flags_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
