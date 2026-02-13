import { NextRequest, NextResponse } from "next/server";
import { t } from "@/src/lib/i18n";
import { getTimeIntelligenceSnapshot } from "@/src/lib/insights/time-intelligence.service";

function extractUserIdFromSession(req: NextRequest): string | null {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(/(?:^|;\s*)sid=([^;]+)/);
  return match?.[1] ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const userId = extractUserIdFromSession(req);

    if (!userId) {
      return NextResponse.json({ ok: false, error: t("errors.unauthorized") }, { status: 401 });
    }

    const url = new URL(req.url);
    const daysParam = Number.parseInt(url.searchParams.get("days") ?? "", 10);
    const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 365) : 90;
    const timeZone = url.searchParams.get("tz") || "UTC";

    const snapshot = await getTimeIntelligenceSnapshot(userId, { days, timeZone });

    return NextResponse.json(
      { ok: true, data: snapshot },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "private, max-age=60",
        },
      }
    );
  } catch (error) {
    console.error("[/api/insights/time-intelligence] Error:", error);

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
