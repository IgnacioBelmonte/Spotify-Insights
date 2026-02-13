/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, it, expect, beforeEach, jest } from "@jest/globals";

const { prisma } = require("@/src/lib/db/prisma");

describe("API Route - /api/health", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 200 and connected status when DB is reachable", async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);

    const { GET } = await import("@/app/api/health/route");
    const res = (await GET()) as Response;
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.service).toBe("spotify-insights");
    expect(body.db).toBe("connected");
    expect(typeof body.timestamp).toBe("string");
    expect(body.version).toBeDefined();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("returns 503 and disconnected status when DB check fails", async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error("db down"));

    const { GET } = await import("@/app/api/health/route");
    const res = (await GET()) as Response;
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.service).toBe("spotify-insights");
    expect(body.db).toBe("disconnected");
    expect(body.error).toBe("Database unavailable");
  });
});
