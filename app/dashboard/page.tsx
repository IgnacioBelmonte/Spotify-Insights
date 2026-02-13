import { cookies } from "next/headers";
import { prisma } from "@/src/lib/db/prisma";
import { redirect } from "next/navigation";
import { UserMenu } from "@/src/components/UserMenu";
import { InsightsOverview } from "@/src/components/InsightsOverview";
import Link from "next/link";
import Image from "next/image";
import { t } from "@/src/lib/i18n";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const sid = (await cookies()).get("sid")?.value;
  if (!sid) redirect("/");

  const user = await prisma.user.findUnique({ where: { id: sid } });
  if (!user) redirect("/");

  return (
    <>
      {/* Header with UserMenu */}
      <header className="bg-[#0f1b24]/85 border-b border-[#1b3a40] p-4 sticky top-0 z-40 backdrop-blur" suppressHydrationWarning>
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3" suppressHydrationWarning>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-3 rounded-2xl border border-[#1c4d4f] bg-[#0b1820] px-4 py-2 text-2xl md:text-3xl font-extrabold tracking-tight text-white shadow-lg shadow-emerald-500/10 transition hover:scale-[1.02] hover:border-[#2d6a6a] hover:bg-[#0d1f29] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1dd6a7]/60"
              aria-label={t("dashboard.backToLobbyAria")}
            >
              <Image
                src="/spotify-insights-logo.svg"
                alt={t("common.logoAlt")}
                width={36}
                height={36}
                className="rounded-xl"
              />
              <span className="text-[#9ef3d4]">{t("common.brandSpotify")}</span>
              <span>{t("common.brandInsights")}</span>
            </Link>
            <div className="flex items-center gap-2">
              <Link
                href="/share"
                className="inline-flex items-center rounded-full border border-[#2f6164] bg-[#11323a] px-3 py-2 text-xs sm:text-sm font-semibold text-[#dff7f2] transition hover:bg-[#18444f]"
              >
                {t("dashboard.weeklyRecapCta")}
              </Link>
              <Link
                href="/taste-profile"
                className="inline-flex items-center rounded-full border border-[#30576f] bg-[#122c3f] px-3 py-2 text-xs sm:text-sm font-semibold text-[#dbeafe] transition hover:bg-[#17364d]"
              >
                {t("dashboard.tasteProfileCta")}
              </Link>
            </div>
          </div>
          <UserMenu
            displayName={user.displayName}
            imageUrl={user.imageUrl}
            isPremium={user.isPremium}
          />
        </div>
      </header>

      {/* Main Content */}
      <InsightsOverview isPremium={user.isPremium} />
    </>
  );
}
