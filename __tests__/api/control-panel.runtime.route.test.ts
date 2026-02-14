import { afterEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("@/src/lib/control-panel/runtime-control", () => ({
  isSupportedRuntimeAction: jest.fn(),
  runRuntimeAction: jest.fn(),
}));

const { isSupportedRuntimeAction, runRuntimeAction } = jest.requireMock(
  "@/src/lib/control-panel/runtime-control",
) as {
  isSupportedRuntimeAction: jest.Mock;
  runRuntimeAction: jest.Mock;
};

afterEach(() => {
  jest.resetAllMocks();
});

describe("API Route - /api/control-panel/projects/[projectId]/runtime", () => {
  it("returns runtime status on GET", async () => {
    runRuntimeAction.mockResolvedValueOnce({ ok: true, action: "status", containerState: "running" });

    const { GET } = await import("@/app/api/control-panel/projects/[projectId]/runtime/route");

    const response = (await GET({} as never, {
      params: Promise.resolve({ projectId: "spotify-insights" }),
    })) as Response;

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(runRuntimeAction).toHaveBeenCalledWith("spotify-insights", "status");
  });

  it("rejects invalid POST action", async () => {
    isSupportedRuntimeAction.mockReturnValueOnce(false);

    const { POST } = await import("@/app/api/control-panel/projects/[projectId]/runtime/route");
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ action: "destroy" }),
      headers: { "content-type": "application/json" },
    });

    const response = (await POST(request as never, {
      params: Promise.resolve({ projectId: "spotify-insights" }),
    })) as Response;

    expect(response.status).toBe(400);
    expect(runRuntimeAction).not.toHaveBeenCalled();
  });
});
