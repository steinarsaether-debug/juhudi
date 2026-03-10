-- CreateEnum
CREATE TYPE "BccStatus" AS ENUM ('OPEN', 'DECIDED', 'OVERRIDDEN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BccOutcome" AS ENUM ('APPROVED', 'REFUSED', 'REFERRED', 'CONDITIONAL');

-- CreateEnum
CREATE TYPE "VoteType" AS ENUM ('ENDORSE', 'REFUSE', 'ABSTAIN');

-- CreateEnum
CREATE TYPE "CollectionActionType" AS ENUM ('AUTO_ALERT', 'PHONE_CALL', 'SMS_SENT', 'FIELD_VISIT', 'PROMISE_TO_PAY', 'PARTIAL_PAYMENT', 'DEMAND_LETTER', 'LEGAL_NOTICE', 'WRITE_OFF_RECOMMENDED', 'RESTRUCTURED', 'OTHER');

-- CreateTable
CREATE TABLE "bcc_sessions" (
    "id" TEXT NOT NULL,
    "loanApplicationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "status" "BccStatus" NOT NULL DEFAULT 'OPEN',
    "outcome" "BccOutcome",
    "outcomeNotes" TEXT,
    "managerOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "overriddenById" TEXT,
    "quorumRequired" INTEGER NOT NULL DEFAULT 2,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bcc_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bcc_votes" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vote" "VoteType" NOT NULL,
    "rationale" TEXT,
    "votedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bcc_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bcc_comments" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bcc_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_actions" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "performedById" TEXT NOT NULL,
    "daysInArrears" INTEGER NOT NULL,
    "outstandingKes" DOUBLE PRECISION NOT NULL,
    "actionType" "CollectionActionType" NOT NULL,
    "notes" TEXT,
    "nextActionDate" TIMESTAMP(3),
    "promisedAmount" DOUBLE PRECISION,
    "promisedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bcc_sessions_loanApplicationId_key" ON "bcc_sessions"("loanApplicationId");

-- CreateIndex
CREATE INDEX "bcc_sessions_branchId_status_idx" ON "bcc_sessions"("branchId", "status");

-- CreateIndex
CREATE INDEX "bcc_sessions_loanApplicationId_idx" ON "bcc_sessions"("loanApplicationId");

-- CreateIndex
CREATE UNIQUE INDEX "bcc_votes_sessionId_userId_key" ON "bcc_votes"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "bcc_comments_sessionId_createdAt_idx" ON "bcc_comments"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "collection_actions_loanId_createdAt_idx" ON "collection_actions"("loanId", "createdAt");

-- CreateIndex
CREATE INDEX "collection_actions_performedById_idx" ON "collection_actions"("performedById");

-- CreateIndex
CREATE INDEX "collection_actions_nextActionDate_idx" ON "collection_actions"("nextActionDate");

-- AddForeignKey
ALTER TABLE "bcc_sessions" ADD CONSTRAINT "bcc_sessions_loanApplicationId_fkey" FOREIGN KEY ("loanApplicationId") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bcc_sessions" ADD CONSTRAINT "bcc_sessions_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bcc_votes" ADD CONSTRAINT "bcc_votes_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "bcc_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bcc_votes" ADD CONSTRAINT "bcc_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bcc_comments" ADD CONSTRAINT "bcc_comments_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "bcc_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bcc_comments" ADD CONSTRAINT "bcc_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_actions" ADD CONSTRAINT "collection_actions_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_actions" ADD CONSTRAINT "collection_actions_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
