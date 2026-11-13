"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MODELS, getModel } from "@/lib/models";
import {
  CAMERAS,
  LIGHTING,
  SUBJECTS,
  buildPrompt,
  type CameraKey,
  type LightingKey,
  type Subject,
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
const POLL_MS = 4000;

const CAMERA_LABELS: Record<CameraKey, string> = {
  cinematic: "Cinematic dolly",
  handheld: "Handheld",
  drone: "Drone aerial",
  telephoto: "Telephoto",
  tripod: "Static tripod",
  closeup: "Macro close-up",
};

const LIGHTING_LABELS: Record<LightingKey, string> = {
  golden: "Golden hour",
  overcast: "Overcast",
  blue: "Blue hour",
  night: "Night",
  studio: "Studio",
  harsh: "Midday sun",
};

const DEFAULT_CAMERA: Record<Subject, CameraKey> = {
  human: "cinematic",
  animal: "telephoto",
  environment: "drone",
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
  const [subject, setSubject] = useState<Subject>("human");
  const [idea, setIdea] = useState("");
  const [camera, setCamera] = useState<CameraKey>("cinematic");
  const [lighting, setLighting] = useState<LightingKey>("golden");
  const [enhance, setEnhance] = useState(true);
  const [modelId, setModelId] = useState(MODELS[0].id);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [duration, setDuration] = useState<number | undefined>();
  const [resolution, setResolution] = useState<string | undefined>();
  const [image, setImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [paidEnabled, setPaidEnabled] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const model = getModel(modelId)!;
  const finalPrompt = useMemo(
    () => buildPrompt({ idea, subject, camera, lighting, enhance }),
    [idea, subject, camera, lighting, enhance],
  );

  useEffect(() => {
    // A free render in progress can't survive a page reload.
    setJobs(
      loadHistory().map((j) =>
        j.status === "rendering" ? { ...j, status: "failed", error: "Interrupted (page was closed or reloaded)." } : j,
      ),
    );
    fetch("/api/config")
      .then((r) => r.json())
      .then((c: { paid?: boolean }) => setPaidEnabled(Boolean(c.paid)))
      .catch(() => {});
  }, []);

  const availableModels = MODELS.filter((m) => m.provider === "free" || paidEnabled);

  function updateJob(id: string, patch: Partial<Job>) {
    setJobs((prev) => {
      const next = prev.map((j) => (j.id === id ? { ...j, ...patch } : j));
      saveHistory(next);
      return next;
    });
  }

  // Reset options the newly chosen model doesn't support.
  useEffect(() => {
    if (model.aspectRatios && !model.aspectRatios.includes(aspectRatio)) setAspectRatio(model.aspectRatios[0]);
    setDuration(model.durations?.[0]);
    setResolution(model.resolutions?.at(-1));
    if (!model.acceptsImage) setImage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId]);

  // Poll unfinished jobs until they succeed or fail.
  const [tick, setTick] = useState(0);
  const pendingKey = jobs
    .filter((j) => j.status === "starting" || j.status === "processing")
    .map((j) => j.id)
    .join(",");
  useEffect(() => {
    if (!pendingKey) return;
    const timer = setTimeout(async () => {
      const pending = jobs.filter((j) => pendingKey.split(",").includes(j.id));
      const updates = await Promise.all(
        pending.map(async (j) => {
          try {
            const res = await fetch(`/api/status/${j.id}`);
            const data = await res.json();
            if (!res.ok) return { ...j, status: "failed", error: data.error };
            return { ...j, status: data.status, url: data.url, error: data.error };
          } catch {
            return j; // network blip: try again next tick
          }
        }),
      );
      setJobs((prev) => {
        const next = prev.map((j) => updates.find((u) => u.id === j.id) ?? j);
        saveHistory(next);
        return next;
      });
      setTick((t) => t + 1); // schedule the next poll even if nothing changed
    }, POLL_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey, tick]);

  function pickSubject(s: Subject) {
    setSubject(s);
    setCamera(DEFAULT_CAMERA[s]);
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
    const payload = JSON.stringify({ model: modelId, prompt: finalPrompt, aspectRatio, duration, resolution, image });

    if (model.provider === "free") {
      // Free models render inside the request: show a card now, fill it in when done.
      const id = `free-${Date.now()}`;
      const job: Job = { id, status: "rendering", prompt: idea.trim(), model: model.label, createdAt: Date.now() };
      setFormError(null);
      setJobs((prev) => {
        const next = [job, ...prev];
        saveHistory(next);
        return next;
      });
      try {
        const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
        const data = await res.json().catch(() => ({ error: `Server error (${res.status}). The render may have taken too long.` }));
        if (!res.ok) throw new Error(data.error ?? "Generation failed.");
        updateJob(id, { status: "succeeded", url: data.url });
      } catch (err) {
        updateJob(id, { status: "failed", error: (err as Error).message });
      }
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed.");
      const job: Job = {
        id: data.id,
        status: data.status,
        prompt: idea.trim(),
        model: model.label,
        createdAt: Date.now(),
      };
      setJobs((prev) => {
        const next = [job, ...prev];
        saveHistory(next);
        return next;
      });
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function removeJob(id: string) {
    setJobs((prev) => {
      const next = prev.filter((j) => j.id !== id);
      saveHistory(next);
      return next;
    });
  }

  const example = SUBJECTS.find((s) => s.id === subject)!.example;

  return (
    <main className="wrap">
      <header className="hero">
        <h1>AI Video Maker</h1>
        <p>Photorealistic video of people, wildlife and places, from a sentence.</p>
      </header>

      <form className="panel" onSubmit={generate}>
        <div className="tabs" role="tablist" aria-label="Subject">
          {SUBJECTS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={subject === s.id}
              className={subject === s.id ? "tab active" : "tab"}
              onClick={() => pickSubject(s.id)}
            >
              <span aria-hidden>{s.emoji}</span> {s.label}
            </button>
          ))}
        </div>

        <label className="field">
          <span>Describe your shot</span>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder={example}
            rows={3}
            maxLength={1500}
          />
        </label>
        <button type="button" className="link" onClick={() => setIdea(example)}>
          Use example
        </button>

        <div className="grid">
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
              {availableModels.map((m) => (
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
          {model.durations ? (
            <label className="field">
              <span>Length</span>
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                {model.durations.map((d) => <option key={d} value={d}>{d} seconds</option>)}
              </select>
            </label>
          ) : (
            model.fixedDuration && (
              <div className="field">
                <span>Length</span>
                <div className="static">{model.fixedDuration} seconds</div>
              </div>
            )
          )}
          {model.resolutions && (
            <label className="field">
              <span>Quality</span>
              <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
                {model.resolutions.map((r) => <option key={r}>{r}</option>)}
              </select>
            </label>
          )}
        </div>
        <p className="hint">
          {model.blurb}
          {model.provider === "free" && " Free GPUs come with a daily limit of a few short clips per day."}
        </p>

        {model.acceptsImage && (
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
            <p className="hint">A real photo as the first frame gives the most lifelike faces and places.</p>
          </div>
        )}

        <label className="check">
          <input type="checkbox" checked={enhance} onChange={(e) => setEnhance(e.target.checked)} />
          Realism boost: add camera, lighting and detail keywords to my prompt
        </label>

        {enhance && idea.trim() && (
          <details className="preview">
            <summary>See the full prompt</summary>
            <p>{finalPrompt}</p>
          </details>
        )}

        {formError && <p className="error" role="alert">{formError}</p>}

        <button className="primary" type="submit" disabled={submitting}>
          {submitting ? "Sending…" : "Generate video"}
        </button>
      </form>

      <section className="gallery" aria-live="polite">
        {jobs.length > 0 && <h2>Your videos</h2>}
        {jobs.map((j) => (
          <article key={j.id} className="card">
            {j.status === "succeeded" && j.url ? (
              <video src={j.url} controls loop playsInline autoPlay muted />
            ) : j.status === "failed" || j.status === "canceled" ? (
              <div className="placeholder failed">Failed: {j.error ?? "unknown error"}</div>
            ) : (
              <div className="placeholder">
                <div className="spinner" aria-hidden />
                {j.status === "rendering"
                  ? "Rendering on free GPUs… about 1–3 minutes. Keep this page open."
                  : "Rendering… this usually takes 1–5 minutes"}
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
