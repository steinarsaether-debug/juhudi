-- CreateTable
CREATE TABLE "location_pings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "activity" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_pings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "location_pings_userId_createdAt_idx" ON "location_pings"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "location_pings" ADD CONSTRAINT "location_pings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
