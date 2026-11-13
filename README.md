# AI Video Maker

A web app that turns a sentence into a **photorealistic video** of people, animals or places.

- **Three modes:** Humans, Animals and Environments. Each one adds realism details that suit the subject, such as skin pores and natural hands for people, fur and natural gait for animals, and volumetric light for landscapes.
- **Camera and lighting presets:** cinematic dolly, handheld, drone, telephoto, macro; golden hour, overcast, night and more.
- **Free by default:** uses open-source models (LTX-Video and Wan 2.2) running on Hugging Face's free GPUs. There's no bill, but you get a daily limit of a few short clips.
- **Optional paid upgrade:** add a [Replicate](https://replicate.com) key to unlock Google Veo 3 (with sound), Kling 2.1, Hailuo 02 and Seedance, which give longer and sharper clips.
- **Starting photo:** begin the video from a real photo to get the most lifelike results. Wan 2.2 always needs one.
- A built-in negative prompt steers models away from cartoon looks, plastic skin and extra fingers.
- Your videos appear in a gallery with download links. The history is saved in your browser.
- Works on phones and desktops, with an optional password lock.

## Put it on the web for free (about 5 minutes)

1. **Get a free Hugging Face token:** sign up at [huggingface.co/join](https://huggingface.co/join), with no card needed. Then go to [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens), click **Create new token**, choose **Read**, and copy the token. It starts with `hf_`.
2. **Deploy to Vercel (free):** click the button below and sign in with GitHub:

   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnazgrateful%2Fai&env=HF_TOKEN&envDescription=Free%20Hugging%20Face%20Read%20token%20from%20huggingface.co%2Fsettings%2Ftokens&project-name=ai-video-maker)

   You can also go to [vercel.com/new](https://vercel.com/new), import the `nazgrateful/ai` repository and leave all the settings at their defaults.
3. **Set the environment variables** when Vercel asks for them (or later under **Settings → Environment Variables**, then redeploy):
   | Name | Value | Needed? |
   |---|---|---|
   | `HF_TOKEN` | your `hf_…` token from step 1 | **Yes** (free) |
   | `APP_PASSWORD` | a password of your choice | Optional, but it keeps strangers from using up your daily free clips |
   | `REPLICATE_API_TOKEN` | a Replicate token | Optional, **paid**. Unlocks Veo 3, Kling and the other paid models |
4. Click **Deploy**. After about a minute you get a link like `https://ai-video-maker.vercel.app`.

Every time you push to the `main` branch, Vercel redeploys the site automatically.

### What "free" means

- Hugging Face gives every account a small amount of free GPU time each day. That's roughly a few 3–5 second clips. The allowance refills over the next day.
- Free clips are shorter and lower resolution (about 768×448) than the paid models.
- The free models run on public community servers, so they are sometimes busy, slow or offline. If one fails, try again later or switch models.
- Hugging Face PRO (paid) gives about 8× more daily GPU time if you ever want more without switching to Replicate.

## Run it on your own computer

```bash
npm install
```

```bash
cp .env.example .env.local   # then paste your HF_TOKEN into .env.local
```

```bash
npm run dev
```

Then open http://localhost:3000.

## Project layout

| Path | What it does |
|---|---|
| `app/page.tsx` | The whole interface: prompt, presets, model options, gallery |
| `app/api/generate/route.ts` | Renders a free video, or starts a paid Replicate job |
| `lib/free.ts` | Free models on Hugging Face Spaces (LTX-Video, Wan 2.2) |
| `app/api/status/[id]/route.ts` | Checks progress and returns the finished video URL |
| `lib/prompt.ts` | The realism engine: subject details, camera and lighting presets, negative prompt |
| `lib/models.ts` | The list of video models (free and paid) and the options each one supports |
| `proxy.ts` | Optional site-wide password (`APP_PASSWORD`) |

**Adding a new model:** add an entry to `lib/models.ts` using its Replicate `owner/name`, and list the options it accepts as shown on that model's API page.

## Notes

- Rendering takes about 1 to 3 minutes for free clips and 1 to 5 minutes for paid ones. Keep the page open while a free clip renders.
- Video links expire after a while, so download the videos you want to keep.
- Each model provider's content policy applies. Don't create videos that show real people without their consent.
