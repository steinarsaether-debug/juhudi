-- CreateEnum
CREATE TYPE "ILPSegment" AS ENUM ('FARMER', 'LANDLORD', 'SHOP_OWNER');

-- CreateEnum
CREATE TYPE "ILPEligibilityStatus" AS ENUM ('NOT_ELIGIBLE', 'ELIGIBLE', 'MASTERED');

-- AlterTable
ALTER TABLE "customer_interviews" ADD COLUMN     "ilpSegment" "ILPSegment",
ADD COLUMN     "interviewType" TEXT NOT NULL DEFAULT 'STANDARD';

-- AlterTable
ALTER TABLE "loan_applications" ADD COLUMN     "ilpSegment" "ILPSegment";

-- AlterTable
ALTER TABLE "loans" ADD COLUMN     "ilpCycleNumber" INTEGER;

-- CreateTable
CREATE TABLE "branch_ilp_eligibilities" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "segment" "ILPSegment" NOT NULL,
    "status" "ILPEligibilityStatus" NOT NULL DEFAULT 'NOT_ELIGIBLE',
    "par30AtUnlock" DOUBLE PRECISION,
    "retentionAtUnlock" DOUBLE PRECISION,
    "growthAtUnlock" DOUBLE PRECISION,
    "unlockedAt" TIMESTAMP(3),
    "unlockedById" TEXT,
    "masteredAt" TIMESTAMP(3),
    "masteredById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_ilp_eligibilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ilp_assessments" (
    "id" TEXT NOT NULL,
    "loanApplicationId" TEXT NOT NULL,
    "segment" "ILPSegment" NOT NULL,
    "ownerScore" INTEGER NOT NULL DEFAULT 0,
    "ownerData" JSONB NOT NULL,
    "businessScore" INTEGER NOT NULL DEFAULT 0,
    "businessData" JSONB NOT NULL,
    "operationalRiskScore" INTEGER NOT NULL DEFAULT 0,
    "operationalRiskData" JSONB NOT NULL,
    "cashFlowScore" INTEGER NOT NULL DEFAULT 0,
    "cashFlowData" JSONB NOT NULL,
    "collateralScore" INTEGER NOT NULL DEFAULT 0,
    "collateralData" JSONB NOT NULL,
    "compositeScore" INTEGER NOT NULL DEFAULT 0,
    "ilpRecommendation" TEXT NOT NULL DEFAULT 'DECLINE',
    "assessorNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ilp_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ilp_follow_ups" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "segment" "ILPSegment" NOT NULL,
    "loanCycle" INTEGER NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "visitType" TEXT NOT NULL,
    "milestone" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "visitNotes" TEXT,
    "riskFlags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ilp_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "branch_ilp_eligibilities_branchId_status_idx" ON "branch_ilp_eligibilities"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "branch_ilp_eligibilities_branchId_segment_key" ON "branch_ilp_eligibilities"("branchId", "segment");

-- CreateIndex
CREATE UNIQUE INDEX "ilp_assessments_loanApplicationId_key" ON "ilp_assessments"("loanApplicationId");

-- CreateIndex
CREATE INDEX "ilp_follow_ups_loanId_scheduledDate_idx" ON "ilp_follow_ups"("loanId", "scheduledDate");

-- CreateIndex
CREATE INDEX "ilp_follow_ups_scheduledDate_isCompleted_idx" ON "ilp_follow_ups"("scheduledDate", "isCompleted");

-- CreateIndex
CREATE INDEX "customer_interviews_interviewType_ilpSegment_idx" ON "customer_interviews"("interviewType", "ilpSegment");

-- AddForeignKey
ALTER TABLE "branch_ilp_eligibilities" ADD CONSTRAINT "branch_ilp_eligibilities_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ilp_assessments" ADD CONSTRAINT "ilp_assessments_loanApplicationId_fkey" FOREIGN KEY ("loanApplicationId") REFERENCES "loan_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ilp_follow_ups" ADD CONSTRAINT "ilp_follow_ups_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ilp_follow_ups" ADD CONSTRAINT "ilp_follow_ups_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
