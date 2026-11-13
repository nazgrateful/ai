import { NextResponse } from "next/server";
import { getModel } from "@/lib/models";
import { NEGATIVE_PROMPT } from "@/lib/prompt";
import { ConfigError, createPrediction } from "@/lib/replicate";

type Body = {
  model: string;
  prompt: string;
  aspectRatio?: string;
  duration?: number;
  resolution?: string;
  image?: string; // data URI of an optional starting frame
  useNegative?: boolean;
};

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const model = getModel(body.model);
  if (!model) return NextResponse.json({ error: "Unknown model." }, { status: 400 });

  const prompt = (body.prompt ?? "").trim();
  if (prompt.length < 3) return NextResponse.json({ error: "Please describe your video." }, { status: 400 });
  if (prompt.length > 4000) return NextResponse.json({ error: "Prompt is too long." }, { status: 400 });

  // Only forward parameters this model understands, and only allowed values.
  const input: Record<string, unknown> = { prompt };
  if (model.aspectRatios && body.aspectRatio && model.aspectRatios.includes(body.aspectRatio)) {
    input.aspect_ratio = body.aspectRatio;
  }
  if (model.durations && body.duration && model.durations.includes(body.duration)) {
    input.duration = body.duration;
  }
  if (model.resolutions && body.resolution && model.resolutions.includes(body.resolution)) {
    input.resolution = body.resolution;
  }
  if (model.supportsNegativePrompt && body.useNegative !== false) {
    input.negative_prompt = NEGATIVE_PROMPT;
  }
  if (body.image) {
    if (!model.imageParam) {
      return NextResponse.json({ error: `${model.label} does not accept a starting image.` }, { status: 400 });
    }
    if (!/^data:image\/(png|jpe?g|webp);base64,/.test(body.image) || body.image.length > MAX_IMAGE_BYTES * 1.4) {
      return NextResponse.json({ error: "Starting image must be a PNG, JPEG or WebP under 4 MB." }, { status: 400 });
    }
    input[model.imageParam] = body.image;
  }

  try {
    const prediction = await createPrediction(model.id, input);
    return NextResponse.json({ id: prediction.id, status: prediction.status });
  } catch (err) {
    const status = err instanceof ConfigError ? 500 : 502;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
