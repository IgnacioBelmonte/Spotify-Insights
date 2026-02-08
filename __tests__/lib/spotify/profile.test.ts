import { describe, expect, it } from "@jest/globals";
import { isSpotifyPremiumProduct } from "@/src/lib/spotify/profile";

describe("spotify/profile", () => {
  it("returns true for premium product", () => {
    expect(isSpotifyPremiumProduct("premium")).toBe(true);
    expect(isSpotifyPremiumProduct("PREMIUM")).toBe(true);
  });

  it("returns false for non-premium products", () => {
    expect(isSpotifyPremiumProduct("free")).toBe(false);
    expect(isSpotifyPremiumProduct("open")).toBe(false);
    expect(isSpotifyPremiumProduct(undefined)).toBe(false);
    expect(isSpotifyPremiumProduct(null)).toBe(false);
  });
});

