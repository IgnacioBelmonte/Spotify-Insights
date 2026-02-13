ALTER TABLE "Track"
ADD COLUMN "explicit" BOOLEAN,
ADD COLUMN "albumType" TEXT,
ADD COLUMN "albumReleaseDate" TEXT,
ADD COLUMN "albumReleaseDatePrecision" TEXT;

ALTER TABLE "ListeningEvent"
ADD COLUMN "contextType" TEXT,
ADD COLUMN "contextUri" TEXT;

CREATE INDEX "ListeningEvent_userId_contextType_idx"
ON "ListeningEvent"("userId", "contextType");
