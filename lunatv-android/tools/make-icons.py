#!/usr/bin/env python3
"""Generate the Android launcher icons and splash images from LunaTV's web assets.

Run from anywhere: python3 tools/make-icons.py  (needs Pillow)
Sources: ../lunatv/assets/icons/*.png and ../lunatv/assets/branding/*
"""
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

HERE = Path(__file__).resolve().parent.parent
WEB = HERE.parent / "lunatv" / "assets"
RES = HERE / "app" / "src" / "main" / "res"
BLACK = (5, 6, 8, 255)
DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def save(img, folder, name):
    out = RES / folder
    out.mkdir(parents=True, exist_ok=True)
    img.save(out / name, optimize=True)


icon = Image.open(WEB / "icons" / "icon-512.png").convert("RGBA")
maskable = Image.open(WEB / "icons" / "icon-maskable-512.png").convert("RGBA")

# Monochrome silhouette for Android 13 themed icons: the bright chrome of the
# mark becomes opaque, the black background transparent.
lum = maskable.convert("L").point(lambda v: 0 if v < 40 else min(255, int((v - 40) * 1.6)))
mono = Image.new("RGBA", maskable.size, (255, 255, 255, 0))
mono.putalpha(lum)

for d, s in DENSITIES.items():
    folder = f"mipmap-{d}"
    legacy = round(48 * s)
    save(icon.resize((legacy, legacy), Image.LANCZOS), folder, "ic_launcher.png")
    # round legacy icon: the maskable art keeps the mark inside the circle
    r = maskable.resize((legacy, legacy), Image.LANCZOS)
    circle = Image.new("L", (legacy * 4, legacy * 4), 0)
    ImageDraw.Draw(circle).ellipse((0, 0, legacy * 4 - 1, legacy * 4 - 1), fill=255)
    r.putalpha(ImageChops.multiply(r.getchannel("A"), circle.resize((legacy, legacy), Image.LANCZOS)))
    save(r, folder, "ic_launcher_round.png")
    # adaptive layers are 108dp; the launcher shows the middle 72dp, which
    # covers the maskable icon's safe zone
    fg = round(108 * s)
    save(maskable.resize((fg, fg), Image.LANCZOS), folder, "ic_launcher_foreground.png")
    save(mono.resize((fg, fg), Image.LANCZOS), folder, "ic_launcher_monochrome.png")

# Splash (Android 6–11): full logo with the wordmark, 200dp square.
logo = Image.open(WEB / "branding" / "lunatv-logo.png").convert("RGBA")
save(logo.resize((600, 600), Image.LANCZOS), "drawable-xxhdpi", "splash_logo.png")

# Android 12+ system splash icon: 288dp canvas, artwork inside the 192dp circle.
mark = Image.open(WEB / "branding" / "lunatv-mark.webp").convert("RGBA")
canvas = Image.new("RGBA", (864, 864), (0, 0, 0, 0))
w = 470
h = round(mark.height * w / mark.width)
canvas.alpha_composite(mark.resize((w, h), Image.LANCZOS), ((864 - w) // 2, (864 - h) // 2))
save(canvas, "drawable-xxhdpi", "splash_icon.png")
print("icons written to", RES)
