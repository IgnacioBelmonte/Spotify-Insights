import { prisma } from "@/src/lib/db/prisma";
import { refreshAccessToken } from "./client";

export async function getValidAccessToken(userId: string) {
  const token = await prisma.spotifyToken.findUnique({
    where: { userId },
  });

  if (!token) throw new Error("No token found");

  // Si aún es válido, úsalo
  if (token.expiresAt > new Date(Date.now() + 60_000)) {
    return token.accessToken;
  }

  // Refrescar
  const refreshed = await refreshAccessToken(token.refreshToken);

  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

  await prisma.spotifyToken.update({
    where: { userId },
    data: {
      accessToken: refreshed.access_token,
      expiresAt,
    },
  });

  return refreshed.access_token;
}
