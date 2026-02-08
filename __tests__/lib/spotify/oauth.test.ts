import { describe, it, expect } from "@jest/globals";
import { makeSpotifyAuthUrl, makeState, SPOTIFY_SCOPES } from "@/src/lib/spotify/oauth";

describe("oauth.ts", () => {
  describe("makeState", () => {
    it("should generate a random state string", () => {
      const state1 = makeState();
      const state2 = makeState();

      expect(state1).toBeDefined();
      expect(state2).toBeDefined();
      expect(state1).not.toBe(state2);
      expect(state1.length).toBeGreaterThan(0);
      expect(state2.length).toBeGreaterThan(0);
    });

    it("should generate hex strings", () => {
      const state = makeState();
      expect(state).toMatch(/^[a-f0-9]+$/i);
    });
  });

  describe("makeSpotifyAuthUrl", () => {
    it("should generate a valid Spotify OAuth URL", () => {
      const state = makeState();
      const url = makeSpotifyAuthUrl(state);

      expect(url).toContain("https://accounts.spotify.com/authorize");
      expect(url).toContain(`response_type=code`);
      expect(url).toContain(`client_id=${process.env.SPOTIFY_CLIENT_ID}`);
      // Accept either %20 or + for encoded spaces in the scope parameter
      expect(url).toMatch(/scope=user-read-email[+%20]user-read-private/);
      expect(url).toContain(`state=${state}`);
      expect(url).toContain(`redirect_uri=${encodeURIComponent(process.env.SPOTIFY_REDIRECT_URI!)}`);
    });

    it("should include all required scopes", () => {
      const state = makeState();
      const url = makeSpotifyAuthUrl(state);

      expect(url).toContain("user-read-email");
      expect(url).toContain("user-read-private");
      expect(url).toContain("user-top-read");
      expect(url).toContain("user-read-recently-played");
      expect(url).toContain("streaming");
      expect(url).toContain("user-read-playback-state");
      expect(url).toContain("user-read-currently-playing");
      expect(url).toContain("user-modify-playback-state");
    });

    it("should set show_dialog to false", () => {
      const state = makeState();
      const url = makeSpotifyAuthUrl(state);

      expect(url).toContain("show_dialog=false");
    });
  });

  describe("SPOTIFY_SCOPES", () => {
    it("should be a space-separated string", () => {
      expect(SPOTIFY_SCOPES).toContain(" ");
      const scopes = SPOTIFY_SCOPES.split(" ");
      expect(scopes.length).toBeGreaterThan(0);
    });
  });
});
