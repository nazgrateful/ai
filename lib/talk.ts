// Real lip-sync: animates a photo of a person so they speak the given audio,
// using the free MoDA talking-head model on Hugging Face.
// MoDA reserves 180 seconds of GPU time per video, more than the 120 seconds
// Hugging Face allows visitors without an account, so it needs a free
// Hugging Face token (5 minutes a day: one talking video).

import { Client, handle_file } from "@gradio/client";

const SPACE = "multimodalart/MoDA-fast-talking-head";

export const EMOTIONS = ["None", "Neutral", "Happiness", "Surprise", "Sadness", "Anger", "Contempt", "Disgust", "Fear"];

export async function lipSync(opts: {
  photo: string; // data URI
  audio: Blob;
  emotion: string;
  token: string;
}): Promise<string> {
  try {
    const app = await Client.connect(SPACE, { token: opts.token as `hf_${string}` });
    const photo = await (await fetch(opts.photo)).blob();
    const r = await app.predict("/generate_motion", {
      source_image_path: handle_file(photo),
      driving_audio_path: handle_file(opts.audio),
      emotion_name: opts.emotion,
      cfg_scale: 1.2,
    });
    const first = (r.data as Array<{ url?: string; video?: { url?: string } }>)[0];
    const url = first?.video?.url ?? first?.url;
    if (!url) throw new Error("The model finished but returned no video.");
    return url;
  } catch (err) {
    const msg = (err as Error)?.message ?? String(err);
    if (/quota/i.test(msg)) {
      throw new Error(
        "You've used today's free GPU time on your Hugging Face account (one talking video a day). " +
          "It refills 24 hours after you first used it. Use Voiceover mode in the meantime.",
      );
    }
    if (/token|unauthori[sz]ed|401|403/i.test(msg)) {
      throw new Error("Your Hugging Face token wasn't accepted. Check it in Settings (it should start with hf_).");
    }
    if (/abort|timeout|duration/i.test(msg)) {
      throw new Error("The talking video took too long and was stopped. Try a shorter script.");
    }
    throw new Error(`Lip-sync failed: ${msg}`);
  }
}
