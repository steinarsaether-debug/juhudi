-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR', 'LOAN_OFFICER');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED');

-- CreateEnum
CREATE TYPE "KYCStatus" AS ENUM ('PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED', 'REQUIRES_UPDATE');

-- CreateEnum
CREATE TYPE "AMLStatus" AS ENUM ('PENDING', 'CLEAR', 'FLAGGED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "LandOwnership" AS ENUM ('OWNED', 'LEASED', 'COMMUNAL', 'FAMILY');

-- CreateEnum
CREATE TYPE "IrrigationType" AS ENUM ('IRRIGATED', 'RAIN_FED', 'MIXED');

-- CreateEnum
CREATE TYPE "MarketAccess" AS ENUM ('CONTRACT', 'COOPERATIVE', 'LOCAL_MARKET', 'SUBSISTENCE');

-- CreateEnum
CREATE TYPE "CRBStatus" AS ENUM ('CLEAR', 'LISTED', 'UNKNOWN', 'PERFORMING');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('NATIONAL_ID_FRONT', 'NATIONAL_ID_BACK', 'KRA_PIN', 'PASSPORT_PHOTO', 'PROOF_OF_RESIDENCE', 'FARM_OWNERSHIP_PROOF', 'GROUP_MEMBERSHIP_CERT', 'BANK_STATEMENT', 'MPESA_STATEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'CONDITIONALLY_APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('PENDING_DISBURSEMENT', 'ACTIVE', 'COMPLETED', 'DEFAULTED', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "DisbursementMethod" AS ENUM ('MPESA', 'BANK_TRANSFER', 'CASH');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MPESA', 'BANK_TRANSFER', 'CASH', 'CHEQUE');

-- CreateEnum
CREATE TYPE "LoanRecommendation" AS ENUM ('APPROVE', 'CONDITIONAL', 'DECLINE', 'STRONG_DECLINE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'LOAN_OFFICER',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "employeeId" TEXT,
    "branchId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMP(3),
    "mustChangePass" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "yaraCustomerId" TEXT,
    "yaraRegion" TEXT,
    "nationalIdEnc" TEXT NOT NULL,
    "nationalIdHash" TEXT NOT NULL,
    "phoneEnc" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "alternatePhone" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "maritalStatus" "MaritalStatus" NOT NULL,
    "numberOfDependents" INTEGER NOT NULL DEFAULT 0,
    "county" TEXT NOT NULL,
    "subCounty" TEXT NOT NULL,
    "ward" TEXT,
    "village" TEXT NOT NULL,
    "physicalAddress" TEXT,
    "gpsLatitude" DOUBLE PRECISION,
    "gpsLongitude" DOUBLE PRECISION,
    "nextOfKinName" TEXT NOT NULL,
    "nextOfKinPhone" TEXT NOT NULL,
    "nextOfKinRelation" TEXT NOT NULL,
    "nextOfKinNationalId" TEXT,
    "dataConsentGiven" BOOLEAN NOT NULL DEFAULT false,
    "dataConsentAt" TIMESTAMP(3),
    "dataConsentVersion" TEXT,
    "isPEP" BOOLEAN NOT NULL DEFAULT false,
    "pepDetails" TEXT,
    "kycStatus" "KYCStatus" NOT NULL DEFAULT 'PENDING',
    "amlStatus" "AMLStatus" NOT NULL DEFAULT 'PENDING',
    "amlNotes" TEXT,
    "riskRating" TEXT DEFAULT 'LOW',
    "branchId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farm_profiles" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "farmSize" DOUBLE PRECISION NOT NULL,
    "landOwnership" "LandOwnership" NOT NULL,
    "primaryCrop" TEXT NOT NULL,
    "secondaryCrops" TEXT[],
    "irrigationType" "IrrigationType" NOT NULL,
    "hasGreenhouse" BOOLEAN NOT NULL DEFAULT false,
    "livestockType" TEXT[],
    "livestockCount" INTEGER,
    "marketAccess" "MarketAccess" NOT NULL,
    "distanceToMarket" DOUBLE PRECISION,
    "hasStorageFacility" BOOLEAN NOT NULL DEFAULT false,
    "yaraMemberSince" TIMESTAMP(3),
    "yaraProductsUsed" TEXT[],
    "annualInputCostKes" DOUBLE PRECISION,
    "averageYieldKg" DOUBLE PRECISION,
    "hasElectricity" BOOLEAN NOT NULL DEFAULT false,
    "hasPipedWater" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farm_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_profiles" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "monthlyFarmIncome" DOUBLE PRECISION NOT NULL,
    "monthlyOffFarmIncome" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthlyHouseholdExpenses" DOUBLE PRECISION NOT NULL,
    "otherMonthlyDebt" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hasMpesa" BOOLEAN NOT NULL DEFAULT true,
    "mpesaMonthlyAvgKes" DOUBLE PRECISION,
    "mpesaPhoneEnc" TEXT,
    "hasBankAccount" BOOLEAN NOT NULL DEFAULT false,
    "bankName" TEXT,
    "bankBranchEnc" TEXT,
    "hasGroupMembership" BOOLEAN NOT NULL DEFAULT false,
    "groupName" TEXT,
    "groupType" TEXT,
    "groupMonthlySavingsKes" DOUBLE PRECISION,
    "crbCheckedAt" TIMESTAMP(3),
    "crbStatus" "CRBStatus" NOT NULL DEFAULT 'UNKNOWN',
    "crbReportEnc" TEXT,
    "previousLoansCount" INTEGER NOT NULL DEFAULT 0,
    "previousLoansRepaidOnTime" BOOLEAN,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_documents" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "filePathEnc" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kyc_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_scores" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "cashflowScore" INTEGER NOT NULL,
    "cashflowBreakdown" JSONB NOT NULL,
    "abilityScore" INTEGER NOT NULL,
    "abilityBreakdown" JSONB NOT NULL,
    "willingnessScore" INTEGER NOT NULL,
    "willingnessBreakdown" JSONB NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "recommendation" "LoanRecommendation" NOT NULL,
    "maxLoanAmountKes" DOUBLE PRECISION NOT NULL,
    "suggestedTermMonths" INTEGER NOT NULL,
    "scoringNotes" TEXT,
    "inputSnapshot" JSONB NOT NULL,
    "scoredByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_applications" (
    "id" TEXT NOT NULL,
    "applicationNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "officerId" TEXT NOT NULL,
    "creditScoreId" TEXT,
    "requestedAmountKes" DOUBLE PRECISION NOT NULL,
    "purposeOfLoan" TEXT NOT NULL,
    "loanProductId" TEXT,
    "termMonths" INTEGER NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedAmountKes" DOUBLE PRECISION,
    "interestRatePct" DOUBLE PRECISION,
    "reviewNotes" TEXT,
    "rejectionReason" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "minAmountKes" DOUBLE PRECISION NOT NULL,
    "maxAmountKes" DOUBLE PRECISION NOT NULL,
    "minTermMonths" INTEGER NOT NULL,
    "maxTermMonths" INTEGER NOT NULL,
    "nominalInterestRate" DOUBLE PRECISION NOT NULL,
    "processingFeePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "loan_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" TEXT NOT NULL,
    "loanNumber" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "principalKes" DOUBLE PRECISION NOT NULL,
    "interestRatePct" DOUBLE PRECISION NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "installmentKes" DOUBLE PRECISION NOT NULL,
    "totalRepayableKes" DOUBLE PRECISION NOT NULL,
    "disbursementMethod" "DisbursementMethod" NOT NULL,
    "disbursedAt" TIMESTAMP(3),
    "maturityDate" TIMESTAMP(3),
    "status" "LoanStatus" NOT NULL DEFAULT 'PENDING_DISBURSEMENT',
    "daysInArrears" INTEGER NOT NULL DEFAULT 0,
    "outstandingBalKes" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repayments" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "amountKes" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "recordedById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repayments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changes" JSONB,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_audit_logs" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeId_key" ON "users"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "branches_code_key" ON "branches"("code");

-- CreateIndex
CREATE UNIQUE INDEX "customers_yaraCustomerId_key" ON "customers"("yaraCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "customers_nationalIdHash_key" ON "customers"("nationalIdHash");

-- CreateIndex
CREATE UNIQUE INDEX "customers_phoneHash_key" ON "customers"("phoneHash");

-- CreateIndex
CREATE UNIQUE INDEX "farm_profiles_customerId_key" ON "farm_profiles"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "financial_profiles_customerId_key" ON "financial_profiles"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "loan_applications_applicationNumber_key" ON "loan_applications"("applicationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "loan_products_code_key" ON "loan_products"("code");

-- CreateIndex
CREATE UNIQUE INDEX "loans_loanNumber_key" ON "loans"("loanNumber");

-- CreateIndex
CREATE UNIQUE INDEX "loans_applicationId_key" ON "loans"("applicationId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "customer_audit_logs_customerId_idx" ON "customer_audit_logs"("customerId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_profiles" ADD CONSTRAINT "farm_profiles_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_profiles" ADD CONSTRAINT "financial_profiles_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_scores" ADD CONSTRAINT "credit_scores_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_creditScoreId_fkey" FOREIGN KEY ("creditScoreId") REFERENCES "credit_scores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_loanProductId_fkey" FOREIGN KEY ("loanProductId") REFERENCES "loan_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repayments" ADD CONSTRAINT "repayments_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_audit_logs" ADD CONSTRAINT "customer_audit_logs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
