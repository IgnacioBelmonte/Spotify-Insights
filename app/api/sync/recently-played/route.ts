import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { t } from "@/src/lib/i18n";
import { syncRecentlyPlayedForUser } from "@/src/lib/sync/recently-played-sync.service";

export async function GET() {
  try {
    const userId = (await cookies()).get("sid")?.value;
    if (!userId) {
      return NextResponse.json({ error: t("errors.unauthorized") }, { status: 401 });
    }

    const { created, syncedAt } = await syncRecentlyPlayedForUser(userId);
    return NextResponse.json({ ok: true, created, syncedAt });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : t("errors.syncFailed");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
