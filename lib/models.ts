// Catalogue of hosted video models (served through Replicate).
// Each entry describes which inputs the model accepts so the UI only shows
// options that work, and the server only sends parameters the model knows.
// To add a model, copy an entry and adjust it to the model's Replicate schema.

export type VideoModel = {
  id: string; // Replicate "owner/name"
  label: string;
  blurb: string;
  aspectRatios?: string[]; // omitted = model picks its own framing
  durations?: number[]; // seconds; omitted = fixed length
  fixedDuration?: number;
  resolutions?: string[];
  imageParam?: string; // input name for an optional starting frame
  supportsNegativePrompt?: boolean;
  hasAudio?: boolean;
};

export const MODELS: VideoModel[] = [
  {
    id: "google/veo-3",
    label: "Google Veo 3",
    blurb: "Top-tier realism and physics, with synchronized sound and speech.",
    aspectRatios: ["16:9", "9:16"],
    fixedDuration: 8,
    resolutions: ["720p", "1080p"],
    imageParam: "image",
    supportsNegativePrompt: true,
    hasAudio: true,
  },
  {
    id: "kwaivgi/kling-v2.1-master",
    label: "Kling 2.1 Master",
    blurb: "Excellent human faces, bodies and motion.",
    aspectRatios: ["16:9", "9:16", "1:1"],
    durations: [5, 10],
    imageParam: "start_image",
    supportsNegativePrompt: true,
  },
  {
    id: "minimax/hailuo-02",
    label: "MiniMax Hailuo 02",
    blurb: "Strong physics: water, fur, cloth and weather.",
    durations: [6, 10],
    resolutions: ["768p", "1080p"],
    imageParam: "first_frame_image",
  },
  {
    id: "bytedance/seedance-1-pro",
    label: "Seedance 1 Pro",
    blurb: "Fast, cinematic multi-shot scenes and landscapes.",
    aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
    durations: [5, 10],
    resolutions: ["480p", "1080p"],
    imageParam: "image",
  },
];

export function getModel(id: string): VideoModel | undefined {
  return MODELS.find((m) => m.id === id);
}
