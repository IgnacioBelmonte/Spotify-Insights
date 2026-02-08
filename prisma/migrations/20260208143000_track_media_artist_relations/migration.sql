-- AlterTable
ALTER TABLE "Track"
  ADD COLUMN "albumImageUrl" TEXT,
  ADD COLUMN "previewUrl" TEXT;

-- CreateTable
CREATE TABLE "Artist" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "imageUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackArtist" (
  "trackId" TEXT NOT NULL,
  "artistId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "TrackArtist_pkey" PRIMARY KEY ("trackId", "artistId")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackArtist_trackId_position_key" ON "TrackArtist"("trackId", "position");

-- CreateIndex
CREATE INDEX "TrackArtist_artistId_idx" ON "TrackArtist"("artistId");

-- CreateIndex
CREATE INDEX "TrackArtist_trackId_position_idx" ON "TrackArtist"("trackId", "position");

-- AddForeignKey
ALTER TABLE "TrackArtist" ADD CONSTRAINT "TrackArtist_trackId_fkey"
FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackArtist" ADD CONSTRAINT "TrackArtist_artistId_fkey"
FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
