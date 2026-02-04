import { prisma } from "@/src/lib/db/prisma";
import { refreshAccessToken } from "./client";

export async function getValidAccessToken(userId: string) {
  const token = await prisma.spotifyToken.findUnique({
    where: { userId },
  });

  if (!token) {
    throw new Error("No Spotify token found - user may have logged out");
  }

  // Si aún es válido, úsalo
  if (token.expiresAt > new Date(Date.now() + 60_000)) {
    return token.accessToken;
  }

  // Token expirado - intentar refrescar
  try {
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
  } catch (err) {
    // Si el refresh falla (token revocado, etc), eliminar el token inválido
    console.error("[getValidAccessToken] Refresh failed for user:", userId, err);
    await prisma.spotifyToken.deleteMany({
      where: { userId },
    });
    throw new Error("Spotify token refresh failed - please login again");
  }
}
