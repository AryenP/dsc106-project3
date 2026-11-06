"""Render the timed checkpoint slideshow (silent) to checkpoint_slides.mp4.
Run: .venv/bin/python checkpoint/make_video.py
"""
import os, subprocess
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.image as mpimg
import imageio_ffmpeg

HERE = os.path.dirname(os.path.abspath(__file__))
EXP = os.path.join(HERE, "..", "exploratory")
OUT = os.path.join(HERE, "slides")
os.makedirs(OUT, exist_ok=True)
BG, INK, MUTED, ACC = "#f7f5f0", "#1f1d1a", "#57524a", "#a3243b"

# (seconds, title, body text or image path, caption)
SLIDES = [
    (8, "Warming by Scenario", None, "Team [TEAM NAME]  ·  Aryen Palkar · Jayden Liauw · Haoyu Lin\nDSC 106 · Project 3 checkpoint"),
    (14, "Dataset: CMIP6 (Google Cloud)", None,
     "Monthly near-surface air temperature (tas) · 9 climate models\n"
     "historical 1950–2014  +  SSP1-2.6 · SSP2-4.5 · SSP3-7.0 · SSP5-8.5 (2015–2100)\n\n"
     "Each model's warming vs its own 1995–2014 mean → median across models\n"
     "68 cities (model-grid interpolation) + global 2.5° grid"),
    (11, "1 · Global warming by pathway", "01_global_by_scenario.png", "Pathways diverge after ~2040"),
    (11, "2 · Where it warms (SSP5-8.5, 2090s)", "02_map_ssp585_2090s.png", "Land > ocean; Arctic warms most"),
    (11, "3 · How much is still a choice", "03_map_pathway_gap.png", "SSP5-8.5 minus SSP1-2.6, 2090s"),
    (11, "4 · Cities, one dot per pathway", "04_city_dumbbell_2090s.png", "Spread = what the pathway choice means for each city"),
    (11, "5 · Warming vs latitude", "05_warming_vs_latitude.png", "Most cities warm faster than the global mean (dashed)"),
    (11, "6 · Models disagree", "06_model_spread_cities.png", "So we show the median plus the model range"),
    (10, "Our question", None,
     "How much hotter do cities get under each CMIP6 pathway,\nand how much of that heat is still a choice?"),
    (17, "Current progress: D3 prototype", os.path.join(HERE, "progress.jpg"),
     "Pathway + decade controls drive the map, ranking and time series · region filter · zoom · click to compare"),
]


def render(i, sec, title, img, cap):
    fig = plt.figure(figsize=(19.2, 10.8), dpi=100, facecolor=BG)
    fig.text(0.05, 0.92, title, fontsize=40, weight="bold", color=INK, family="serif", va="center")
    if img:
        path = img if os.path.isabs(img) else os.path.join(EXP, img)
        ax = fig.add_axes([0.05, 0.1, 0.9, 0.76])
        ax.imshow(mpimg.imread(path))
        ax.axis("off")
        fig.text(0.05, 0.05, cap, fontsize=24, color=MUTED, va="center")
    else:
        big = i in (0, 8)
        fig.text(0.05, 0.55 if big else 0.6, cap, fontsize=34 if big else 28, color=INK if big else MUTED,
                 va="center", linespacing=1.6)
    fig.add_artist(plt.Line2D([0.05, 0.12], [0.86, 0.86], color=ACC, lw=4))
    p = os.path.join(OUT, f"{i:02d}.png")
    fig.savefig(p, facecolor=BG)
    plt.close(fig)
    return p


lines = []
for i, (sec, t, img, cap) in enumerate(SLIDES):
    p = render(i, sec, t, img, cap)
    lines += [f"file '{p}'", f"duration {sec}"]
lines.append(f"file '{p}'")  # concat demuxer needs the last file repeated
lst = os.path.join(OUT, "list.txt")
open(lst, "w").write("\n".join(lines))
out = os.path.join(HERE, "checkpoint_slides.mp4")
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst,
                "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-t", str(sum(s[0] for s in SLIDES)), out], check=True)
print(out, sum(s[0] for s in SLIDES), "s")
