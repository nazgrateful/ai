// Combines video clips and an optional voice track into one video file,
// entirely in the browser. It plays the clips onto a canvas and records the
// canvas together with the audio using MediaRecorder, so it needs no
// server and no extra libraries. Recording runs in real time.

export async function toBlobUrl(url: string): Promise<string> {
  if (url.startsWith("blob:")) return url;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't download the clip (${res.status}).`);
  return URL.createObjectURL(await res.blob());
}

function loadVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = src;
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error("Couldn't read a video clip."));
  });
}

/** Grabs the final frame of a clip as a JPEG data URI (used by "Continue"). */
export async function lastFrame(url: string): Promise<string> {
  const v = await loadVideo(await toBlobUrl(url));
  await new Promise<void>((resolve) => {
    v.onseeked = () => resolve();
    v.currentTime = Math.max(0, v.duration - 0.05);
  });
  const c = document.createElement("canvas");
  c.width = v.videoWidth;
  c.height = v.videoHeight;
  c.getContext("2d")!.drawImage(v, 0, 0);
  return c.toDataURL("image/jpeg", 0.92);
}

function pickMimeType(): string {
  const options = [
    "video/mp4;codecs=avc1,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return options.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) ?? "";
}

export type StitchResult = { blob: Blob; ext: "mp4" | "webm" };

/**
 * Plays `clips` back to back onto one recording. With `audio`, the clips loop
 * until the audio ends, so the video is as long as the voice.
 */
export async function stitch(
  clips: string[],
  audio: Blob | null,
  onProgress?: (fraction: number) => void,
): Promise<StitchResult> {
  if (typeof MediaRecorder === "undefined") throw new Error("This browser can't combine videos. Try Chrome or Safari.");
  const videos = await Promise.all(clips.map(async (c) => loadVideo(await toBlobUrl(c))));
  const width = videos[0].videoWidth;
  const height = videos[0].videoHeight;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const stream = canvas.captureStream(30);
  let audioEl: HTMLAudioElement | null = null;
  let audioCtx: AudioContext | null = null;
  if (audio) {
    audioEl = new Audio(URL.createObjectURL(audio));
    await new Promise<void>((resolve, reject) => {
      audioEl!.onloadedmetadata = () => resolve();
      audioEl!.onerror = () => reject(new Error("Couldn't read the voice audio."));
    });
    audioCtx = new AudioContext();
    const source = audioCtx.createMediaElementSource(audioEl);
    const dest = audioCtx.createMediaStreamDestination();
    source.connect(dest);
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  }

  const totalVideo = videos.reduce((s, v) => s + v.duration, 0);
  const total = audioEl ? audioEl.duration : totalVideo;

  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 6_000_000 } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));

  let done = false;
  let current = videos[0];
  const draw = () => {
    if (done) return;
    // Fit each clip to the canvas (clips can differ slightly in size).
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);
    const s = Math.min(width / current.videoWidth, height / current.videoHeight);
    const w = current.videoWidth * s;
    const h = current.videoHeight * s;
    ctx.drawImage(current, (width - w) / 2, (height - h) / 2, w, h);
    requestAnimationFrame(draw);
  };

  const started = performance.now();
  recorder.start(250);
  draw();
  if (audioEl) {
    await audioCtx!.resume();
    void audioEl.play();
  }

  // Play clips in order; loop the list while a voice is still talking.
  let i = 0;
  while (!done) {
    current = videos[i];
    current.currentTime = 0;
    await current.play();
    await new Promise<void>((resolve) => {
      const tick = () => {
        const elapsed = (performance.now() - started) / 1000;
        onProgress?.(Math.min(1, elapsed / total));
        if (elapsed >= total) {
          done = true;
          return resolve();
        }
        if (current.ended) return resolve();
        requestAnimationFrame(tick);
      };
      tick();
    });
    current.pause();
    i += 1;
    if (i >= videos.length) {
      if (!audioEl) break; // silent: play each clip once
      i = 0; // voice still talking: loop the clips
    }
  }

  done = true;
  recorder.stop();
  await stopped;
  audioEl?.pause();
  await audioCtx?.close();
  stream.getTracks().forEach((t) => t.stop());
  onProgress?.(1);

  const type = recorder.mimeType || mimeType || "video/webm";
  return { blob: new Blob(chunks, { type }), ext: type.includes("mp4") ? "mp4" : "webm" };
}
