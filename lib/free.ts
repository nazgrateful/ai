// Runs in the visitor's browser: calls free Hugging Face Spaces directly with
// the Gradio client. No account or token is needed; Hugging Face gives each
// visitor a small anonymous daily GPU allowance.

import { Client, handle_file } from "@gradio/client";
import type { VideoModel } from "./models";

const SIZES: Record<string, [number, number]> = {
  // [width, height], multiples of 32 as LTX requires
  "16:9": [768, 448],
  "9:16": [448, 768],
  "1:1": [576, 576],
};

async function dataUriToBlob(dataUri: string): Promise<Blob> {
  return (await fetch(dataUri)).blob();
}

type FileData = { url?: string } | { video?: { url?: string } };

function extractUrl(data: unknown): string | null {
  const first = Array.isArray(data) ? (data[0] as FileData | undefined) : undefined;
  if (!first) return null;
  if ("video" in first && first.video?.url) return first.video.url;
  if ("url" in first && first.url) return first.url;
  return null;
}

function friendlyError(err: unknown): string {
  const msg = (err as { message?: string })?.message ?? String(err);
  if (/quota/i.test(msg)) {
    const wait = msg.match(/Try again in ([0-9:]+)/)?.[1];
    return (
      "You've used today's free GPU time." +
      (wait && wait !== "0:00:00" ? ` It refills in about ${wait}.` : " It refills over the next day.") +
      " Shorter clips use less of it."
    );
  }
  if (/sleeping|paused|building|runtime_error|could not resolve|failed to fetch/i.test(msg)) {
    return "This free model is offline or waking up right now. Try again in a few minutes, or switch models.";
  }
  return msg || "Something went wrong. Please try again.";
}

export async function generateFree(
  model: VideoModel,
  opts: { prompt: string; negativePrompt: string; aspectRatio?: string; duration: number; image?: string | null },
): Promise<string> {
  try {
    const app = await Client.connect(model.space);
    const image = opts.image ? handle_file(await dataUriToBlob(opts.image)) : null;

    let result;
    if (model.id === "wan-2.2") {
      if (!image) throw new Error("Wan 2.2 needs a starting photo. Add one, or pick LTX-Video for text-only.");
      result = await app.predict("/generate_video", {
        input_image: image,
        prompt: opts.prompt,
        steps: 6,
        negative_prompt: opts.negativePrompt,
        duration_seconds: opts.duration,
        guidance_scale: 1,
        guidance_scale_2: 1,
        seed: 42,
        randomize_seed: true,
      });
    } else {
      const [width, height] = SIZES[opts.aspectRatio ?? "16:9"] ?? SIZES["16:9"];
      result = await app.predict(image ? "/image_to_video" : "/text_to_video", {
        prompt: opts.prompt,
        negative_prompt: opts.negativePrompt,
        input_image_filepath: image,
        input_video_filepath: null,
        height_ui: height,
        width_ui: width,
        mode: image ? "image-to-video" : "text-to-video",
        duration_ui: opts.duration,
        ui_frames_to_use: 9,
        seed_ui: 42,
        randomize_seed: true,
        ui_guidance_scale: 1,
        improve_texture_flag: true,
      });
    }

    const url = extractUrl(result.data);
    if (!url) throw new Error("The model finished but returned no video. Please try again.");
    return url;
  } catch (err) {
    throw new Error(friendlyError(err));
  }
}
