# Checkpoint video script (about 1:55)

The slides in `checkpoint_slides.mp4` advance on these timings. Play it full-screen and read along while you record (see the bottom of this file).
About 150 words per minute. Edit freely and say it in your own words.

| Time | Slide | Say |
|---|---|---|
| 0:00–0:08 | Title | "Hi, we're team **Degrees of Choice**: **Aryen Palkar, Jayden Liauw, and Haoyu Lin**. Our project is *Warming by Scenario*." |
| 0:08–0:22 | Dataset | "We're using CMIP6, the climate model runs on Google Cloud. We take monthly near-surface air temperature from nine models. Each model has a historical run and four future pathways, from SSP1-2.6, strong mitigation, up to SSP5-8.5, fossil-fuelled growth. We measure each model's warming against its own 1995-to-2014 average, then take the median across models." |
| 0:22–0:33 | Graph 1 | "First, the global average. The pathways only separate after about 2040. By 2100 they're roughly three degrees apart." |
| 0:33–0:44 | Graph 2 | "On the map, warming isn't even. Land warms more than ocean, and the Arctic warms the most." |
| 0:44–0:55 | Graph 3 | "This map is the difference between the highest and lowest pathway. It shows how much heat is still a choice, and that's largest at high northern latitudes." |
| 0:55–1:06 | Graph 4 | "Then we went down to 68 cities. Each row is a city, with one dot per pathway, so the spread of the dots is what the choice of pathway means for that city." |
| 1:06–1:17 | Graph 5 | "Plotting against latitude, most cities warm faster than the global average, the dashed lines, and the gap grows toward the poles." |
| 1:17–1:28 | Graph 6 | "Models disagree, so we show each model separately for three cities. That's why we report the median and a model range rather than a single model." |
| 1:28–1:38 | Question | "That led to our question: how much hotter do cities get under each pathway, and how much of that heat is still a choice?" |
| 1:38–1:55 | Progress | "Here's our current prototype in D3. You pick a pathway and a decade, and the map, a city ranking, and the city time series all update together. You can filter by region, zoom the map, and click cities to compare them. Next we'll refine the design and write it up. Thanks!" |

## Recording it (Mac, about 5 minutes)

1. Open `checkpoint_slides.mp4` in QuickTime. Don't play it yet.
2. QuickTime → File → New Screen Recording. Under Options, choose your microphone. Record the whole screen.
3. Make the slides full-screen, press play, and read the script.
4. Stop the recording, trim it under 2:00 (Edit → Trim), and export as `.mov`. Gradescope wants `.mp4`. Either rename it in Finder (QuickTime H.264 `.mov` files usually upload fine as `.mp4`) or convert it:
   `ffmpeg -i in.mov -c:v libx264 -c:a aac out.mp4`
   No ffmpeg on this Mac? Use `.venv/lib/python3.15/site-packages/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v9.0`.

Alternative: record the live site (https://aryenp.github.io/dsc106-project3/) instead of the last slide, and show the slider moving.
