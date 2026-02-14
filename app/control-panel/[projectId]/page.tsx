import { notFound } from "next/navigation";

import { ProjectDetailClient } from "@/src/components/control-panel/ProjectDetailClient";
import { readProjectRegistry } from "@/src/lib/control-panel/projects-registry";
import { t } from "@/src/lib/i18n";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ projectId: string }>;
};

export default async function ControlPanelProjectPage({ params }: Params) {
  const { projectId } = await params;
  const registry = await readProjectRegistry();
  const project = registry.projects.find((item) => item.project === projectId);

  if (!project) {
    notFound();
  }

  const tickets = registry.tickets.filter((ticket) => ticket.project === projectId);

  return (
    <ProjectDetailClient
      projectId={projectId}
      projectName={project.project.replace(/-/g, " ")}
      urls={project.urls}
      initialTickets={tickets}
      labels={{
        back: t("controlPanel.detail.back"),
        subtitle: t("controlPanel.detail.subtitle"),
        urlPanel: t("controlPanel.detail.urlPanel"),
        noUrls: t("controlPanel.urls.empty"),
        copy: t("controlPanel.actions.copyUrl"),
        copied: t("controlPanel.actions.copied"),
        open: t("controlPanel.actions.open"),
        runtime: t("controlPanel.detail.runtime"),
        status: t("controlPanel.detail.status"),
        runtimeUnknown: t("controlPanel.health.unknown"),
        lastAction: t("controlPanel.detail.lastAction"),
        start: t("controlPanel.actions.start"),
        stop: t("controlPanel.actions.stop"),
        restart: t("controlPanel.actions.restart"),
        runningAction: t("controlPanel.actions.running"),
        tasksTitle: t("controlPanel.detail.tasksTitle"),
        logsTitle: t("controlPanel.detail.logsTitle"),
        logsHint: t("controlPanel.detail.logsHint"),
        logsEmpty: t("controlPanel.detail.logsEmpty"),
        loadError: t("controlPanel.detail.loadError"),
        queueLabels: {
          backlog: t("controlPanel.queue.backlog"),
          inProgress: t("controlPanel.queue.inProgress"),
          done: t("controlPanel.queue.done"),
        },
      }}
    />
  );
}
