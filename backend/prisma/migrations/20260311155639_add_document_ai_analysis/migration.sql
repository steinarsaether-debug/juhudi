-- AlterTable
ALTER TABLE "kyc_documents" ADD COLUMN     "aiAnalysedAt" TIMESTAMP(3),
ADD COLUMN     "aiExtractedFields" JSONB,
ADD COLUMN     "aiExtractedText" TEXT,
ADD COLUMN     "aiStatus" TEXT,
ADD COLUMN     "aiValidationFlags" JSONB;
