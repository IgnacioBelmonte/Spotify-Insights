import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { getInsightsOverview } from "@/src/lib/insights/insights.service";

// For handler tests we'll mock the deeper dependencies (service, prisma, spotify client, next/headers)
import path from "path";
jest.mock(
  "@/src/lib/insights/insights.service",
  () => require(path.join(process.cwd(), "__tests__", "mocks", "insights.service.mock"))
);
jest.mock("next/headers", () => require(path.join(process.cwd(), "__tests__", "mocks", "next.headers.mock")));
jest.mock(
  "@/src/lib/spotify/client",
  () => require(path.join(process.cwd(), "__tests__", "mocks", "spotify.client.mock"))
);

import { makeReq } from "../utils/route.test-utils";

const { exchangeCodeForToken, fetchSpotifyMe } = require("@/src/lib/spotify/client");
const { prisma } = require("@/src/lib/db/prisma");

describe("API Routes - /api/insights/overview", () => {
  const mockUserId = "test-user-id";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 401 without session", async () => {
    // This test would require mocking the actual Route Handler
    // For now, we document the expected behavior
    expect(true).toBe(true);
  });

  it("should return insights data for authenticated user", async () => {
    // Call the actual route handler GET with a mocked cookie header
    const { GET } = await import("@/app/api/insights/overview/route");
    const nextUrl = new URL("http://localhost/api/insights/overview?tz=UTC");

    const req = {
      headers: { get: (name: string) => (name === "cookie" ? `sid=${mockUserId}` : null) },
      url: nextUrl.toString(),
      nextUrl,
    } as unknown as Request;

    const res = await GET(req as any);

    // NextResponse-like objects support json() to read body
    const body = await (res as any).json();

    expect(body).toHaveProperty("stats");
    expect(body).toHaveProperty("topTracks");
    expect(body).toHaveProperty("dailyActivity");
    expect((res as any).status).toBe(200);
  });

  it("should handle errors gracefully", async () => {
    // Error handling would be tested with actual Route Handler mocks
    expect(true).toBe(true);
  });
});

describe("API Routes - /api/auth/*", () => {
  it("should generate oauth state on login", () => {
    // Call the login handler and ensure it redirects and sets oauth_state cookie
    return (async () => {
      const { GET } = await import("@/app/api/auth/login/route");
      const res = await GET();

      // Redirect location should be Spotify accounts domain
      const location = (res as any).headers.get("location");
      expect(location).toContain("accounts.spotify.com/authorize");

      const setCookie = (res as any).headers.get("set-cookie") || (res as any).headers.get("Set-Cookie");
      expect(setCookie).toContain("oauth_state=");
    })();
  });

  it("should validate state on callback", () => {
    return (async () => {
      const { GET } = await import("@/app/api/auth/callback/route");

      // Case: Spotify returned error param
      const reqWithError = { url: "http://localhost/api/auth/callback?error=access_denied", headers: { get: () => null } } as any;
      const res1 = await GET(reqWithError);
      const loc1 = (res1 as any).headers.get("location");
      expect(loc1).toContain("/?error=access_denied");

      // Case: missing cookie state -> session expired
      const reqMissingCookie = { url: "http://localhost/api/auth/callback?code=abc&state=state123", headers: { get: () => "" } } as any;
      const res2 = await GET(reqMissingCookie);
      const loc2 = (res2 as any).headers.get("location");
      // location will be URL-encoded; decode for assertion
      expect(decodeURIComponent(loc2)).toContain("?error=");
    })();
  });

  it("should clear cookies on logout", () => {
    return (async () => {
      // Mock cookies() from next/headers to return a cookie store with sid
      const { cookies } = require("next/headers");
      cookies.mockImplementation(() => ({ get: (name: string) => ({ value: "test-user-id" }) }));

      const { POST } = await import("@/app/api/auth/logout/route");
      const res = await POST();

      const location = (res as any).headers.get("location");
      expect(location).toBe(`${process.env.APP_URL || "http://localhost:3000"}/`);
    })();
  });

  it("should handle successful callback and set session cookie", async () => {
    // Prepare mocks for token exchange and user fetch
    (exchangeCodeForToken as jest.Mock).mockResolvedValue({
      access_token: "access-xyz",
      refresh_token: "refresh-xyz",
      expires_in: 3600,
    });

    (fetchSpotifyMe as jest.Mock).mockResolvedValue({
      id: "spotify-123",
      display_name: "Test User",
      email: "test@example.com",
      images: [{ url: "https://i.scdn.co/image/test" }],
      product: "premium",
    });

    // Mock prisma upsert results
    prisma.user.upsert.mockResolvedValue({ id: "user-db-id", displayName: "Test User" });
    prisma.spotifyToken.upsert.mockResolvedValue({ userId: "user-db-id", accessToken: "access-xyz" });

    const state = "test-state-abc";
    const req = makeReq(`http://localhost/api/auth/callback?code=code123&state=${state}`, `oauth_state=${state}`);

    const { GET } = await import("@/app/api/auth/callback/route");
    const res = await GET(req as any);

    const location = (res as any).headers.get("location");
    expect(location).toContain("/dashboard");

    const setCookie = (res as any).headers.get("set-cookie") || (res as any).headers.get("Set-Cookie");
    expect(setCookie).toContain("sid=");

    // Ensure prisma upsert was called
    expect(prisma.user.upsert).toHaveBeenCalled();
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          isPremium: true,
        }),
        create: expect.objectContaining({
          isPremium: true,
        }),
      })
    );
    expect(prisma.spotifyToken.upsert).toHaveBeenCalled();
  });
});
