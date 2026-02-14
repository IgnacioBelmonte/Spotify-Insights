import { describe, expect, it } from "@jest/globals";

import { __private__ } from "@/src/lib/control-panel/log-stream";

describe("control-panel log stream helpers", () => {
  it("bounds tail values", () => {
    expect(__private__.sanitizeTail(undefined)).toBe(120);
    expect(__private__.sanitizeTail(0)).toBe(1);
    expect(__private__.sanitizeTail(9999)).toBe(500);
    expect(__private__.sanitizeTail(75)).toBe(75);
  });

  it("parses last-event-id into ISO date", () => {
    expect(__private__.parseSince("1700000000000")).toBe("2023-11-14T22:13:20.000Z");
    expect(__private__.parseSince("bad")).toBeNull();
  });

  it("redacts sensitive tokens and credentials", () => {
    const line = "Authorization: Bearer abc123 token=xyz password=hunter2 ghp_abcdefghijklmnopqrstuvwxyz";
    const output = __private__.redactSecrets(line);

    expect(output).toContain("Authorization: Bearer <redacted>");
    expect(output).toContain("token=<redacted>");
    expect(output).toContain("password=<redacted>");
    expect(output).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz");
  });
});
