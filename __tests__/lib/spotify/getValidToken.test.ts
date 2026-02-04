/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import path from "path";
import { getValidAccessToken } from "@/src/lib/spotify/getValidToken";
import { prisma } from "@/src/lib/db/prisma";
import * as clientModule from "@/src/lib/spotify/client";
import { DeepMockProxy } from "jest-mock-extended";
import { PrismaClient } from "@prisma/client";

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

jest.mock("@/src/lib/db/prisma", () =>
  require(path.join(process.cwd(), "__tests__", "mocks", "prisma.mock")),
);
jest.mock("@/src/lib/spotify/client", () =>
  require(
    path.join(process.cwd(), "__tests__", "mocks", "spotify.client.mock"),
  ),
);

describe("getValidAccessToken", () => {
  const mockUserId = "test-user-id";
  const mockAccessToken = "mock-access-token";
  const mockRefreshToken = "mock-refresh-token";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return valid token if not expired", async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    mockedPrisma.spotifyToken.findUnique.mockResolvedValue({
      id: "token-id",
      userId: mockUserId,
      accessToken: mockAccessToken,
      refreshToken: mockRefreshToken,
      expiresAt: futureDate,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const token = await getValidAccessToken(mockUserId);

    expect(token).toBe(mockAccessToken);
    expect(prisma.spotifyToken.findUnique).toHaveBeenCalledWith({
      where: { userId: mockUserId },
    });
  });

  it("should throw error if no token found", async () => {
    mockedPrisma.spotifyToken.findUnique.mockResolvedValue(null as never);

    await expect(getValidAccessToken(mockUserId)).rejects.toThrow(
      "No Spotify token found",
    );
  });

  it("should refresh token if expired", async () => {
    const pastDate = new Date(Date.now() - 60 * 1000); // 1 minute ago
    const newAccessToken = "new-access-token";
    const expiresIn = 3600; // 1 hour

    mockedPrisma.spotifyToken.findUnique.mockResolvedValue({
      id: "token-id",
      userId: mockUserId,
      accessToken: mockAccessToken,
      refreshToken: mockRefreshToken,
      expiresAt: pastDate,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    jest.spyOn(clientModule, 'refreshAccessToken').mockResolvedValue({
      access_token: newAccessToken,
      token_type: 'Bearer',
      scope: 'user-read-email user-read-private',
      expires_in: expiresIn,
    });

    mockedPrisma.spotifyToken.update.mockResolvedValue({
      id: "token-id",
      userId: mockUserId,
      accessToken: newAccessToken,
      refreshToken: mockRefreshToken,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const token = await getValidAccessToken(mockUserId);

    expect(token).toBe(newAccessToken);
    expect(clientModule.refreshAccessToken).toHaveBeenCalledWith(
      mockRefreshToken,
    );
    expect(prisma.spotifyToken.update).toHaveBeenCalled();
  });

  it("should delete token if refresh fails", async () => {
    const pastDate = new Date(Date.now() - 60 * 1000); // 1 minute ago

    mockedPrisma.spotifyToken.findUnique.mockResolvedValue({
      id: "token-id",
      userId: mockUserId,
      accessToken: mockAccessToken,
      refreshToken: mockRefreshToken,
      expiresAt: pastDate,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    jest.spyOn(clientModule, 'refreshAccessToken').mockRejectedValue(new Error("Refresh failed"));

    mockedPrisma.spotifyToken.deleteMany.mockResolvedValue({
      count: 1,
    });

    await expect(getValidAccessToken(mockUserId)).rejects.toThrow(
      "Spotify token refresh failed",
    );

    expect(prisma.spotifyToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: mockUserId },
    });
  });
});
