import { cookies } from "next/headers";
import { prisma } from "@/src/lib/db/prisma";
import { redirect } from "next/navigation";

export default async function Dashboard() {
  const sid = (await cookies()).get("sid")?.value;
  if (!sid) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: sid } });
  if (!user) redirect("/login");

  return (
    <main style={{ padding: 24 }}>
      <h1>Dashboard</h1>
      <p>Hola, {user.displayName ?? "usuario"}</p>
      <pre>{JSON.stringify(user, null, 2)}</pre>
      <form action="/api/sync/recently-played">
        <button type="submit">Sync recently played</button>
      </form>
    </main>
  );
}
