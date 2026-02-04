import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/src/lib/db/prisma";

export async function POST() {
  try {
    // Get userId from sid cookie
    const cookieStore = await cookies();
    const userId = cookieStore.get("sid")?.value;

    // Delete or expire the Spotify token if user exists
    if (userId) {
      await prisma.spotifyToken.deleteMany({
        where: { userId },
      });
      console.log("[/api/auth/logout] Spotify token deleted for user:", userId);
    }

    // Redirect to home after clearing cookies
    const res = NextResponse.redirect(new URL("/", process.env.APP_URL || "http://localhost:3000"));
    
    // Clear all session/auth cookies
    res.cookies.delete("sid");
    res.cookies.delete("oauth_state");
    
    res.cookies.set("sid", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    
    res.cookies.set("oauth_state", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    
    console.log("[/api/auth/logout] All session cookies cleared, redirecting to home");
    return res;
  } catch (err) {
    console.error("[/api/auth/logout] error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
