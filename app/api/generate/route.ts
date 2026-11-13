import { NextResponse } from "next/server";
import { generateFree, QuotaError } from "@/lib/free";
import { getModel } from "@/lib/models";
import { NEGATIVE_PROMPT } from "@/lib/prompt";
import { ConfigError, createPrediction, hasReplicate } from "@/lib/replicate";

// Free models render inside this request, so allow the maximum time.
export const maxDuration = 300;

type Body = {
  model: string;
  prompt: string;
  aspectRatio?: string;
  duration?: number;
  resolution?: string;
  image?: string; // data URI of an optional starting frame
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

  if (body.image) {
    if (!model.acceptsImage) {
      return NextResponse.json({ error: `${model.label} does not accept a starting photo.` }, { status: 400 });
    }
    if (!/^data:image\/(png|jpe?g|webp);base64,/.test(body.image) || body.image.length > MAX_IMAGE_BYTES * 1.4) {
      return NextResponse.json({ error: "Starting photo must be a PNG, JPEG or WebP under 4 MB." }, { status: 400 });
    }
  } else if (model.requiresImage) {
    return NextResponse.json({ error: `${model.label} needs a starting photo.` }, { status: 400 });
  }

  const aspectRatio = model.aspectRatios?.includes(body.aspectRatio ?? "") ? body.aspectRatio : undefined;
  const duration = model.durations?.includes(body.duration ?? -1) ? body.duration : undefined;

  // ---- Free (Hugging Face) ----
  if (model.provider === "free") {
    try {
      const url = await generateFree(model, {
        prompt,
        negativePrompt: NEGATIVE_PROMPT,
        aspectRatio,
        duration,
        image: body.image,
      });
      return NextResponse.json({ status: "succeeded", url });
    } catch (err) {
      const status = err instanceof QuotaError ? 429 : 502;
      return NextResponse.json({ error: (err as Error).message }, { status });
    }
  }

  // ---- Paid (Replicate) ----
  if (!hasReplicate()) {
    return NextResponse.json({ error: "Paid models are turned off on this site." }, { status: 400 });
  }
  const input: Record<string, unknown> = { prompt };
  if (aspectRatio) input.aspect_ratio = aspectRatio;
  if (duration) input.duration = duration;
  if (model.resolutions && body.resolution && model.resolutions.includes(body.resolution)) {
    input.resolution = body.resolution;
  }
  if (model.supportsNegativePrompt) input.negative_prompt = NEGATIVE_PROMPT;
  if (body.image && model.imageParam) input[model.imageParam] = body.image;

  try {
    const prediction = await createPrediction(model.id, input);
    return NextResponse.json({ id: prediction.id, status: prediction.status });
  } catch (err) {
    const status = err instanceof ConfigError ? 500 : 502;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
