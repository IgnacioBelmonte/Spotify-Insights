import { cookies } from "next/headers";
import { prisma } from "@/src/lib/db/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserMenu } from "@/src/components/UserMenu";
import { WeeklyRecapCard } from "@/src/components/share/WeeklyRecapCard";
import { t } from "@/src/lib/i18n";

export const dynamic = "force-dynamic";

export default async function SharePage() {
  const sid = (await cookies()).get("sid")?.value;
  if (!sid) redirect("/");

  const user = await prisma.user.findUnique({ where: { id: sid } });
  if (!user) redirect("/");

  return (
    <main className="min-h-screen bg-[#050b10] text-[#e6f3f1] relative overflow-hidden" suppressHydrationWarning>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(29,214,167,0.14),_transparent_55%)]" />
      <div className="relative mx-auto max-w-6xl px-6 py-6 space-y-6">
        <header className="bg-[#0f1b24]/85 border border-[#1b3a40] p-4 rounded-2xl backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full border border-[#1c4d4f] bg-[#0b1820] px-4 py-2 text-sm font-semibold text-white"
              >
                ← {t("share.recap.backToDashboard")}
              </Link>
              <h1 className="text-xl font-semibold text-white">{t("share.recap.pageTitle")}</h1>
            </div>
            <UserMenu displayName={user.displayName} imageUrl={user.imageUrl} isPremium={user.isPremium} />
          </div>
        </header>

        <WeeklyRecapCard />
      </div>
    </main>
  );
}
