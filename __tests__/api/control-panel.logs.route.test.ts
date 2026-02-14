import { afterEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("@/src/lib/control-panel/log-stream", () => ({
  createProjectLogStream: jest.fn(),
}));

const { createProjectLogStream } = jest.requireMock("@/src/lib/control-panel/log-stream") as {
  createProjectLogStream: jest.Mock;
};

afterEach(() => {
  jest.resetAllMocks();
});

describe("API Route - /api/control-panel/projects/[projectId]/logs", () => {
  it("maps query params and forwards to log stream service", async () => {
    createProjectLogStream.mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const { GET } = await import("@/app/api/control-panel/projects/[projectId]/logs/route");

    const req = new Request("http://localhost/api/control-panel/projects/spotify-insights/logs?tail=250&follow=false&service=web&env=dev", {
      method: "GET",
      headers: {
        "last-event-id": "1700000000000",
      },
    });

    const response = (await GET(req as never, {
      params: Promise.resolve({ projectId: "spotify-insights" }),
    })) as Response;

    expect(response.status).toBe(200);
    expect(createProjectLogStream).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "spotify-insights",
        tail: 250,
        follow: false,
        service: "web",
        environment: "dev",
        lastEventId: "1700000000000",
      }),
    );
  });
});
