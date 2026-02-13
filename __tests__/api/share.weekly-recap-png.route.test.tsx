import { describe, it, expect, jest } from "@jest/globals";

jest.mock("next/og", () => ({
  ImageResponse: class MockImageResponse extends Response {
    constructor() {
      super(new Uint8Array([137, 80, 78, 71]), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
    }
  },
}));

describe("API Route - /api/share/weekly-recap.png", () => {
  it("returns 401 when session cookie is missing", async () => {
    const { GET } = await import("@/app/api/share/weekly-recap.png/route");

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

  it("returns non-empty image/png for authenticated user", async () => {
    const { GET } = await import("@/app/api/share/weekly-recap.png/route");

    const req = {
      headers: {
        get: (name: string) => {
          if (name === "cookie") return "sid=test-user-id";
          if (name === "accept-language") return "es-ES,es;q=0.9";
          return null;
        },
      },
    } as unknown as Request;

    const res = await GET(req as never);
    const buffer = await (res as Response).arrayBuffer();

    expect((res as Response).status).toBe(200);
    expect((res as Response).headers.get("content-type")).toContain("image/png");
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});
