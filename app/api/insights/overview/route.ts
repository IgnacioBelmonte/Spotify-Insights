import { NextRequest, NextResponse } from "next/server";
import { getInsightsOverview } from "@/src/lib/insights/insights.service";

/**
 * Extracts user ID from session cookie
 * Returns null if cookie is not present or invalid
 */
function extractUserIdFromSession(req: NextRequest): string | null {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(/(?:^|;\s*)sid=([^;]+)/);
  return match?.[1] ?? null;
}

/**
 * GET /api/insights/overview
 * Returns listening analytics for the authenticated user
 *
 * @returns {InsightsOverviewDTO} Aggregated listening insights
 */
export async function GET(req: NextRequest) {
  try {
    const userId = extractUserIdFromSession(req);

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized - no session found" },
        { status: 401 }
      );
    }

    const insights = await getInsightsOverview(userId);

    return NextResponse.json(insights, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store", // Insights data changes frequently
      },
    });
  } catch (error) {
    console.error("[/api/insights/overview] Error:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch insights",
        ...(process.env.NODE_ENV === "development" && {
          details: error instanceof Error ? error.message : String(error),
        }),
      },
      { status: 500 }
    );
  }
}
