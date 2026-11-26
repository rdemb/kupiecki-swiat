"""Render the original merchant prologue and three seamless location loops.

Run from the repository root with Python, numpy, opencv-python-headless and ffmpeg.
The four WebP masters in public/cinema are the source plates. All foley is synthesized.
"""
import math
import subprocess
import tempfile
import wave
from pathlib import Path

import cv2
import numpy as np

OUT = Path("public/cinema")
W, H, FPS, SECONDS = 1280, 720, 24, 5
N = FPS * SECONDS
TAU = 2 * math.pi
SHOTS = ["sakwa", "rynek", "trakt", "kuznia"]
Y, X = np.mgrid[:H, :W].astype("float32")
U, V = X / W, Y / H
cv2.setNumThreads(2)


def spot(x, y, width, height):
    return np.exp(-2 * (((U - x) / width) ** 2 + ((V - y) / height) ** 2))


def render(shot, looping, write):
    plate = cv2.imread(str(OUT / (shot + ".webp")))
    if plate is None:
        raise ValueError(shot)
    ph, pw = plate.shape[:2]
    # Estimated relative depth for camera trucking. Architecture stays anchored.
    depth = np.clip((V - 0.45) * 1.3, 0, 1)
    sway = np.zeros_like(X)
    ripple = np.zeros_like(X)
    fire = np.zeros_like(X)
    glow = np.zeros_like(X)
    if shot == "rynek":
        depth += 0.8 * spot(0.91, 0.63, 0.34, 0.62) + spot(0.11, 0.38, 0.33, 1.1)
        sway = spot(0.85, 0.25, 0.45, 0.14)
        ripple = spot(0.37, 0.87, 0.23, 0.15)
    elif shot == "trakt":
        depth += 0.9 * spot(0.11, 0.4, 0.33, 1.2)
        sway = np.maximum(0, 0.56 - V) * np.maximum(0, U - 0.2) * 5
        ripple = spot(0.47, 0.94, 0.44, 0.16)
    elif shot == "kuznia":
        depth += 0.9 * spot(0.77, 0.47, 0.37, 0.9)
        fire = spot(0.97, 0.51, 0.085, 0.22)
        glow = fire + 0.24 * spot(0.84, 0.52, 0.31, 0.5)
    else:
        depth += spot(0.65, 0.58, 0.71, 0.53)
    for i in range(N):
        t = i / N
        phase = TAU * t
        ease = (1 - math.cos(math.pi * t)) / 2
        travel = math.sin(phase) * 2.6 if looping else (ease - 0.5) * 19
        zoom = 1.036 if looping else 1.03 + 0.064 * ease
        sx = (X - W * 0.54) / zoom + W * 0.54 + depth * travel
        sy = (Y - H * 0.48) / zoom + H * 0.48
        sx += sway * np.sin(U * 32 + phase) + fire * np.sin(V * 49 - phase * 9) * 1.9
        sy += ripple * np.sin(V * 190 + U * 35 - phase * 3) * 1.45
        frame = cv2.remap(plate, sx * (pw / W), sy * (ph / H), cv2.INTER_LINEAR,
                          borderMode=cv2.BORDER_REPLICATE)
        if shot == "kuznia":
            pulse = 0.5 * math.sin(phase * 7) + 0.3 * math.sin(phase * 11) + 0.2 * math.sin(phase * 3)
            tint = glow[:, :, None] * np.array([2, 8, 16], np.float32) * pulse
            frame = np.clip(frame.astype(np.float32) + tint, 0, 255).astype("uint8")
            for j in range(11):
                age = (t + j * 0.618) % 1
                cx = int(W * (0.959 - 0.049 * age + 0.008 * math.sin(phase + j * 2)))
                cy = int(H * (0.54 - age * (0.11 + 0.08 * math.sin(j) ** 2)))
                color = tuple(int(v * math.sin(math.pi * age)) for v in (50, 151, 232))
                if 0.13 < age < 0.84:
                    cv2.line(frame, (cx, cy), (cx + 1, cy - 1), color, 1, cv2.LINE_AA)
        if not looping:
            # Brief dips around cuts; the in-game loops use the full exposure.
            opacity = min(1, 0.40 + min(i, N - i - 1) / 9)
            if opacity < 1:
                frame = cv2.convertScaleAbs(frame, alpha=opacity)
        write(frame.tobytes())


def encode(target, shots, audio=None):
    cmd = ["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24",
           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "pipe:0"]
    if audio:
        cmd += ["-i", str(audio), "-c:a", "aac", "-b:a", "96k"]
    cmd += ["-c:v", "libx264", "-threads", "2", "-preset", "fast", "-crf", "24",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(target)]
    with subprocess.Popen(cmd, stdin=subprocess.PIPE) as proc:
        for shot in shots:
            render(shot, audio is None, proc.stdin.write)
        proc.stdin.close()
        if proc.wait():
            raise RuntimeError("ffmpeg failed")


def score(path):
    rate = 44100
    t = np.arange(rate * SECONDS * len(SHOTS)) / rate
    left = np.zeros_like(t)
    right = np.zeros_like(t)
    rng = np.random.default_rng(611)
    def cue(start, signal, pan):
        k = int(start * rate)
        n = min(len(signal), len(left) - k)
        left[k:k+n] += signal[:n] * math.sqrt(1 - pan)
        right[k:k+n] += signal[:n] * math.sqrt(pan)
    # A sparse plucked modal phrase, with iron, coin and wooden hoof transients.
    for start, note in [(0.2,146.83),(1.75,220),(3.15,261.63),(5.1,293.66),(7.75,220),
                        (10.35,174.61),(12.4,196),(14.8,220),(17.2,164.81),(18.25,146.83)]:
        a = np.arange(3 * rate) / rate
        sig = sum(np.sin(TAU * note * h * a) * np.exp(-a * (1.65 + h * 0.33)) / h
                  for h in (1, 2, 3, 5))
        cue(start, 0.15 * sig * (1 - np.exp(-a * 145)), 0.37)
    for start, pitch, decay, pan in [(0.70,1870,11,.62),(0.92,2394,16,.53),
                                      (15.7,731,3.7,.72),(17.52,718,4.1,.69)]:
        a = np.arange(2 * rate) / rate
        ring = sum(np.sin(TAU * pitch * h * a) * np.exp(-a * decay * h**0.6) / h
                   for h in (1, 1.53, 2.64, 3.1))
        cue(start, ring * 0.094 * (1 - np.exp(-a * 500)), pan)
    for k in range(12):
        a = np.arange(rate // 5) / rate
        hoof = np.exp(-a * 36) * (np.sin(TAU * (102 * a - 78 * a**2)) + rng.normal(0, .18, len(a)))
        cue(10.3 + k * 0.33 + (k % 2) * 0.05, hoof * 0.065, 0.38 + k * 0.02)
    wind = np.interp(t, t[::180], rng.normal(0, .009, len(t[::180])))
    gain = np.minimum(1, np.minimum(t / 0.24, (t[-1] - t) / 1.1))
    stereo = np.stack(((left + wind) * gain, (right + wind * 0.9) * gain), axis=1)
    with wave.open(str(path), "wb") as wav:
        wav.setparams((2, 2, rate, 0, "NONE", "not compressed"))
        wav.writeframes((np.clip(stereo, -1, 1) * 32767).astype("<i2").tobytes())


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as temp:
        wav = Path(temp) / "szlak.wav"
        score(wav)
        encode(OUT / "pierwszy-szlak.mp4", SHOTS, wav)
        for shot in SHOTS[1:]:
            encode(OUT / (shot + ".mp4"), [shot])
