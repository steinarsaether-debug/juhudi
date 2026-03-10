-- CreateEnum
CREATE TYPE "BccMeetingStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "BccFlagCategory" AS ENUM ('REPAYMENT_CAPACITY', 'PURPOSE_RISK', 'CHARACTER_CONCERN', 'SECTOR_RISK', 'COLLATERAL_WEAKNESS', 'DATA_QUALITY', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BCC_MEETING_SCHEDULED', 'BCC_MEETING_STARTED', 'BCC_SESSION_PRESENTING', 'BCC_VOTE_CAST', 'BCC_FLAG_RAISED', 'BCC_DECISION_MADE', 'BCC_CONDITION_DUE');

-- AlterTable
ALTER TABLE "bcc_sessions" ADD COLUMN     "agendaIndex" INTEGER,
ADD COLUMN     "loNarrative" TEXT,
ADD COLUMN     "loRecommendation" TEXT,
ADD COLUMN     "meetingId" TEXT,
ADD COLUMN     "presentedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "system_configs" ALTER COLUMN "category" DROP DEFAULT,
ALTER COLUMN "label" DROP DEFAULT;

-- CreateTable
CREATE TABLE "bcc_meetings" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "title" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "status" "BccMeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "closedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bcc_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bcc_flags" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "raisedById" TEXT NOT NULL,
    "category" "BccFlagCategory" NOT NULL,
    "severity" "RiskFlagSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedNote" TEXT,
    "didMaterialize" BOOLEAN,
    "materializedNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bcc_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bcc_conditions" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "addedById" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "verifiedNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bcc_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bcc_meetings_branchId_status_idx" ON "bcc_meetings"("branchId", "status");

-- CreateIndex
CREATE INDEX "bcc_flags_sessionId_idx" ON "bcc_flags"("sessionId");

-- CreateIndex
CREATE INDEX "bcc_flags_raisedById_idx" ON "bcc_flags"("raisedById");

-- CreateIndex
CREATE INDEX "bcc_conditions_sessionId_idx" ON "bcc_conditions"("sessionId");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "bcc_sessions_meetingId_idx" ON "bcc_sessions"("meetingId");

-- AddForeignKey
ALTER TABLE "bcc_meetings" ADD CONSTRAINT "bcc_meetings_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bcc_meetings" ADD CONSTRAINT "bcc_meetings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bcc_sessions" ADD CONSTRAINT "bcc_sessions_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "bcc_meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bcc_flags" ADD CONSTRAINT "bcc_flags_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "bcc_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bcc_flags" ADD CONSTRAINT "bcc_flags_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bcc_flags" ADD CONSTRAINT "bcc_flags_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bcc_conditions" ADD CONSTRAINT "bcc_conditions_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "bcc_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bcc_conditions" ADD CONSTRAINT "bcc_conditions_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bcc_conditions" ADD CONSTRAINT "bcc_conditions_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
