-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "spotifyUserId" TEXT NOT NULL,
    "displayName" TEXT,
    "email" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpotifyToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpotifyToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Track" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "albumName" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudioFeatures" (
    "trackId" TEXT NOT NULL,
    "danceability" DOUBLE PRECISION,
    "energy" DOUBLE PRECISION,
    "valence" DOUBLE PRECISION,
    "tempo" DOUBLE PRECISION,
    "acousticness" DOUBLE PRECISION,
    "instrumentalness" DOUBLE PRECISION,
    "liveness" DOUBLE PRECISION,
    "speechiness" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AudioFeatures_pkey" PRIMARY KEY ("trackId")
);

-- CreateTable
CREATE TABLE "ListeningEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListeningEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_spotifyUserId_key" ON "User"("spotifyUserId");

-- CreateIndex
CREATE UNIQUE INDEX "SpotifyToken_userId_key" ON "SpotifyToken"("userId");

-- CreateIndex
CREATE INDEX "SpotifyToken_expiresAt_idx" ON "SpotifyToken"("expiresAt");

-- CreateIndex
CREATE INDEX "ListeningEvent_userId_playedAt_idx" ON "ListeningEvent"("userId", "playedAt");

-- CreateIndex
CREATE INDEX "ListeningEvent_trackId_idx" ON "ListeningEvent"("trackId");

-- AddForeignKey
ALTER TABLE "SpotifyToken" ADD CONSTRAINT "SpotifyToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudioFeatures" ADD CONSTRAINT "AudioFeatures_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningEvent" ADD CONSTRAINT "ListeningEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningEvent" ADD CONSTRAINT "ListeningEvent_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;
