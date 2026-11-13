// Catalogue of video models.
//
// "free" models run on Hugging Face's free GPUs (ZeroGPU) through public
// Spaces. They cost nothing, but each account gets a small daily GPU
// allowance and clips are short.
// "replicate" models are paid per video and only appear when
// REPLICATE_API_TOKEN is set on the server.

export type Provider = "free" | "replicate";

export type VideoModel = {
  id: string;
  provider: Provider;
  label: string;
  blurb: string;
  space?: string; // Hugging Face Space for free models
  aspectRatios?: string[]; // omitted = model picks its own framing
  durations?: number[]; // seconds; omitted = fixed length
  fixedDuration?: number;
  resolutions?: string[];
  imageParam?: string; // Replicate input name for an optional starting frame
  acceptsImage?: boolean;
  requiresImage?: boolean;
  supportsNegativePrompt?: boolean;
};

export const MODELS: VideoModel[] = [
  {
    id: "free/ltx-video",
    provider: "free",
    label: "LTX-Video (free)",
    blurb: "Free. Text or photo to video. Short clips, about 1 minute to render.",
    space: "Lightricks/ltx-video-distilled",
    aspectRatios: ["16:9", "9:16", "1:1"],
    durations: [3, 5],
    acceptsImage: true,
    supportsNegativePrompt: true,
  },
  {
    id: "free/wan-2.2",
    provider: "free",
    label: "Wan 2.2 (free, needs photo)",
    blurb: "Free. The most realistic free model. Brings a photo to life, so add a starting photo.",
    space: "zerogpu-aoti/wan2-2-fp8da-aoti-faster",
    durations: [3, 5],
    acceptsImage: true,
    requiresImage: true,
    supportsNegativePrompt: true,
  },
  {
    id: "google/veo-3",
    provider: "replicate",
    label: "Google Veo 3 (paid)",
    blurb: "Top-tier realism and physics, with synchronized sound and speech.",
    aspectRatios: ["16:9", "9:16"],
    fixedDuration: 8,
    resolutions: ["720p", "1080p"],
    imageParam: "image",
    acceptsImage: true,
    supportsNegativePrompt: true,
  },
  {
    id: "kwaivgi/kling-v2.1-master",
    provider: "replicate",
    label: "Kling 2.1 Master (paid)",
    blurb: "Excellent human faces, bodies and motion.",
    aspectRatios: ["16:9", "9:16", "1:1"],
    durations: [5, 10],
    imageParam: "start_image",
    acceptsImage: true,
    supportsNegativePrompt: true,
  },
  {
    id: "minimax/hailuo-02",
    provider: "replicate",
    label: "MiniMax Hailuo 02 (paid)",
    blurb: "Strong physics: water, fur, cloth and weather.",
    durations: [6, 10],
    resolutions: ["768p", "1080p"],
    imageParam: "first_frame_image",
    acceptsImage: true,
  },
  {
    id: "bytedance/seedance-1-pro",
    provider: "replicate",
    label: "Seedance 1 Pro (paid)",
    blurb: "Fast, cinematic multi-shot scenes and landscapes.",
    aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
    durations: [5, 10],
    resolutions: ["480p", "1080p"],
    imageParam: "image",
    acceptsImage: true,
  },
];

export function getModel(id: string): VideoModel | undefined {
  return MODELS.find((m) => m.id === id);
}
