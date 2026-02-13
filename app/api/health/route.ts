import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      ok: true,
      service: "spotify-insights",
      db: "connected",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? "unknown",
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        service: "spotify-insights",
        db: "disconnected",
        error: "Database unavailable",
      },
      { status: 503 }
    );
  }
}
