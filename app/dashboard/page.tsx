import { cookies } from "next/headers";
import { prisma } from "@/src/lib/db/prisma";
import { redirect } from "next/navigation";
import { UserMenu } from "@/src/components/UserMenu";
import { InsightsOverview } from "@/src/components/InsightsOverview";

export default async function Dashboard() {
  const sid = (await cookies()).get("sid")?.value;
  if (!sid) redirect("/");

  const user = await prisma.user.findUnique({ where: { id: sid } });
  if (!user) redirect("/");

  return (
    <>
      {/* Header with UserMenu */}
      <header className="bg-slate-900/60 border-b border-slate-700 p-4 sticky top-0 z-40" suppressHydrationWarning>
        <div className="max-w-6xl mx-auto flex items-center justify-between" suppressHydrationWarning>
          <h1 className="text-2xl font-bold text-white">Spotify Insights</h1>
          <UserMenu
            displayName={user.displayName}
            imageUrl={user.imageUrl}
          />
        </div>
      </header>

      {/* Main Content */}
      <InsightsOverview />
    </>
  );
}
