export function isSpotifyPremiumProduct(product?: string | null): boolean {
  return product?.toLowerCase() === "premium";
}

