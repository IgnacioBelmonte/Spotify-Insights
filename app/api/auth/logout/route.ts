import { NextResponse } from "next/server";

export async function POST() {
  try {
    const res = NextResponse.json({ ok: true });
    res.cookies.set("sid", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 0,
    });
    return res;
  } catch (err) {
    console.error("[/api/auth/logout] error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
