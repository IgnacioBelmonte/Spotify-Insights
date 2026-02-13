/* eslint-disable @typescript-eslint/no-explicit-any */
// Test utilities for Route Handler tests
export function makeReq(url: string, cookieHeader = "") {
  return {
    url,
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === "cookie") return cookieHeader;
        return null;
      },
    },
  } as unknown as Request;
}

export async function readNextResponse(res: any) {
  // NextResponse in tests exposes headers and json()/text()
  const body = res.json ? await res.json() : undefined;
  return { status: res.status ?? res.statusCode ?? 200, headers: res.headers, body };
}
