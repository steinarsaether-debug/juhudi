-- CreateEnum
CREATE TYPE "MpesaAnalysisStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETE', 'FAILED');

-- CreateTable
CREATE TABLE "mpesa_statements" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "filePathEnc" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "transactionCount" INTEGER NOT NULL DEFAULT 0,
    "analysisStatus" "MpesaAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "analysisError" TEXT,
    "analysedAt" TIMESTAMP(3),
    "overallRiskLevel" TEXT,
    "riskSummary" TEXT,
    "recommendedAction" TEXT,
    "detectedLoans" JSONB,
    "suspiciousPatterns" JSONB,
    "gamblingTransactions" JSONB,
    "positiveIndicators" JSONB,
    "avgMonthlyInflow" DOUBLE PRECISION,
    "avgMonthlyOutflow" DOUBLE PRECISION,
    "avgMonthlyNet" DOUBLE PRECISION,
    "fulizaUsageCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mpesa_statements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mpesa_statements_customerId_idx" ON "mpesa_statements"("customerId");

-- CreateIndex
CREATE INDEX "mpesa_statements_uploadedById_idx" ON "mpesa_statements"("uploadedById");

-- AddForeignKey
ALTER TABLE "mpesa_statements" ADD CONSTRAINT "mpesa_statements_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mpesa_statements" ADD CONSTRAINT "mpesa_statements_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
