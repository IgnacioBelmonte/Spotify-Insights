import { cookies } from "next/headers";
import { prisma } from "@/src/lib/db/prisma";
import { redirect } from "next/navigation";
import { UserMenu } from "@/src/components/UserMenu";
import { InsightsOverview } from "@/src/components/InsightsOverview";
import { DeployedBadge } from "@/src/components/DeployedBadge";
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
      <header className="sticky top-0 z-40 border-b border-[#1b3a40] bg-[#0f1b24]/85 p-3 backdrop-blur sm:p-4" suppressHydrationWarning>
        <div className="mx-auto flex max-w-6xl flex-col gap-3" suppressHydrationWarning>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#1c4d4f] bg-[#0b1820] px-3 py-2 text-lg font-extrabold tracking-tight text-white shadow-lg shadow-emerald-500/10 transition hover:border-[#2d6a6a] hover:bg-[#0d1f29] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1dd6a7]/60 sm:w-auto sm:justify-start sm:gap-3 sm:px-4 sm:text-2xl md:text-3xl"
              aria-label={t("dashboard.backToLobbyAria")}
            >
              <Image
                src="/spotify-insights-logo.svg"
                alt={t("common.logoAlt")}
                width={32}
                height={32}
                className="rounded-xl sm:h-9 sm:w-9"
              />
              <span className="text-[#9ef3d4]">{t("common.brandSpotify")}</span>
              <span className="hidden sm:inline">{t("common.brandInsights")}</span>
            </Link>

            <div className="flex items-center justify-center gap-2 sm:justify-end">
              <DeployedBadge />
              <UserMenu displayName={user.displayName} imageUrl={user.imageUrl} isPremium={user.isPremium} />
            </div>
          </div>

          <nav className="flex items-center gap-2 overflow-x-auto pb-1 sm:justify-start" aria-label="Dashboard shortcuts">
            <Link
              href="/share"
              className="whitespace-nowrap inline-flex items-center rounded-full border border-[#2f6164] bg-[#11323a] px-3 py-2 text-xs font-semibold text-[#dff7f2] transition hover:bg-[#18444f] sm:text-sm"
            >
              {t("dashboard.weeklyRecapCta")}
            </Link>
            <Link
              href="/taste-profile"
              className="whitespace-nowrap inline-flex items-center rounded-full border border-[#30576f] bg-[#122c3f] px-3 py-2 text-xs font-semibold text-[#dbeafe] transition hover:bg-[#17364d] sm:text-sm"
            >
              {t("dashboard.tasteProfileCta")}
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <InsightsOverview isPremium={user.isPremium} />
    </>
  );
}
