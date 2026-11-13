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

type Job = {
  id: string;
  prompt: string;
  model: string;
  status: string;
  url?: string | null;
  error?: string | null;
  createdAt: number;
};

const HISTORY_KEY = "ai-video-maker:history";

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

function loadHistory(): Job[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as Job[];
  } catch {
    return [];
  }
}

function saveHistory(jobs: Job[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(jobs.slice(0, 30)));
  } catch {
    /* storage unavailable: history just won't persist */
  }
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
  const [setting, setSetting] = useState<SettingKey>("auto");
  const [exampleIdx, setExampleIdx] = useState(0);
  const [idea, setIdea] = useState("");
  const [camera, setCamera] = useState<CameraKey>("cinematic");
  const [lighting, setLighting] = useState<LightingKey>("golden");
  const [enhance, setEnhance] = useState(true);
  const [modelId, setModelId] = useState(MODELS[0].id);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [duration, setDuration] = useState(2);
  const [image, setImage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const model = getModel(modelId)!;
  const finalPrompt = useMemo(
    () => buildPrompt({ idea, setting, camera, lighting, enhance }),
    [idea, setting, camera, lighting, enhance],
  );

  useEffect(() => {
    // A render in progress can't survive a page reload.
    setJobs(
      loadHistory().map((j) =>
        j.status === "rendering" ? { ...j, status: "failed", error: "Interrupted (page was closed or reloaded)." } : j,
      ),
    );
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

  async function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImage(await fileToDataUri(file));
    } catch {
      setFormError("Couldn't read that image. Try a JPEG or PNG.");
    }
  }

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!idea.trim()) {
      setFormError("Describe what you want to see.");
      return;
    }
    if (model.requiresImage && !image) {
      setFormError(`${model.label} needs a starting photo. Add one below, or switch to LTX-Video for text only.`);
      return;
    }
    setFormError(null);

    const id = `${Date.now()}`;
    updateJobs((prev) => [
      { id, status: "rendering", prompt: idea.trim(), model: model.label, createdAt: Date.now() },
      ...prev,
    ]);
    try {
      const url = await generateFree(model, {
        prompt: finalPrompt,
        negativePrompt: NEGATIVE_PROMPT,
        aspectRatio,
        duration,
        image,
      });
      updateJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: "succeeded", url } : j)));
    } catch (err) {
      updateJobs((prev) =>
        prev.map((j) => (j.id === id ? { ...j, status: "failed", error: (err as Error).message } : j)),
      );
    }
  }

  function removeJob(id: string) {
    updateJobs((prev) => prev.filter((j) => j.id !== id));
  }

  const example = EXAMPLES[exampleIdx];

  function useExample() {
    setIdea(example);
    setExampleIdx((i) => (i + 1) % EXAMPLES.length);
  }

  return (
    <main className="wrap">
      <header className="hero">
        <h1>Real Human AI Video</h1>
        <p>Photorealistic video of real-looking people in a real 3D world, from a sentence or a photo.</p>
      </header>

      <form className="panel" onSubmit={generate}>
        <label className="field">
          <span>Describe the person and what they do</span>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder={example}
            rows={3}
            maxLength={1500}
          />
        </label>
        <button type="button" className="link" onClick={useExample}>
          Try an example
        </button>

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
          <label className="field">
            <span>Model</span>
            <select value={modelId} onChange={(e) => setModelId(e.target.value)}>
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </label>
          {model.aspectRatios && (
            <label className="field">
              <span>Aspect ratio</span>
              <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}>
                {model.aspectRatios.map((a) => <option key={a}>{a}</option>)}
              </select>
            </label>
          )}
          <label className="field">
            <span>Length</span>
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {model.durations.map((d) => <option key={d} value={d}>{d} seconds</option>)}
            </select>
          </label>
        </div>
        <p className="hint">
          {model.blurb}
          {" Free with no sign-up: Hugging Face gives each visitor 2 minutes of GPU time per day."}
        </p>

        <div className="upload">
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={onImage} hidden />
            {image ? (
              <div className="thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="Starting frame" />
                <button type="button" className="link" onClick={() => setImage(null)}>Remove</button>
              </div>
            ) : (
              <button type="button" className="secondary" onClick={() => fileInput.current?.click()}>
                {model.requiresImage ? "+ Add a starting photo (required)" : "+ Add a starting photo (optional)"}
              </button>
            )}
            <p className="hint">A real photo of a person as the first frame gives the most lifelike faces.</p>
        </div>

        <label className="check">
          <input type="checkbox" checked={enhance} onChange={(e) => setEnhance(e.target.checked)} />
          Realism boost: add setting, camera, lighting and human-detail keywords to my prompt
        </label>

        {enhance && idea.trim() && (
          <details className="preview">
            <summary>See the full prompt</summary>
            <p>{finalPrompt}</p>
          </details>
        )}

        {formError && <p className="error" role="alert">{formError}</p>}

        <button className="primary" type="submit">
          Generate video
        </button>
      </form>

      <section className="gallery" aria-live="polite">
        {jobs.length > 0 && <h2>Your videos</h2>}
        {jobs.map((j) => (
          <article key={j.id} className="card">
            {j.status === "succeeded" && j.url ? (
              <video src={j.url} controls loop playsInline autoPlay muted />
            ) : j.status === "failed" ? (
              <div className="placeholder failed">Failed: {j.error ?? "unknown error"}</div>
            ) : (
              <div className="placeholder">
                <div className="spinner" aria-hidden />
                Rendering on free GPUs… about 1–3 minutes. Keep this page open.
              </div>
            )}
            <div className="meta">
              <p>{j.prompt}</p>
              <small>
                {j.model} · {new Date(j.createdAt).toLocaleString()}
              </small>
              <div className="actions">
                {j.url && (
                  <a href={j.url} download target="_blank" rel="noreferrer">Download</a>
                )}
                <button type="button" className="link" onClick={() => removeJob(j.id)}>Remove</button>
              </div>
            </div>
          </article>
        ))}
        {jobs.some((j) => j.url) && (
          <p className="hint">Video links expire after a while, so download the ones you want to keep.</p>
        )}
      </section>
    </main>
  );
}
