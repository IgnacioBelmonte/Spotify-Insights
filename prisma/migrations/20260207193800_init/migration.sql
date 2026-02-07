/*
  Warnings:

  - A unique constraint covering the columns `[userId,playedAt]` on the table `ListeningEvent` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ListeningEvent_userId_playedAt_key" ON "ListeningEvent"("userId", "playedAt");
