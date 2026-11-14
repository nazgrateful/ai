"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { generateFree } from "@/lib/free";
import { MODELS, getModel } from "@/lib/models";
import {
  CAMERAS,
  EXAMPLES,
  LIGHTING,
  NEGATIVE_PROMPT,
  SETTINGS,
  buildPrompt,
  type CameraKey,
  type LightingKey,
  type SettingKey,
} from "@/lib/prompt";
import { lastFrame, stitch } from "@/lib/stitch";
import { EMOTIONS, lipSync } from "@/lib/talk";
import { MAX_SCRIPT_CHARS, VOICES, generateVoice } from "@/lib/voice";

type Mode = "talk" | "clip";
type TalkStyle = "voiceover" | "lipsync";

type Job = {
  id: string;
  kind: "voiceover" | "lipsync" | "clip";
  status: "rendering" | "succeeded" | "failed";
  step?: string;
  prompt: string;
  model: string;
  url?: string | null; // playable video (remote URL or in-page blob URL)
  ext?: string;
  ephemeral?: boolean; // blob URL: gone after the page closes
  voiceUrl?: string; // blob URL of the generated voice
  clips?: string[]; // remote clip URLs, for "Continue"
  fullPrompt?: string;
  error?: string | null;
  createdAt: number;
};

const HISTORY_KEY = "ai-video-maker:history";
const TOKEN_KEY = "ai-video-maker:hf-token";
const MAX_PARTS = 5;

const SETTING_LABELS: Record<SettingKey, string> = {
  auto: "From my description",
  city: "City street",
  home: "Home interior",
  nature: "Nature",
  beach: "Beach",
  office: "Office",
  night: "City at night",
};

const CAMERA_LABELS: Record<CameraKey, string> = {
  cinematic: "Cinematic dolly",
  handheld: "Handheld",
  portrait: "Portrait close-up",
  tracking: "Tracking shot",
  wide: "Wide shot",
  tripod: "Static tripod",
};

const LIGHTING_LABELS: Record<LightingKey, string> = {
  golden: "Golden hour",
  overcast: "Overcast",
  window: "Window light",
  blue: "Blue hour",
  night: "Night",
  harsh: "Midday sun",
};

const TALKING_ACTION =
  "talking naturally to the camera, lips and jaw moving as they speak, subtle head movement and hand gestures";

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

function loadHistory(): Job[] {
  try {
    const jobs = JSON.parse(readStorage(HISTORY_KEY) ?? "[]") as Job[];
    return jobs.map((j): Job => {
      if (j.status === "rendering") return { ...j, status: "failed", error: "Interrupted (page was closed or reloaded)." };
      if (j.ephemeral) {
        return {
          ...j,
          status: "failed",
          url: null,
          voiceUrl: undefined,
          error: "Expired: videos with added sound or extra parts are only kept until the page closes. Download them first next time.",
        };
      }
      return j;
    });
  } catch {
    return [];
  }
}

function saveHistory(jobs: Job[]) {
  writeStorage(HISTORY_KEY, JSON.stringify(jobs.slice(0, 30)));
}

// Shrink an uploaded photo so it travels as a small data URI.
async function fileToDataUri(file: File, maxSide = 1280): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.88);
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("talk");
  const [talkStyle, setTalkStyle] = useState<TalkStyle>("voiceover");
  const [idea, setIdea] = useState("");
  const [script, setScript] = useState("");
  const [voice, setVoice] = useState(VOICES[0].id);
  const [rate, setRate] = useState(0);
  const [emotion, setEmotion] = useState("None");
  const [setting, setSetting] = useState<SettingKey>("auto");
  const [exampleIdx, setExampleIdx] = useState(0);
  const [camera, setCamera] = useState<CameraKey>("portrait");
  const [lighting, setLighting] = useState<LightingKey>("window");
  const [enhance, setEnhance] = useState(true);
  const [modelId, setModelId] = useState(MODELS[0].id);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [duration, setDuration] = useState(2);
  const [image, setImage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [token, setToken] = useState("");
  const [tokenDraft, setTokenDraft] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const model = getModel(modelId)!;
  const hasToken = token.startsWith("hf_");

  const finalPrompt = useMemo(
    () => buildPrompt({ idea, setting, camera, lighting, enhance }),
    [idea, setting, camera, lighting, enhance],
  );

  useEffect(() => {
    setJobs(loadHistory());
    const t = readStorage(TOKEN_KEY) ?? "";
    setToken(t);
    setTokenDraft(t);
  }, []);

  // Keep options valid for the newly chosen model.
  useEffect(() => {
    if (model.aspectRatios && !model.aspectRatios.includes(aspectRatio)) setAspectRatio(model.aspectRatios[0]);
    setDuration(model.durations[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId]);

  function updateJobs(fn: (prev: Job[]) => Job[]) {
    setJobs((prev) => {
      const next = fn(prev);
      saveHistory(next);
      return next;
    });
  }
  const patchJob = (id: string, patch: Partial<Job>) =>
    updateJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));

  function saveToken() {
    const t = tokenDraft.trim();
    if (t && !t.startsWith("hf_")) {
      setFormError("A Hugging Face token starts with hf_. Copy it again from huggingface.co/settings/tokens.");
      return;
    }
    setToken(t);
    writeStorage(TOKEN_KEY, t || null);
    setFormError(null);
  }

  function clearToken() {
    setTokenDraft("");
    setToken("");
    writeStorage(TOKEN_KEY, null);
  }

  async function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setImage(await fileToDataUri(file));
    } catch {
      setFormError("Couldn't read that image. Try a JPEG or PNG.");
    }
  }

  function startJob(job: Omit<Job, "id" | "status" | "createdAt">): string {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    updateJobs((prev) => [{ ...job, id, status: "rendering", createdAt: Date.now() }, ...prev]);
    return id;
  }

  // ---------- Talking video ----------
  async function makeTalking() {
    const text = script.trim();
    if (!text) return setFormError("Type what the person should say.");
    if (talkStyle === "lipsync") {
      if (!hasToken) return setFormError("Real lip-sync needs your free Hugging Face token. Add it under Settings below.");
      if (!image) return setFormError("Real lip-sync needs a photo of the person. Add one below.");
    } else if (!image && !idea.trim()) {
      return setFormError("Describe the person, or add a photo of them.");
    }
    setFormError(null);

    const id = startJob({
      kind: talkStyle,
      prompt: `“${text.length > 140 ? text.slice(0, 140) + "…" : text}”`,
      model: talkStyle === "lipsync" ? "Talking video · real lip-sync" : "Talking video · voiceover",
      step: "Creating the voice…",
    });

    try {
      const voiceBlob = await generateVoice(text, voice, rate);
      patchJob(id, { voiceUrl: URL.createObjectURL(voiceBlob), ephemeral: true });

      if (talkStyle === "lipsync") {
        patchJob(id, { step: "Animating the face to the voice… about 1–3 minutes. Keep this page open." });
        const url = await lipSync({ photo: image!, audio: voiceBlob, emotion, token });
        patchJob(id, { status: "succeeded", url, ext: "mp4", step: undefined });
        return;
      }

      // Voiceover: film a short clip of the person talking, then loop it under the voice.
      const clipModel = getModel(image ? "wan-2.2" : "ltx-video")!;
      const fullPrompt = buildPrompt({
        idea: `${idea.trim() || "A person"}, ${TALKING_ACTION}`,
        setting,
        camera,
        lighting,
        enhance,
      });
      patchJob(id, { step: "Filming the person talking… about 1–2 minutes. Keep this page open." });
      const clip = await generateFree(clipModel, {
        prompt: fullPrompt,
        negativePrompt: NEGATIVE_PROMPT,
        aspectRatio,
        duration: 3,
        image,
        token: hasToken ? token : undefined,
      });
      const { blob, ext } = await stitch([clip], voiceBlob, (f) =>
        patchJob(id, { step: `Adding the voice… ${Math.round(f * 100)}% (plays through once in real time; keep this tab visible)` }),
      );
      patchJob(id, { status: "succeeded", url: URL.createObjectURL(blob), ext, step: undefined });
    } catch (err) {
      patchJob(id, { status: "failed", error: (err as Error).message, step: undefined });
    }
  }

  // ---------- Silent clip ----------
  async function makeClip() {
    if (!idea.trim()) return setFormError("Describe what you want to see.");
    if (model.requiresImage && !image) {
      return setFormError(`${model.label} needs a starting photo. Add one below, or switch to LTX-Video for text only.`);
    }
    setFormError(null);
    const id = startJob({
      kind: "clip",
      prompt: idea.trim(),
      model: model.label,
      fullPrompt: finalPrompt,
      step: "Rendering on free GPUs… about 1–3 minutes. Keep this page open.",
    });
    try {
      const url = await generateFree(model, {
        prompt: finalPrompt,
        negativePrompt: NEGATIVE_PROMPT,
        aspectRatio,
        duration,
        image,
        token: hasToken ? token : undefined,
      });
      patchJob(id, { status: "succeeded", url, clips: [url], step: undefined });
    } catch (err) {
      patchJob(id, { status: "failed", error: (err as Error).message, step: undefined });
    }
  }

  // "Continue": film another part starting from the last frame, then join them.
  async function continueClip(job: Job) {
    const clips = job.clips ?? [];
    if (!clips.length) return;
    const previous = { url: job.url, ext: job.ext, model: job.model };
    patchJob(job.id, { status: "rendering", error: null, step: "Filming the next part from the last frame… about 1–2 minutes." });
    try {
      const frame = await lastFrame(clips[clips.length - 1]);
      const next = await generateFree(getModel("wan-2.2")!, {
        prompt: job.fullPrompt ?? job.prompt,
        negativePrompt: NEGATIVE_PROMPT,
        duration: 2,
        image: frame,
        token: hasToken ? token : undefined,
      });
      const all = [...clips, next];
      const { blob, ext } = await stitch(all, null, (f) =>
        patchJob(job.id, { step: `Joining the parts… ${Math.round(f * 100)}% (plays through once; keep this tab visible)` }),
      );
      patchJob(job.id, {
        status: "succeeded",
        clips: all,
        url: URL.createObjectURL(blob),
        ext,
        ephemeral: true,
        model: `${previous.model.split(" · ")[0]} · ${all.length} parts`,
        step: undefined,
      });
    } catch (err) {
      // Keep the video they already had.
      patchJob(job.id, { status: "succeeded", ...previous, step: undefined, error: `Couldn't continue: ${(err as Error).message}` });
    }
  }

  function removeJob(id: string) {
    updateJobs((prev) => prev.filter((j) => j.id !== id));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void (mode === "talk" ? makeTalking() : makeClip());
  }

  const example = EXAMPLES[exampleIdx];
  function useExample() {
    setIdea(example);
    setExampleIdx((i) => (i + 1) % EXAMPLES.length);
  }

  const showScene = mode === "clip" || talkStyle === "voiceover";
  const photoRequired = mode === "talk" ? talkStyle === "lipsync" : Boolean(model.requiresImage);
  const words = script.trim().split(/\s+/).filter(Boolean).length;

  return (
    <main className="wrap">
      <header className="hero">
        <h1>Real Human AI Video</h1>
        <p>Photorealistic people in a real 3D world, talking with a real voice. Free, no sign-up.</p>
      </header>

      <form className="panel" onSubmit={onSubmit}>
        <div className="tabs" role="tablist" aria-label="Video type">
          <button type="button" role="tab" aria-selected={mode === "talk"} className={mode === "talk" ? "tab active" : "tab"} onClick={() => setMode("talk")}>
            🗣️ Talking video <small>with sound</small>
          </button>
          <button type="button" role="tab" aria-selected={mode === "clip"} className={mode === "clip" ? "tab active" : "tab"} onClick={() => setMode("clip")}>
            🎬 Silent clip <small>extendable</small>
          </button>
        </div>

        {mode === "talk" && (
          <>
            <label className="field">
              <span>What should they say?</span>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="Hi! Thanks for stopping by. Let me tell you about my day…"
                rows={4}
                maxLength={MAX_SCRIPT_CHARS}
              />
              <small className="counter">
                {script.length}/{MAX_SCRIPT_CHARS} characters
                {words > 0 && ` · about ${Math.max(1, Math.round(words / 2.5))} seconds of speech`}
              </small>
            </label>

            <div className="grid">
              <label className="field">
                <span>Voice</span>
                <select value={voice} onChange={(e) => setVoice(e.target.value)}>
                  {VOICES.map((v) => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Speaking speed</span>
                <select value={rate} onChange={(e) => setRate(Number(e.target.value))}>
                  <option value={-25}>Slow</option>
                  <option value={-10}>Relaxed</option>
                  <option value={0}>Normal</option>
                  <option value={15}>Fast</option>
                </select>
              </label>
              {talkStyle === "lipsync" && (
                <label className="field">
                  <span>Expression</span>
                  <select value={emotion} onChange={(e) => setEmotion(e.target.value)}>
                    {EMOTIONS.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </label>
              )}
            </div>

            <fieldset className="choice">
              <legend>How should the voice be added?</legend>
              <label className={talkStyle === "voiceover" ? "option active" : "option"}>
                <input type="radio" name="style" checked={talkStyle === "voiceover"} onChange={() => setTalkStyle("voiceover")} />
                <span>
                  <strong>Voiceover</strong> · free, no sign-up
                  <small>Films the person talking and adds the voice. Any length. The lips won’t match the exact words.</small>
                </span>
              </label>
              <label className={talkStyle === "lipsync" ? "option active" : "option"}>
                <input type="radio" name="style" checked={talkStyle === "lipsync"} onChange={() => setTalkStyle("lipsync")} />
                <span>
                  <strong>Real lip-sync</strong> · free Hugging Face token {hasToken ? "added ✓" : "needed"}
                  <small>Animates a photo so the lips match every word. About 1 video per day.</small>
                </span>
              </label>
            </fieldset>
          </>
        )}

        {showScene && (
          <>
            <label className="field">
              <span>{mode === "talk" ? "Describe the person and where they are" : "Describe the person and what they do"}</span>
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder={
                  mode === "talk"
                    ? "A woman in her 30s with long dark hair, wearing a black blazer, sitting in a cozy living room"
                    : example
                }
                rows={3}
                maxLength={1500}
              />
            </label>
            {mode === "clip" && (
              <button type="button" className="link" onClick={useExample}>
                Try an example
              </button>
            )}

            <div className="grid">
              <label className="field">
                <span>Setting</span>
                <select value={setting} onChange={(e) => setSetting(e.target.value as SettingKey)} disabled={!enhance}>
                  {(Object.keys(SETTINGS) as SettingKey[]).map((k) => (
                    <option key={k} value={k}>{SETTING_LABELS[k]}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Camera</span>
                <select value={camera} onChange={(e) => setCamera(e.target.value as CameraKey)} disabled={!enhance}>
                  {(Object.keys(CAMERAS) as CameraKey[]).map((k) => (
                    <option key={k} value={k}>{CAMERA_LABELS[k]}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Lighting</span>
                <select value={lighting} onChange={(e) => setLighting(e.target.value as LightingKey)} disabled={!enhance}>
                  {(Object.keys(LIGHTING) as LightingKey[]).map((k) => (
                    <option key={k} value={k}>{LIGHTING_LABELS[k]}</option>
                  ))}
                </select>
              </label>
              {mode === "clip" && (
                <>
                  <label className="field">
                    <span>Model</span>
                    <select value={modelId} onChange={(e) => setModelId(e.target.value)}>
                      {MODELS.map((m) => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Length</span>
                    <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                      {model.durations.map((d) => <option key={d} value={d}>{d} seconds</option>)}
                    </select>
                  </label>
                </>
              )}
              {(mode === "talk" ? !image : Boolean(model.aspectRatios)) && (
                <label className="field">
                  <span>Aspect ratio</span>
                  <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}>
                    {["16:9", "9:16", "1:1"].map((a) => <option key={a}>{a}</option>)}
                  </select>
                </label>
              )}
            </div>
            {mode === "clip" && (
              <p className="hint">
                {model.blurb} Press <strong>Continue</strong> on a finished clip to make it longer.
              </p>
            )}
          </>
        )}

        <div className="upload">
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={onImage} hidden />
          {image ? (
            <div className="thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="Photo of the person" />
              <button type="button" className="link" onClick={() => setImage(null)}>Remove</button>
            </div>
          ) : (
            <button type="button" className="secondary" onClick={() => fileInput.current?.click()}>
              {photoRequired ? "+ Add a photo of the person (required)" : "+ Add a photo of the person (optional)"}
            </button>
          )}
          <p className="hint">A real, front-facing photo gives the most lifelike face. Only use photos of people who agreed to it.</p>
        </div>

        {showScene && (
          <label className="check">
            <input type="checkbox" checked={enhance} onChange={(e) => setEnhance(e.target.checked)} />
            Realism boost: add setting, camera, lighting and human-detail keywords
          </label>
        )}
        {mode === "clip" && enhance && idea.trim() && (
          <details className="preview">
            <summary>See the full prompt</summary>
            <p>{finalPrompt}</p>
          </details>
        )}

        {formError && <p className="error" role="alert">{formError}</p>}

        <button className="primary" type="submit">
          {mode === "talk" ? "Make talking video" : "Generate clip"}
        </button>

        <details className="settings">
          <summary>Settings · free Hugging Face token {hasToken ? "(added ✓)" : "(optional)"}</summary>
          <p className="hint">
            Without a token, Hugging Face gives each visitor 2 minutes of free GPU time a day. A free token raises that to
            5 minutes and unlocks <strong>Real lip-sync</strong>. To get one, sign up at huggingface.co (free, no card), open{" "}
            <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer">huggingface.co/settings/tokens</a>,
            choose <em>Create new token → Read</em>, and paste it here. It is saved in this browser only.
          </p>
          <div className="token-row">
            <input
              type="password"
              value={tokenDraft}
              onChange={(e) => setTokenDraft(e.target.value)}
              placeholder="hf_…"
              autoComplete="off"
              spellCheck={false}
              aria-label="Hugging Face token"
            />
            <button type="button" className="secondary" onClick={saveToken}>Save</button>
            {hasToken && (
              <button type="button" className="link" onClick={clearToken}>Remove</button>
            )}
          </div>
        </details>
      </form>

      <section className="gallery" aria-live="polite">
        {jobs.length > 0 && <h2>Your videos</h2>}
        {jobs.map((j) => (
          <article key={j.id} className="card">
            {j.status === "succeeded" && j.url ? (
              <video src={j.url} controls loop={j.kind === "clip"} playsInline autoPlay muted={j.kind === "clip"} />
            ) : j.status === "failed" ? (
              <div className="placeholder failed">{j.error ?? "Failed: unknown error"}</div>
            ) : (
              <div className="placeholder">
                <div className="spinner" aria-hidden />
                {j.step ?? "Working…"}
              </div>
            )}
            <div className="meta">
              <p>{j.prompt}</p>
              <small>
                {j.model} · {new Date(j.createdAt).toLocaleString()}
              </small>
              {j.error && j.status === "succeeded" && <p className="error">{j.error}</p>}
              <div className="actions">
                {j.status === "succeeded" && j.url && (
                  <a href={j.url} download={`video-${j.id}.${j.ext ?? "mp4"}`} target="_blank" rel="noreferrer">
                    Download video
                  </a>
                )}
                {j.voiceUrl && (
                  <a href={j.voiceUrl} download={`voice-${j.id}.mp3`}>Download voice</a>
                )}
                {j.kind === "clip" && j.status === "succeeded" && (j.clips?.length ?? 0) > 0 && j.clips!.length < MAX_PARTS && (
                  <button type="button" className="link" onClick={() => continueClip(j)}>
                    + Continue (add 2 seconds)
                  </button>
                )}
                <button type="button" className="link" onClick={() => removeJob(j.id)}>Remove</button>
              </div>
            </div>
          </article>
        ))}
        {jobs.some((j) => j.url) && (
          <p className="hint">
            Download the videos you want to keep: links expire after a while, and videos with added sound or extra parts are
            only kept until you close the page.
          </p>
        )}
      </section>
    </main>
  );
}
