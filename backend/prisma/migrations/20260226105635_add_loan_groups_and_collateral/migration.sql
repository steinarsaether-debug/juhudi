-- CreateEnum
CREATE TYPE "LoanProductCategory" AS ENUM ('SHORT_TERM_INPUTS', 'LONG_TERM_INVESTMENT');

-- CreateEnum
CREATE TYPE "LoanType" AS ENUM ('INDIVIDUAL', 'GROUP');

-- CreateEnum
CREATE TYPE "LoanGroupStatus" AS ENUM ('FORMING', 'ACTIVE', 'SUSPENDED', 'DISSOLVED');

-- CreateEnum
CREATE TYPE "GroupMeetingFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "GroupMemberRole" AS ENUM ('CHAIR', 'SECRETARY', 'TREASURER', 'MEMBER');

-- CreateEnum
CREATE TYPE "CollateralType" AS ENUM ('TITLE_DEED', 'MOTOR_VEHICLE', 'CHATTEL', 'LIVESTOCK', 'CROP_LIEN', 'SALARY_ASSIGNMENT', 'GROUP_GUARANTEE', 'PERSONAL_GUARANTEE', 'SAVINGS_DEPOSIT', 'OTHER');

-- AlterTable
ALTER TABLE "loan_applications" ADD COLUMN     "copingMechanism" TEXT,
ADD COLUMN     "groupLoanShareKes" DOUBLE PRECISION,
ADD COLUMN     "hadShockPastYear" BOOLEAN,
ADD COLUMN     "hasAlternativeIncome" BOOLEAN,
ADD COLUMN     "hasSavingsBuffer" BOOLEAN,
ADD COLUMN     "loanGroupId" TEXT,
ADD COLUMN     "loanType" "LoanType" NOT NULL DEFAULT 'INDIVIDUAL',
ADD COLUMN     "monthlyExpensesSnapshot" DOUBLE PRECISION,
ADD COLUMN     "monthlyIncomeSnapshot" DOUBLE PRECISION,
ADD COLUMN     "purposeCategory" TEXT,
ADD COLUMN     "repaymentMethod" "DisbursementMethod",
ADD COLUMN     "savingsBufferMonths" INTEGER,
ADD COLUMN     "shockType" TEXT;

-- AlterTable
ALTER TABLE "loan_products" ADD COLUMN     "category" "LoanProductCategory";

-- CreateTable
CREATE TABLE "loan_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registrationNo" TEXT,
    "branchId" TEXT NOT NULL,
    "loanOfficerId" TEXT NOT NULL,
    "status" "LoanGroupStatus" NOT NULL DEFAULT 'FORMING',
    "meetingFrequency" "GroupMeetingFrequency" NOT NULL,
    "meetingDay" TEXT,
    "meetingLocation" TEXT,
    "formedAt" TIMESTAMP(3) NOT NULL,
    "registeredAt" TIMESTAMP(3),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_group_members" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "role" "GroupMemberRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "loan_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_collateral" (
    "id" TEXT NOT NULL,
    "loanApplicationId" TEXT NOT NULL,
    "collateralType" "CollateralType" NOT NULL,
    "description" TEXT NOT NULL,
    "estimatedValueKes" DOUBLE PRECISION NOT NULL,
    "documentFileName" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_collateral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "loan_groups_branchId_status_idx" ON "loan_groups"("branchId", "status");

-- CreateIndex
CREATE INDEX "loan_groups_loanOfficerId_idx" ON "loan_groups"("loanOfficerId");

-- CreateIndex
CREATE INDEX "loan_group_members_customerId_idx" ON "loan_group_members"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "loan_group_members_groupId_customerId_key" ON "loan_group_members"("groupId", "customerId");

-- CreateIndex
CREATE INDEX "loan_collateral_loanApplicationId_idx" ON "loan_collateral"("loanApplicationId");

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_loanGroupId_fkey" FOREIGN KEY ("loanGroupId") REFERENCES "loan_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_groups" ADD CONSTRAINT "loan_groups_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_groups" ADD CONSTRAINT "loan_groups_loanOfficerId_fkey" FOREIGN KEY ("loanOfficerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_group_members" ADD CONSTRAINT "loan_group_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "loan_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_group_members" ADD CONSTRAINT "loan_group_members_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_collateral" ADD CONSTRAINT "loan_collateral_loanApplicationId_fkey" FOREIGN KEY ("loanApplicationId") REFERENCES "loan_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
