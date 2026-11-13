// Turns a plain idea ("a woman reading on a train") into a detailed,
// camera-aware prompt that pushes video models toward photorealistic
// humans in a believable real world.

export const EXAMPLES = [
  "An elderly fisherman mending a net on a wooden dock, laughing at something off-camera",
  "A young woman walking through a crowded night market, looking around in wonder",
  "A chef plating a dish in a busy restaurant kitchen, steam rising around him",
  "Two friends talking and laughing on a park bench in autumn, leaves falling",
];

export const SETTINGS = {
  auto: "",
  city: "on a busy city street with real pedestrians and traffic in the background",
  home: "in a lived-in home interior with natural clutter and window light",
  nature: "outdoors in a natural landscape with grass, trees and moving wind",
  beach: "on a beach with rolling waves and wet sand",
  office: "in a modern office with people working in the background",
  night: "in a city at night with neon signs and reflections on wet pavement",
} as const;

export const CAMERAS = {
  cinematic: "cinematic slow dolly shot, shot on ARRI Alexa 35, 35mm anamorphic lens, shallow depth of field",
  handheld: "handheld documentary camera, subtle natural shake, 28mm lens",
  portrait: "medium close-up portrait, 85mm lens, creamy background bokeh",
  tracking: "smooth tracking shot following the subject, gimbal stabilized, 35mm lens",
  wide: "wide establishing shot showing the person in their surroundings, 24mm lens",
  tripod: "locked-off tripod shot, static frame, 50mm lens",
} as const;

export const LIGHTING = {
  golden: "golden hour sunlight, warm low-angle light, long soft shadows",
  overcast: "soft overcast daylight, even diffuse light",
  window: "soft natural window light from the side",
  blue: "blue hour twilight, cool ambient light",
  night: "night scene, practical light sources, realistic low-light film grain",
  harsh: "bright midday sun, hard shadows, high contrast",
} as const;

export type SettingKey = keyof typeof SETTINGS;
export type CameraKey = keyof typeof CAMERAS;
export type LightingKey = keyof typeof LIGHTING;

const HUMAN_DETAIL =
  "real human with natural skin texture, visible pores and fine imperfections, realistic eyes with catchlights and natural blinking, " +
  "anatomically correct hands with five fingers, subtle micro-expressions, natural body weight and motion, believable hair strands, real fabric folds";

const REALISM =
  "photorealistic 3D depth, indistinguishable from real footage, 4K, high dynamic range, natural color grading, " +
  "accurate physics and lighting, real motion blur, subtle film grain";

export const NEGATIVE_PROMPT =
  "cartoon, anime, illustration, painting, CGI, 3D render, video game, doll, mannequin, plastic skin, waxy skin, airbrushed, " +
  "deformed face, asymmetrical eyes, distorted hands, extra fingers, missing fingers, extra limbs, warped anatomy, morphing, flickering, " +
  "blurry, low resolution, oversaturated, watermark, text, logo, subtitles";

export function buildPrompt(opts: {
  idea: string;
  setting: SettingKey;
  camera: CameraKey;
  lighting: LightingKey;
  enhance: boolean;
}): string {
  const idea = opts.idea.trim().replace(/[.\s]+$/, "");
  if (!opts.enhance) return idea;
  const scene = SETTINGS[opts.setting] ? `${idea}, ${SETTINGS[opts.setting]}` : idea;
  return [scene, HUMAN_DETAIL, CAMERAS[opts.camera], LIGHTING[opts.lighting], REALISM].join(". ") + ".";
}
