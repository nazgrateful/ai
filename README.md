# Real Human AI Video

A free website that makes **photorealistic AI videos of real-looking people in a real 3D world, talking with a real voice**. No sign-up, no keys and no cost.

**Live site:** https://nazgrateful.github.io/ai/

## Features

**🗣️ Talking video (with sound)**
- Type what the person should say, up to about 90 seconds of speech, and pick from 15 natural voices (US, UK, Australian; male and female) and a speaking speed.
- **Voiceover** (free, no sign-up): films the person talking, then adds the voice. The video runs as long as the voice. The lips won't match the exact words.
- **Real lip-sync** (needs a free Hugging Face token): animates a photo so the lips match every word, with an optional expression. About one video per day.
- You can download the video and the voice separately.

**🎬 Silent clip (extendable)**
- Text or photo to video with **LTX-Video** or **Wan 2.2** (the most realistic).
- **+ Continue** films the next part from the last frame and joins the parts, up to 5 parts.

**Realism engine**
- Adds human detail to every prompt: natural skin, real eyes, correct hands and natural motion.
- Presets for setting (city, home, nature, beach, office, night), camera and lighting.

## How it's free

The site is a plain web page on **GitHub Pages**. Everything runs from the visitor's browser:

| Step | Free service | Daily limit |
|---|---|---|
| Voice | Microsoft Edge neural voices via a Hugging Face Space (CPU) | None |
| Video clips | LTX-Video / Wan 2.2 on Hugging Face ZeroGPU | 2 GPU-minutes per visitor (5 with a free token) |
| Lip-sync | MoDA talking head on Hugging Face ZeroGPU | Needs a free token, about 1 per day |
| Adding sound and joining clips | Done inside your browser (MediaRecorder) | None |

Limits and notes:
- **LTX-Video uses the whole anonymous daily allowance per clip. Wan 2.2 with a photo uses the least.**
- **Adding the voice or joining clips happens in real time.** A 30-second voiceover takes 30 seconds to record. Keep the tab open and visible while it runs.
- **Save your downloads.** Videos with added sound or extra parts exist only in your browser tab until you download them.
- **Service availability.** The free models run on public community servers, so they're occasionally busy or offline.

### Optional: free Hugging Face token
Sign up at [huggingface.co](https://huggingface.co/join) (free, no card), create a **Read** token at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens), and paste it under **Settings** on the site. The token is stored only in your browser and is sent only to Hugging Face.

## Updating the site

Any change pushed to the `main` branch is rebuilt and published automatically by `.github/workflows/pages.yml`. You can watch progress in the repo's **Actions** tab.

## Run it on your own computer

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:3000.

## Project layout

| Path | What it does |
|---|---|
| `app/page.tsx` | The whole interface: prompt, presets, model options, gallery |
| `lib/free.ts` | Free video clips (LTX-Video, Wan 2.2) from the browser |
| `lib/voice.ts` | Free text-to-speech voices |
| `lib/talk.ts` | Real lip-sync (MoDA talking head) |
| `lib/stitch.ts` | Adds the voice to a video and joins clips, inside the browser |
| `lib/models.ts` | The list of models and the options each one supports |
| `lib/prompt.ts` | The human realism engine: settings, camera and lighting presets, negative prompt |
| `.github/workflows/pages.yml` | Builds the site and publishes it to GitHub Pages |

## Notes

- Don't create videos that show real people without their consent.
