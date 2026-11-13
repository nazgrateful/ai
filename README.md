# Real Human AI Video

A free website that turns a sentence or a photo into a **photorealistic AI video of real-looking people in a real 3D world**. **No sign-up, no keys and no cost** for you or your visitors.

**Live site:** https://nazgrateful.github.io/ai/

- **Human realism engine:** adds natural skin, real eyes, correct hands, subtle expressions and natural body motion to every prompt.
- **Setting, camera and lighting presets:** city street, home, nature, beach, office, city at night; cinematic dolly, handheld, portrait, tracking, wide; golden hour, window light, night and more.
- **Two free open-source models:**
  - **LTX-Video:** text or photo to video
  - **Wan 2.2:** the most realistic option; brings a photo of a person to life
- **Starting photo:** begin from a real photo of a person to get the most lifelike results.
- A built-in negative prompt steers models away from cartoon looks, plastic skin and extra fingers.
- Videos appear in a gallery with download links. The history is saved in your browser.
- Works on phones and desktops.

## How it's free

The site is a plain web page hosted on **GitHub Pages**. When someone clicks **Generate**, their browser sends the request straight to Hugging Face's free GPUs, which run open-source video models. There is no server and nothing to pay for.

Limits:
- **Daily limit:** each visitor gets a small amount of free GPU time per day, roughly a few short clips. It refills over the next day.
- **Clip size:** clips are 2–5 seconds at about 768×448.
- **Availability:** the free models run on public community servers, so they're occasionally busy or offline. If that happens, try again later or switch models.

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
| `lib/free.ts` | Calls the free Hugging Face models from the browser |
| `lib/models.ts` | The list of models and the options each one supports |
| `lib/prompt.ts` | The human realism engine: settings, camera and lighting presets, negative prompt |
| `.github/workflows/pages.yml` | Builds the site and publishes it to GitHub Pages |

## Notes

- Keep the page open while a video renders, which takes about 1–3 minutes.
- Video links expire after a while, so download the videos you want to keep.
- Don't create videos that show real people without their consent.
