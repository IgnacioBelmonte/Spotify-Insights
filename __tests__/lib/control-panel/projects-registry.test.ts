import { describe, expect, it, jest, afterEach } from "@jest/globals";
import { promises as fs } from "fs";

import { readProjectRegistry } from "@/src/lib/control-panel/projects-registry";

afterEach(() => {
  jest.restoreAllMocks();
});

describe("control panel project registry", () => {
  it("normalizes legacy board items and groups project summaries", async () => {
    jest.spyOn(fs, "readFile").mockResolvedValue(
      JSON.stringify({
        project: "Spotify-Insights",
        runtime: {
          dev: {
            lanUrl: "http://192.168.31.251:3001",
            tunnelUrl: "https://example.trycloudflare.com/api?token=123",
          },
        },
        queue: {
          backlog: [
            {
              ticketId: "CTRL-BE-1",
              role: "backend",
              title: "Registry API",
              project: "control-panel",
              description: "Implement backend registry",
            },
          ],
          inProgress: [
            {
              ticketId: "T4a",
              role: "backend",
              title: "Goals API",
            },
          ],
          done: [
            {
              ticketId: "T1a",
              role: "backend",
              title: "Share endpoint",
            },
          ],
        },
      }) as never,
    );

    const result = await readProjectRegistry("/tmp/fake-board.json");

    expect(result.tickets).toHaveLength(3);
    expect(result.tickets[1]).toMatchObject({
      ticketId: "T4a",
      project: "spotify-insights",
      agent: "backend",
      status: "inProgress",
      description: "Implement ticket T4a (Goals API)",
    });

    expect(result.projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          project: "control-panel",
          counts: { backlog: 1, inProgress: 0, done: 0 },
        }),
        expect.objectContaining({
          project: "spotify-insights",
          counts: { backlog: 0, inProgress: 1, done: 1 },
          urls: [
            "http://192.168.31.251:3001",
            "https://example.trycloudflare.com/api",
          ],
        }),
      ]),
    );
  });
});
