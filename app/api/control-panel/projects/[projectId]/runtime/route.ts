import { NextRequest, NextResponse } from "next/server";

import {
  isSupportedRuntimeAction,
  runRuntimeAction,
} from "@/src/lib/control-panel/runtime-control";

type Params = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: NextRequest, { params }: Params) {
  const { projectId } = await params;

  const result = await runRuntimeAction(projectId, "status");

  return NextResponse.json(
    {
      ok: result.ok,
      data: result,
    },
    { status: result.ok ? 200 : 404 },
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { projectId } = await params;

  let action = "";

  try {
    const body = (await request.json()) as { action?: string };
    action = body.action ?? "";
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid JSON body",
      },
      { status: 400 },
    );
  }

  if (!isSupportedRuntimeAction(action) || action === "status") {
    return NextResponse.json(
      {
        ok: false,
        error: "Action must be one of: start, stop, restart",
      },
      { status: 400 },
    );
  }

  const result = await runRuntimeAction(projectId, action);

  return NextResponse.json(
    {
      ok: result.ok,
      data: result,
    },
    { status: result.ok ? 200 : 500 },
  );
}
