import { NextResponse } from "next/server";

import { readProjectRegistry } from "@/src/lib/control-panel/projects-registry";

export async function GET() {
  try {
    const registry = await readProjectRegistry();

    return NextResponse.json(
      {
        ok: true,
        generatedAt: new Date().toISOString(),
        ...registry,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to read project registry",
        details: message,
      },
      { status: 500 },
    );
  }
}
