import { NextResponse } from "next/server";
import { ConfigError, getPrediction, videoUrl } from "@/lib/replicate";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9]+$/i.test(id)) return NextResponse.json({ error: "Invalid id." }, { status: 400 });

  try {
    const p = await getPrediction(id);
    return NextResponse.json({
      id: p.id,
      status: p.status,
      url: p.status === "succeeded" ? videoUrl(p) : null,
      error: p.error ?? null,
    });
  } catch (err) {
    const status = err instanceof ConfigError ? 500 : 502;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
