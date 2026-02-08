import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { cookies } from "next/headers";
import { prisma } from "@/src/lib/db/prisma";
import { getValidAccessToken } from "@/src/lib/spotify/getValidToken";
import {
  getCurrentSpotifyPlayback,
  playTrackOnSpotifyDevice,
} from "@/src/lib/spotify/player.service";
import { readNextResponse } from "../utils/route.test-utils";

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

jest.mock("@/src/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("@/src/lib/spotify/getValidToken", () => ({
  getValidAccessToken: jest.fn(),
}));

jest.mock("@/src/lib/spotify/player.service", () => ({
  getCurrentSpotifyPlayback: jest.fn(),
  playTrackOnSpotifyDevice: jest.fn(),
}));

type CookieStore = Awaited<ReturnType<typeof cookies>>;

const mockedCookies = cookies as jest.MockedFunction<typeof cookies>;
const mockedGetValidAccessToken = getValidAccessToken as jest.MockedFunction<
  typeof getValidAccessToken
>;
const mockedPlayTrackOnSpotifyDevice = playTrackOnSpotifyDevice as jest.MockedFunction<
  typeof playTrackOnSpotifyDevice
>;
const mockedGetCurrentSpotifyPlayback = getCurrentSpotifyPlayback as jest.MockedFunction<
  typeof getCurrentSpotifyPlayback
>;
const mockedUserFindUnique = prisma.user.findUnique as unknown as jest.Mock;

function setSidCookie(sid: string | null) {
  mockedCookies.mockResolvedValue({
    get: () => (sid ? { name: "sid", value: sid } : undefined),
  } as unknown as CookieStore);
}

describe("API Routes - /api/spotify/player-token", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 without session", async () => {
    setSidCookie(null);

    const { GET } = await import("@/app/api/spotify/player-token/route");
    const response = await GET();
    const { status } = await readNextResponse(response);

    expect(status).toBe(401);
  });

  it("returns 403 for non-premium users", async () => {
    setSidCookie("user-1");
    mockedUserFindUnique.mockResolvedValue({ isPremium: false });

    const { GET } = await import("@/app/api/spotify/player-token/route");
    const response = await GET();
    const { status } = await readNextResponse(response);

    expect(status).toBe(403);
  });

  it("returns an access token for premium users", async () => {
    setSidCookie("user-1");
    mockedUserFindUnique.mockResolvedValue({ isPremium: true });
    mockedGetValidAccessToken.mockResolvedValue("spotify-access-token");

    const { GET } = await import("@/app/api/spotify/player-token/route");
    const response = await GET();
    const { status, body } = await readNextResponse(response);

    expect(status).toBe(200);
    expect(body?.accessToken).toBe("spotify-access-token");
  });
});

describe("API Routes - /api/spotify/player/play", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 on invalid payload", async () => {
    setSidCookie("user-1");
    mockedUserFindUnique.mockResolvedValue({ isPremium: true });
    const { POST } = await import("@/app/api/spotify/player/play/route");

    const request = new Request("http://localhost/api/spotify/player/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackId: "abc" }),
    });

    const response = await POST(request);
    const { status } = await readNextResponse(response);
    expect(status).toBe(400);
  });

  it("plays track for premium users", async () => {
    setSidCookie("user-1");
    mockedUserFindUnique.mockResolvedValue({ isPremium: true });
    mockedGetValidAccessToken.mockResolvedValue("spotify-access-token");
    mockedPlayTrackOnSpotifyDevice.mockResolvedValue(undefined);

    const { POST } = await import("@/app/api/spotify/player/play/route");
    const request = new Request("http://localhost/api/spotify/player/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackId: "track-1", deviceId: "device-1" }),
    });

    const response = await POST(request);
    const { status } = await readNextResponse(response);

    expect(status).toBe(200);
    expect(mockedPlayTrackOnSpotifyDevice).toHaveBeenCalledWith(
      "spotify-access-token",
      "track-1",
      "device-1"
    );
  });
});

describe("API Routes - /api/spotify/player/current", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns playback snapshot for premium users", async () => {
    setSidCookie("user-1");
    mockedUserFindUnique.mockResolvedValue({ isPremium: true });
    mockedGetValidAccessToken.mockResolvedValue("spotify-access-token");
    mockedGetCurrentSpotifyPlayback.mockResolvedValue({
      trackId: "track-live",
      trackName: "Live Track",
      artistName: "Live Artist",
      albumImageUrl: "https://i.scdn.co/image/live",
      durationMs: 180000,
      positionMs: 42000,
      isPlaying: true,
    });

    const { GET } = await import("@/app/api/spotify/player/current/route");
    const response = await GET();
    const { status, body } = await readNextResponse(response);

    expect(status).toBe(200);
    expect(body?.playback?.trackId).toBe("track-live");
  });

  it("returns 403 for non premium users", async () => {
    setSidCookie("user-1");
    mockedUserFindUnique.mockResolvedValue({ isPremium: false });

    const { GET } = await import("@/app/api/spotify/player/current/route");
    const response = await GET();
    const { status } = await readNextResponse(response);

    expect(status).toBe(403);
  });
});
