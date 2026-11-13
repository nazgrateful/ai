// Turns a plain idea ("a fox crossing a snowy road") into a detailed,
// camera-aware prompt that pushes video models toward photorealism.

export type Subject = "human" | "animal" | "environment";

export const SUBJECTS: { id: Subject; label: string; emoji: string; example: string }[] = [
  {
    id: "human",
    label: "Humans",
    emoji: "🧑",
    example: "An elderly fisherman mending a net on a wooden dock, laughing at something off-camera",
  },
  {
    id: "animal",
    label: "Animals",
    emoji: "🐆",
    example: "A snow leopard stalking slowly across a rocky ridge, wind ruffling its fur",
  },
  {
    id: "environment",
    label: "Environments",
    emoji: "🏔️",
    example: "Fog rolling through a redwood forest at dawn, light rays breaking through the canopy",
  },
];

const SUBJECT_DETAIL: Record<Subject, string> = {
  human:
    "natural skin texture with visible pores and fine imperfections, realistic eyes with catchlights and natural blinking, " +
    "anatomically correct hands and fingers, subtle micro-expressions, natural body weight and motion, believable hair strands, real fabric folds",
  animal:
    "anatomically accurate, individual fur or feather detail, natural gait and muscle movement, wet reflective eyes, " +
    "authentic animal behavior, documentary wildlife footage",
  environment:
    "physically accurate lighting and atmosphere, volumetric light, realistic scale and depth, fine surface detail, " +
    "natural weather and particle motion, real-world location footage",
};

export const CAMERAS = {
  cinematic: "cinematic slow dolly shot, shot on ARRI Alexa 35, 35mm anamorphic lens, shallow depth of field",
  handheld: "handheld documentary camera, subtle natural shake, 28mm lens",
  drone: "aerial drone shot, smooth gliding motion, wide-angle lens",
  telephoto: "telephoto wildlife lens 400mm, compressed background, creamy bokeh",
  tripod: "locked-off tripod shot, static frame, 50mm lens",
  closeup: "extreme close-up macro shot, 100mm macro lens, razor-thin focus",
} as const;

export const LIGHTING = {
  golden: "golden hour sunlight, warm low-angle light, long soft shadows",
  overcast: "soft overcast daylight, even diffuse light",
  blue: "blue hour twilight, cool ambient light",
  night: "night scene, practical light sources, realistic low-light film grain",
  studio: "soft studio key light with gentle rim light",
  harsh: "bright midday sun, hard shadows, high contrast",
} as const;

export type CameraKey = keyof typeof CAMERAS;
export type LightingKey = keyof typeof LIGHTING;

const REALISM =
  "photorealistic, indistinguishable from real footage, 4K, high dynamic range, natural color grading, " +
  "accurate physics, real motion blur, subtle film grain";

export const NEGATIVE_PROMPT =
  "cartoon, anime, illustration, painting, CGI, 3D render, video game, plastic skin, waxy skin, airbrushed, " +
  "deformed face, distorted hands, extra fingers, extra limbs, warped anatomy, morphing, flickering, " +
  "blurry, low resolution, oversaturated, watermark, text, logo, subtitles";

export function buildPrompt(opts: {
  idea: string;
  subject: Subject;
  camera: CameraKey;
  lighting: LightingKey;
  enhance: boolean;
}): string {
  const idea = opts.idea.trim().replace(/[.\s]+$/, "");
  if (!opts.enhance) return idea;
  return [idea, SUBJECT_DETAIL[opts.subject], CAMERAS[opts.camera], LIGHTING[opts.lighting], REALISM].join(". ") + ".";
}
