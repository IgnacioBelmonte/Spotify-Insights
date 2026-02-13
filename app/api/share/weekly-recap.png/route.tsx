import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getWeeklyRecapData } from "@/src/lib/share/weekly-recap.service";
import { t } from "@/src/lib/i18n";

export const runtime = "edge";

function extractUserIdFromSession(req: NextRequest): string | null {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(/(?:^|;\s*)sid=([^;]+)/);
  return match?.[1] ?? null;
}

function getLanguage(req: NextRequest): "en" | "es" {
  const acceptLanguage = req.headers.get("accept-language")?.toLowerCase() ?? "";
  return acceptLanguage.includes("es") ? "es" : "en";
}

export async function GET(req: NextRequest) {
  try {
    const userId = extractUserIdFromSession(req);

    if (!userId) {
      return new Response(JSON.stringify({ ok: false, error: t("errors.unauthorized") }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    const lang = getLanguage(req);
    const data = await getWeeklyRecapData(userId);

    const labels = {
      title: lang === "es" ? "Resumen semanal" : "Weekly Recap",
      discovery: lang === "es" ? "Puntuación de descubrimiento" : "Discovery score",
      topArtists: lang === "es" ? "Top artistas" : "Top artists",
      topTracks: lang === "es" ? "Top canciones" : "Top tracks",
    };

    return new ImageResponse(
      (
        <div
          style={{
            width: "1200px",
            height: "630px",
            display: "flex",
            flexDirection: "column",
            background: "linear-gradient(135deg, #0d1117 0%, #1f2937 100%)",
            color: "#ffffff",
            padding: "44px",
            fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1 style={{ fontSize: 56, margin: 0, fontWeight: 700 }}>{labels.title}</h1>
            <span style={{ fontSize: 24, opacity: 0.9 }}>{data.timeWindow.label}</span>
          </div>

          <div
            style={{
              marginTop: 20,
              background: "rgba(255,255,255,0.08)",
              borderRadius: 16,
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 24, opacity: 0.85 }}>{labels.discovery}</span>
            <strong style={{ fontSize: 34 }}>{data.discoveryScore}/100</strong>
          </div>

          <div style={{ marginTop: 26, display: "flex", gap: 24, flex: 1 }}>
            <div
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.06)",
                borderRadius: 20,
                padding: 24,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <h2 style={{ margin: 0, fontSize: 30 }}>{labels.topArtists}</h2>
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                {data.topArtists.map((artist, index) => (
                  <div key={artist.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 24 }}>
                    <span>
                      {index + 1}. {artist.name}
                    </span>
                    <strong>{artist.playCount}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.06)",
                borderRadius: 20,
                padding: 24,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <h2 style={{ margin: 0, fontSize: 30 }}>{labels.topTracks}</h2>
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                {data.topTracks.map((track, index) => (
                  <div key={track.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 22, gap: 12 }}>
                    <span style={{ maxWidth: 450 }}>
                      {index + 1}. {track.name} — {track.artistName}
                    </span>
                    <strong>{track.playCount}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("[/api/share/weekly-recap.png] Error:", error);

    return new Response(
      JSON.stringify({
        ok: false,
        error: t("errors.fetchInsights"),
        ...(process.env.NODE_ENV === "development" && {
          details: error instanceof Error ? error.message : String(error),
        }),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
