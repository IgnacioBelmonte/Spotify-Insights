import { describe, expect, it, jest, afterEach } from "@jest/globals";

jest.mock("@/src/lib/control-panel/projects-registry", () => ({
  readProjectRegistry: jest.fn(),
}));

const { readProjectRegistry } = jest.requireMock("@/src/lib/control-panel/projects-registry") as {
  readProjectRegistry: jest.Mock;
};

afterEach(() => {
  jest.resetAllMocks();
});

describe("API Route - /api/control-panel/projects", () => {
  it("returns project summaries", async () => {
    readProjectRegistry.mockResolvedValueOnce({
      projects: [
        {
          project: "spotify-insights",
          counts: { backlog: 0, inProgress: 1, done: 2 },
          total: 3,
          urls: ["http://localhost:3001"],
          health: "unknown",
        },
      ],
      tickets: [],
    });

    const { GET } = await import("@/app/api/control-panel/projects/route");
    const res = (await GET()) as Response;
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.projects)).toBe(true);
    expect(body.generatedAt).toBeDefined();
  });

  it("returns 500 on errors", async () => {
    readProjectRegistry.mockRejectedValueOnce(new Error("boom"));

    const { GET } = await import("@/app/api/control-panel/projects/route");
    const res = (await GET()) as Response;
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("Failed to read project registry");
  });
});
