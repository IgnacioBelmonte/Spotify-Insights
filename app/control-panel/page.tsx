import { readProjectRegistry } from "@/src/lib/control-panel/projects-registry";
import { t } from "@/src/lib/i18n";
import { ProjectCard } from "@/src/components/control-panel/ProjectCard";

type Health = "up" | "degraded" | "down" | "unknown";

function resolveHealth(value: string): Health {
  if (value === "up" || value === "degraded" || value === "down") return value;
  return "unknown";
}

function healthLabel(health: Health): string {
  if (health === "up") return t("controlPanel.health.up");
  if (health === "degraded") return t("controlPanel.health.degraded");
  if (health === "down") return t("controlPanel.health.down");
  return t("controlPanel.health.unknown");
}

export const dynamic = "force-dynamic";

export default async function ControlPanelPage() {
  const registry = await readProjectRegistry();

  return (
    <main className="min-h-screen bg-[#081117] px-4 py-6 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <p className="mb-2 inline-flex rounded-full border border-[#2f6164] bg-[#11323a] px-3 py-1 text-xs font-semibold text-[#dff7f2]">
            {t("controlPanel.badge")}
          </p>
          <h1 className="text-2xl font-bold text-[#edfff9] sm:text-3xl">{t("controlPanel.title")}</h1>
          <p className="mt-1 text-sm text-[#a8c5cd]">{t("controlPanel.subtitle")}</p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {registry.projects.map((project) => {
            const health = resolveHealth(project.health);

            return (
              <ProjectCard
                key={project.project}
                project={project.project}
                urls={project.urls}
                health={health}
                healthLabel={healthLabel(health)}
                tasksCount={project.total}
                activityCount={project.counts.inProgress}
                labels={{
                  copy: t("controlPanel.actions.copyUrl"),
                  copied: t("controlPanel.actions.copied"),
                  open: t("controlPanel.actions.open"),
                  openProject: t("controlPanel.actions.openProject"),
                  noUrls: t("controlPanel.urls.empty"),
                  tasks: t("controlPanel.counters.tasks"),
                  activity: t("controlPanel.counters.activity"),
                }}
              />
            );
          })}
        </section>
      </div>
    </main>
  );
}
