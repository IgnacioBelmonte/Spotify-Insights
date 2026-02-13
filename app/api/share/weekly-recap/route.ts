import { NextRequest, NextResponse } from "next/server";
import { getWeeklyRecapData } from "@/src/lib/share/weekly-recap.service";
import { t } from "@/src/lib/i18n";

function extractUserIdFromSession(req: NextRequest): string | null {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(/(?:^|;\s*)sid=([^;]+)/);
  return match?.[1] ?? null;
}

/**
 * GET /api/share/weekly-recap
 * Returns weekly recap payload for share card rendering.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = extractUserIdFromSession(req);

    if (!userId) {
      return NextResponse.json({ ok: false, error: t("errors.unauthorized") }, { status: 401 });
    }

    const data = await getWeeklyRecapData(userId);

    return NextResponse.json(
      { ok: true, data },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("[/api/share/weekly-recap] Error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: t("errors.fetchInsights"),
        ...(process.env.NODE_ENV === "development" && {
          details: error instanceof Error ? error.message : String(error),
        }),
      },
      { status: 500 }
    );
  }
}
