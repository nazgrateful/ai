// Free video models running on Hugging Face's free GPUs (ZeroGPU Spaces).
// The visitor's browser calls them directly, so there are no accounts, keys
// or servers to pay for. Each visitor gets a small daily GPU allowance.

export type VideoModel = {
  id: string;
  label: string;
  blurb: string;
  space: string; // Hugging Face Space
  aspectRatios?: string[];
  durations: number[]; // seconds
  requiresImage?: boolean;
};

export const MODELS: VideoModel[] = [
  {
    id: "ltx-video",
    label: "LTX-Video",
    blurb: "Text or photo to video. Uses the whole free daily allowance, so about 1 clip per day.",
    space: "Lightricks/ltx-video-distilled",
    aspectRatios: ["16:9", "9:16", "1:1"],
    durations: [2, 3, 5],
  },
  {
    id: "wan-2.2",
    label: "Wan 2.2 (needs a photo)",
    blurb: "The most realistic free model, and the lightest: about 3–5 clips per day. Brings a photo of a person to life.",
    space: "zerogpu-aoti/wan2-2-fp8da-aoti-faster",
    durations: [2, 3, 5],
    requiresImage: true,
  },
];

export function getModel(id: string): VideoModel | undefined {
  return MODELS.find((m) => m.id === id);
}
