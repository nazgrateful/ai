# AI Video Maker

A web app that turns a sentence into a **photorealistic video** of people, animals or places.

- **Three modes:** Humans, Animals and Environments. Each one adds realism details that suit the subject, such as skin pores and natural hands for people, fur and natural gait for animals, and volumetric light for landscapes.
- **Camera and lighting presets:** cinematic dolly, handheld, drone, telephoto, macro; golden hour, overcast, night and more.
- **Top video models**, all through one [Replicate](https://replicate.com) account: Google Veo 3 (with sound), Kling 2.1 Master, MiniMax Hailuo 02 and Seedance 1 Pro.
- **Optional starting photo:** begin the video from a real photo to get the most lifelike results.
- A built-in negative prompt steers models away from cartoon looks, plastic skin and extra fingers.
- Your videos appear in a gallery with download links. The history is saved in your browser.
- Works on phones and desktops, with an optional password lock.

## Put it on the web (about 5 minutes, free hosting)

1. **Get a Replicate API token:** sign up at [replicate.com](https://replicate.com), add billing, then copy a token from [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens).
2. **Deploy to Vercel:** click the button below and sign in with GitHub:

   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnazgrateful%2Fai&env=REPLICATE_API_TOKEN,APP_PASSWORD&envDescription=REPLICATE_API_TOKEN%20is%20required.%20APP_PASSWORD%20locks%20the%20site%20so%20strangers%20can%27t%20spend%20your%20credits.&project-name=ai-video-maker)

   You can also go to [vercel.com/new](https://vercel.com/new), import the `nazgrateful/ai` repository and leave all the settings at their defaults.
3. **Set the environment variables** when Vercel asks for them:
   | Name | Value |
   |---|---|
   | `REPLICATE_API_TOKEN` | your token from step 1 (**required**) |
   | `APP_PASSWORD` | a password of your choice (**strongly recommended**) |
4. Click **Deploy**. After about a minute you get a link like `https://ai-video-maker.vercel.app`. Open it, enter any username and your password, and start making videos.

Every time you push to the `main` branch, Vercel redeploys the site automatically.

> **Why the password matters:** every video is billed to your Replicate account, at roughly $0.25 to $6 per clip depending on the model, length and quality. Without `APP_PASSWORD`, anyone who finds your link can spend your credits.

## Run it on your own computer

```bash
npm install
```

```bash
cp .env.example .env.local   # then paste your token into .env.local
```

```bash
npm run dev
```

Then open http://localhost:3000.

## Project layout

| Path | What it does |
|---|---|
| `app/page.tsx` | The whole interface: prompt, presets, model options, gallery |
| `app/api/generate/route.ts` | Starts a video job on Replicate |
| `app/api/status/[id]/route.ts` | Checks progress and returns the finished video URL |
| `lib/prompt.ts` | The realism engine: subject details, camera and lighting presets, negative prompt |
| `lib/models.ts` | The list of video models and the options each one supports |
| `proxy.ts` | Optional site-wide password (`APP_PASSWORD`) |

**Adding a new model:** add an entry to `lib/models.ts` using its Replicate `owner/name`, and list the options it accepts as shown on that model's API page.

## Notes

- Rendering takes about 1 to 5 minutes per clip. You can queue several videos at once.
- Replicate deletes output files about an hour after rendering, so download the videos you want to keep.
- Each model provider's content policy applies. Don't create videos that show real people without their consent.
