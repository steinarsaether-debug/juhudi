-- CreateEnum
CREATE TYPE "CustomerTier" AS ENUM ('STANDARD', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "RiskFlagCategory" AS ENUM ('FINANCIAL_CAPACITY', 'BUSINESS_PERFORMANCE', 'REPAYMENT_BEHAVIOR', 'OPERATIONAL_RISK', 'COLLATERAL_RISK');

-- CreateEnum
CREATE TYPE "RiskFlagSeverity" AS ENUM ('YELLOW', 'RED');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "currentTier" "CustomerTier" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "tierUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ilp_follow_ups" ADD COLUMN     "riskFlagId" TEXT;

-- AlterTable
ALTER TABLE "loan_applications" ADD COLUMN     "customerTierAtApplication" "CustomerTier",
ADD COLUMN     "interestRateDiscountPct" DOUBLE PRECISION,
ADD COLUMN     "processingFeeDiscountPct" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "customer_risk_flags" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "category" "RiskFlagCategory" NOT NULL,
    "severity" "RiskFlagSeverity" NOT NULL,
    "indicator" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "threshold" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "resolvedAt" TIMESTAMP(3),
    "resolvedNote" TEXT,
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_risk_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_risk_flags_loanId_isActive_idx" ON "customer_risk_flags"("loanId", "isActive");

-- CreateIndex
CREATE INDEX "customer_risk_flags_customerId_isActive_idx" ON "customer_risk_flags"("customerId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "customer_risk_flags_loanId_indicator_key" ON "customer_risk_flags"("loanId", "indicator");

-- AddForeignKey
ALTER TABLE "ilp_follow_ups" ADD CONSTRAINT "ilp_follow_ups_riskFlagId_fkey" FOREIGN KEY ("riskFlagId") REFERENCES "customer_risk_flags"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_risk_flags" ADD CONSTRAINT "customer_risk_flags_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_risk_flags" ADD CONSTRAINT "customer_risk_flags_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_risk_flags" ADD CONSTRAINT "customer_risk_flags_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
