"""Tighten long pauses in the voiceover and cut the slides to match it.
Run: .venv/bin/python checkpoint/align.py ~/Downloads/kk.m4a
Writes checkpoint/checkpoint_final.mp4
"""
import os, subprocess, sys
import numpy as np
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
SRC = os.path.expanduser(sys.argv[1])

# Silences (start, end) in the original recording, from ffmpeg silencedetect (-35 dB, >=0.5 s).
# Every pause longer than MAX_GAP is shortened to MAX_GAP; speech is never touched.
SILENCES = [(0.0, 1.307), (11.963, 12.880), (18.698, 19.661), (40.269, 42.410), (50.473, 52.615),
            (58.019, 60.493), (69.210, 71.795), (80.278, 83.479), (91.680, 95.425), (102.846, 103.812),
            (109.346, 112.026), (127.324, 129.126)]
MAX_GAP = 0.7
LEAD = 0.3   # keep this much silence at the very start
TAIL = 0.8   # and at the very end

# Slide changes = middle of the pause between paragraphs (original timeline, checked against a transcript).
# title | dataset | g1..g6 | question | progress
CUTS = [12.42, 41.34, 51.54, 59.26, 70.50, 81.88, 93.55, 103.33, 110.69]

# decode
raw = subprocess.run([FF, "-loglevel", "error", "-i", SRC, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                     capture_output=True, check=True).stdout
a = np.frombuffer(raw, dtype=np.float32)
dur = len(a) / SR

# intervals to remove
remove = []
for s, e in SILENCES:
    if s <= 0.01:
        keep = LEAD
        remove.append((s, max(s, e - keep)))
    elif e >= dur - 0.05:
        continue  # keep the ending whole: a quiet last word ("Thanks.") can sit inside the detected silence
    elif e - s > MAX_GAP:
        mid = (s + e) / 2
        remove.append((mid - (e - s - MAX_GAP) / 2, mid + (e - s - MAX_GAP) / 2))
remove = [(s, e) for s, e in remove if e - s > 0.01]


def new_time(t):
    return t - sum(min(e, t) - s for s, e in remove if s < t)


# assemble with 10 ms fades at every join to avoid clicks
fade = int(0.01 * SR)
pieces, prev = [], 0.0
for s, e in remove + [(dur, dur)]:
    seg = a[int(prev * SR):int(s * SR)].copy()
    if len(seg) > 2 * fade:
        seg[:fade] *= np.linspace(0, 1, fade)
        seg[-fade:] *= np.linspace(1, 0, fade)
    pieces.append(seg)
    prev = e
out = np.concatenate(pieces)
total = len(out) / SR
wav = os.path.join(HERE, "voice_tight.f32")
out.astype(np.float32).tofile(wav)

bounds = [0.0] + [new_time(c) for c in CUTS] + [total]
durs = np.diff(bounds)
slides = sorted(f for f in os.listdir(os.path.join(HERE, "slides")) if f.endswith(".png"))
assert len(slides) == len(durs) == 10, (len(slides), len(durs))
lst = os.path.join(HERE, "slides", "final_list.txt")
with open(lst, "w") as fh:
    for f, d in zip(slides, durs):
        fh.write(f"file '{os.path.join(HERE, 'slides', f)}'\nduration {d:.3f}\n")
    fh.write(f"file '{os.path.join(HERE, 'slides', slides[-1])}'\n")

final = os.path.join(HERE, "checkpoint_final.mp4")
subprocess.run([FF, "-y", "-loglevel", "error",
                "-f", "concat", "-safe", "0", "-i", lst,
                "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", wav,
                "-vf", "fps=30,format=yuv420p", "-c:v", "libx264",
                "-af", "loudnorm=I=-16:TP=-1.5", "-c:a", "aac", "-b:a", "160k", "-ar", "48000",
                "-t", f"{total:.3f}", "-movflags", "+faststart", final], check=True)
os.remove(wav)
print(f"original {dur:.1f}s -> {total:.1f}s")
for name, b, d in zip(["title", "dataset", "g1", "g2", "g3", "g4", "g5", "g6", "question", "progress"], bounds, durs):
    print(f"  {name:9} starts {b:6.1f}s  lasts {d:5.1f}s")
print(final)
