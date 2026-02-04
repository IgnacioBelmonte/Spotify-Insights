import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/src/lib/db/prisma";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("sid")?.value;

    if (!userId) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, email: true, imageUrl: true },
    });

    return NextResponse.json({ user: user ?? null }, { status: 200 });
  } catch (err) {
    console.error("[/api/auth/session] error:", err);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
