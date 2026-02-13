import { describe, it, expect, beforeEach } from "@jest/globals";

describe("API Route - /api/insights/time-intelligence", () => {
  beforeEach(async () => {
    const { clearTimeIntelligenceCache } = await import("@/src/lib/insights/time-intelligence.service");
    clearTimeIntelligenceCache();
  });

  it("returns 401 when session cookie is missing", async () => {
    const { GET } = await import("@/app/api/insights/time-intelligence/route");

    const req = {
      headers: { get: () => null },
      url: "http://localhost/api/insights/time-intelligence",
    } as unknown as Request;

    const res = await GET(req as never);
    const body = await (res as Response).json();

    expect((res as Response).status).toBe(401);
    expect(body.ok).toBe(false);
  });

  it("returns heatmap snapshot and narrative for authenticated user", async () => {
    const { prisma } = await import("@/src/lib/db/prisma");
    prisma.listeningEvent.findMany.mockResolvedValue([
      {
        playedAt: new Date("2026-02-11T10:15:00Z"),
      },
      {
        playedAt: new Date("2026-02-11T10:45:00Z"),
      },
      {
        playedAt: new Date("2026-02-13T22:00:00Z"),
      },
    ] as never);

    const { GET } = await import("@/app/api/insights/time-intelligence/route");

    const req = {
      headers: {
        get: (name: string) => (name === "cookie" ? "sid=test-user-id" : null),
      },
      url: "http://localhost/api/insights/time-intelligence?days=30&tz=UTC",
    } as unknown as Request;

    const res = await GET(req as never);
    const body = await (res as Response).json();

    expect((res as Response).status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.window.days).toBe(30);
    expect(body.data.totals.plays).toBe(3);
    expect(body.data.heatmap).toHaveLength(168);
    expect(body.data.peak).toEqual(
      expect.objectContaining({
        weekday: 3,
        hour: 10,
        plays: 2,
      })
    );
    expect(body.data.narrative).toEqual(
      expect.objectContaining({
        en: expect.stringContaining("Wednesday around 10:00"),
        es: expect.stringContaining("miércoles sobre las 10:00"),
      })
    );
  });
});
