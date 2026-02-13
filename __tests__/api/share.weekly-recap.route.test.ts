import { describe, it, expect } from "@jest/globals";

describe("API Route - /api/share/weekly-recap", () => {
  it("returns 401 when session cookie is missing", async () => {
    const { GET } = await import("@/app/api/share/weekly-recap/route");

    const req = {
      headers: { get: () => null },
    } as unknown as Request;

    const res = await GET(req as never);
    const body = await (res as Response).json();

    expect((res as Response).status).toBe(401);
    expect(body).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.any(String),
      })
    );
  });

  it("returns weekly recap payload for authenticated user", async () => {
    const { GET } = await import("@/app/api/share/weekly-recap/route");

    const req = {
      headers: {
        get: (name: string) => (name === "cookie" ? "sid=test-user-id" : null),
      },
    } as unknown as Request;

    const res = await GET(req as never);
    const body = await (res as Response).json();

    expect((res as Response).status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.topArtists).toHaveLength(5);
    expect(body.data.topTracks).toHaveLength(5);
    expect(body.data).toEqual(
      expect.objectContaining({
        discoveryScore: expect.any(Number),
        timeWindow: expect.objectContaining({
          from: expect.any(String),
          to: expect.any(String),
          label: expect.any(String),
        }),
      })
    );
  });
});
