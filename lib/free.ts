// Free video generation on Hugging Face Spaces (ZeroGPU) via the Gradio client.
// Each Hugging Face account gets a daily GPU allowance; set HF_TOKEN (a free
// "Read" token) so the site uses your account's allowance instead of the
// tiny anonymous one shared by your host's IP address.

import { Client, handle_file } from "@gradio/client";
import type { VideoModel } from "./models";

const SIZES: Record<string, [number, number]> = {
  // [width, height], multiples of 32 as LTX requires
  "16:9": [768, 448],
  "9:16": [448, 768],
  "1:1": [576, 576],
};

export class QuotaError extends Error {}

function dataUriToBlob(dataUri: string): Blob {
  const [head, b64] = dataUri.split(",", 2);
  const mime = head.match(/^data:([^;]+)/)?.[1] ?? "image/jpeg";
  return new Blob([Buffer.from(b64, "base64")], { type: mime });
}

type FileData = { url?: string; path?: string } | { video?: { url?: string } };

function extractUrl(data: unknown): string | null {
  const first = Array.isArray(data) ? (data[0] as FileData | undefined) : undefined;
  if (!first) return null;
  if ("video" in first && first.video?.url) return first.video.url;
  if ("url" in first && first.url) return first.url;
  return null;
}

export async function generateFree(
  model: VideoModel,
  opts: { prompt: string; negativePrompt: string; aspectRatio?: string; duration?: number; image?: string | null },
): Promise<string> {
  const token = process.env.HF_TOKEN as `hf_${string}` | undefined;
  const app = await Client.connect(model.space!, token ? { token } : {});
  const image = opts.image ? handle_file(dataUriToBlob(opts.image)) : null;
  const duration = opts.duration ?? 3;

  let result;
  try {
    if (model.id === "free/wan-2.2") {
      if (!image) throw new Error("Wan 2.2 needs a starting photo. Add one, or pick LTX-Video for text-only.");
      result = await app.predict("/generate_video", {
        input_image: image,
        prompt: opts.prompt,
        steps: 6,
        negative_prompt: opts.negativePrompt,
        duration_seconds: duration,
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
        duration_ui: duration,
        ui_frames_to_use: 9,
        seed_ui: 42,
        randomize_seed: true,
        ui_guidance_scale: 1,
        improve_texture_flag: true,
      });
    }
  } catch (err) {
    const msg = (err as { message?: string }).message ?? String(err);
    if (/quota/i.test(msg)) {
      throw new QuotaError(
        token
          ? "Today's free GPU allowance is used up. It refills over the next day. Try again later, or pick a shorter clip."
          : "The free anonymous GPU allowance is used up. Add a free Hugging Face token (HF_TOKEN) to get your own daily allowance.",
      );
    }
    throw new Error(`Free model error: ${msg}`);
  }

  const url = extractUrl(result.data);
  if (!url) throw new Error("The free model finished but returned no video. Please try again.");
  return url;
}
