import { NextRequest } from "next/server";

import { createProjectLogStream } from "@/src/lib/control-panel/log-stream";

type Params = {
  params: Promise<{ projectId: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  const { projectId } = await params;

  const url = new URL(request.url);
  const tail = Number(url.searchParams.get("tail") ?? "120");
  const follow = (url.searchParams.get("follow") ?? "true") === "true";
  const service = url.searchParams.get("service") ?? undefined;
  const environment = url.searchParams.get("env") ?? "dev";

  return createProjectLogStream({
    projectId,
    tail,
    follow,
    service,
    environment,
    lastEventId: request.headers.get("last-event-id"),
  });
}
