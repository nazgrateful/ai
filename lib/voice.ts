// Free text-to-speech using Microsoft Edge neural voices, served by a public
// Hugging Face Space that runs on CPU, so it uses none of the visitor's daily
// GPU allowance and works for any length of script.

import { Client } from "@gradio/client";

const SPACE = "innoai/Edge-TTS-Text-to-Speech";

export const VOICES: { id: string; label: string }[] = [
  { id: "en-US-AvaNeural - en-US (Female)", label: "Ava (US, female, warm)" },
  { id: "en-US-EmmaNeural - en-US (Female)", label: "Emma (US, female, bright)" },
  { id: "en-US-AriaNeural - en-US (Female)", label: "Aria (US, female, confident)" },
  { id: "en-US-JennyNeural - en-US (Female)", label: "Jenny (US, female, friendly)" },
  { id: "en-US-MichelleNeural - en-US (Female)", label: "Michelle (US, female, calm)" },
  { id: "en-GB-SoniaNeural - en-GB (Female)", label: "Sonia (UK, female)" },
  { id: "en-GB-LibbyNeural - en-GB (Female)", label: "Libby (UK, female)" },
  { id: "en-AU-NatashaNeural - en-AU (Female)", label: "Natasha (Australia, female)" },
  { id: "en-US-AndrewNeural - en-US (Male)", label: "Andrew (US, male, warm)" },
  { id: "en-US-BrianNeural - en-US (Male)", label: "Brian (US, male, casual)" },
  { id: "en-US-ChristopherNeural - en-US (Male)", label: "Christopher (US, male, deep)" },
  { id: "en-US-GuyNeural - en-US (Male)", label: "Guy (US, male, energetic)" },
  { id: "en-US-RogerNeural - en-US (Male)", label: "Roger (US, male, mature)" },
  { id: "en-GB-RyanNeural - en-GB (Male)", label: "Ryan (UK, male)" },
  { id: "en-GB-ThomasNeural - en-GB (Male)", label: "Thomas (UK, male)" },
];

export const MAX_SCRIPT_CHARS = 1500; // roughly 90 seconds of speech

export async function generateVoice(text: string, voice: string, rate = 0, pitch = 0): Promise<Blob> {
  try {
    const app = await Client.connect(SPACE);
    const r = await app.predict("/tts_interface", { text, voice, rate, pitch });
    const data = r.data as [{ url?: string } | null, unknown];
    const url = data[0]?.url;
    if (!url) throw new Error("The voice service returned no audio.");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Couldn't download the voice (${res.status}).`);
    return await res.blob();
  } catch (err) {
    const msg = (err as Error)?.message ?? String(err);
    throw new Error(`Voice generation failed: ${msg}. Try again in a moment.`);
  }
}
