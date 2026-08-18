#!/usr/bin/env python3
"""Create the neutral fallback image used by non-JavaScript social crawlers."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "assets" / "preview-default.png"
W, H = 1200, 630
image = Image.new("RGB", (W, H), (11, 15, 29))
pixels = image.load()
for y in range(H):
    for x in range(W):
        glow = max(0, 1 - (((x - 980) ** 2 + (y - 70) ** 2) ** 0.5) / 850)
        pixels[x, y] = (int(11 + 31 * glow), int(15 + 8 * glow), int(29 + 35 * glow))
draw = ImageDraw.Draw(image, "RGBA")
draw.ellipse((790, -190, 1370, 390), fill=(230, 44, 128, 120))
draw.ellipse((-250, 450, 360, 1040), fill=(74, 104, 255, 75))
font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
regular_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
brand = ImageFont.truetype(font_path, 34)
title = ImageFont.truetype(font_path, 60)
body = ImageFont.truetype(regular_path, 30)
draw.rounded_rectangle((72, 62, 318, 112), radius=20, fill=(230, 44, 128, 230))
draw.text((98, 73), "NEXUSXXX", font=brand, fill="white")
draw.text((74, 160), "VIDEO PREVIEW", font=body, fill=(177, 189, 225))
draw.text((74, 235), "Watch on NexusXXX", font=title, fill="white")
draw.text((74, 335), "Open the video page to watch the official embedded player", font=body, fill=(225, 230, 250))
draw.text((74, 520), "18+  •  Official embedded video", font=brand, fill=(230, 235, 255))
TARGET.parent.mkdir(parents=True, exist_ok=True)
image.save(TARGET, format="PNG", optimize=True)
print(TARGET)
