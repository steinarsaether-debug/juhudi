-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('DRAFT', 'COMPLETED');

-- CreateEnum
CREATE TYPE "InterviewRecommendation" AS ENUM ('APPROVE', 'APPROVE_WITH_CONDITIONS', 'FURTHER_EVALUATION', 'DECLINE');

-- CreateTable
CREATE TABLE "customer_interviews" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "conductedById" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "status" "InterviewStatus" NOT NULL DEFAULT 'DRAFT',
    "answers" JSONB NOT NULL DEFAULT '{}',
    "totalScore" DOUBLE PRECISION,
    "maxScore" DOUBLE PRECISION,
    "scorePercent" DOUBLE PRECISION,
    "recommendation" "InterviewRecommendation",
    "loNotes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_interviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_interviews_customerId_idx" ON "customer_interviews"("customerId");

-- CreateIndex
CREATE INDEX "customer_interviews_conductedById_idx" ON "customer_interviews"("conductedById");

-- AddForeignKey
ALTER TABLE "customer_interviews" ADD CONSTRAINT "customer_interviews_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_interviews" ADD CONSTRAINT "customer_interviews_conductedById_fkey" FOREIGN KEY ("conductedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
