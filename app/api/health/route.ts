import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db/prisma";

export async function GET() {
  // upsert de prueba (no definitivo, solo para validar DB)
  const user = await prisma.user.upsert({
    where: { spotifyUserId: "test_user" },
    update: { displayName: "Test User" },
    create: { spotifyUserId: "test_user", displayName: "Test User" },
  });

  return NextResponse.json({
    ok: true,
    db: "connected",
    userId: user.id,
  });
}