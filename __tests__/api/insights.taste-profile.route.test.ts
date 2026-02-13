import { describe, it, expect, beforeEach } from "@jest/globals";

describe("API Route - /api/insights/taste-profile", () => {
  beforeEach(async () => {
    const { clearTasteProfileCache } = await import("@/src/lib/insights/taste-profile.service");
    clearTasteProfileCache();
  });

  it("returns 401 when session cookie is missing", async () => {
    const { GET } = await import("@/app/api/insights/taste-profile/route");

    const req = {
      headers: { get: () => null },
    } as unknown as Request;

    const res = await GET(req as never);
    const body = await (res as Response).json();

    expect((res as Response).status).toBe(401);
    expect(body.ok).toBe(false);
  });

  it("returns taste profile snapshot for authenticated user", async () => {
    const { prisma } = await import("@/src/lib/db/prisma");
    prisma.listeningEvent.findMany.mockResolvedValue([
      {
        id: "e1",
        userId: "test-user-id",
        trackId: "t1",
        playedAt: new Date("2026-02-10T10:00:00Z"),
        track: {
          artistName: "Daft Punk",
          albumReleaseDate: "2013-05-17",
          features: { energy: 0.8, valence: 0.6 },
        },
      },
      {
        id: "e2",
        userId: "test-user-id",
        trackId: "t2",
        playedAt: new Date("2026-02-11T10:00:00Z"),
        track: {
          artistName: "Bad Bunny",
          albumReleaseDate: "2020-12-24",
          features: { energy: 0.6, valence: 0.4 },
        },
      },
    ] as never);

    const { GET } = await import("@/app/api/insights/taste-profile/route");

    const req = {
      headers: {
        get: (name: string) => (name === "cookie" ? "sid=test-user-id" : null),
      },
    } as unknown as Request;

    const res = await GET(req as never);
    const body = await (res as Response).json();

    expect((res as Response).status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data).toEqual(
      expect.objectContaining({
        generatedAt: expect.any(String),
        window: expect.objectContaining({ days: 90 }),
        totals: expect.objectContaining({ plays: 2 }),
        audio: expect.objectContaining({ averageEnergy: 0.7, averageValence: 0.5 }),
      })
    );
    expect(body.data.topGenres.map((g: { label: string }) => g.label)).toEqual(
      expect.arrayContaining(["electronic", "reggaeton"])
    );
  });
});
