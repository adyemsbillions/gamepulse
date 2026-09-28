"""
GamePulse brand asset generator.

Renders every static brand asset from the same geometry as
`src/components/brand/geometry.ts`, so the native splash / icons match the in-app mark.

    pip install cairosvg pillow shapely
    python scripts/brand/generate.py

Outputs (relative to the project root):
    assets/images/icon.png                    1024 app icon (iOS fallback, stores)
    assets/images/android-icon-foreground.png adaptive icon foreground (safe-zone fitted)
    assets/images/android-icon-background.png adaptive icon background
    assets/images/android-icon-monochrome.png Android 13 themed icon
    assets/images/splash-icon.png             native splash hand-off frame (ball only)
    assets/images/favicon.png                 web favicon
    assets/expo.icon/Assets/gamepulse-*.svg   iOS 26 Icon Composer layers
    assets/brand/*                            logo SVG/PNG lockups for marketing
"""
import io
import json
import math
import os

import cairosvg
from PIL import Image
from shapely.geometry import Point, Polygon

ROYAL = "#0E2F76"
DEEP = "#081D4D"
ICE = "#F4FEFF"
POWDER = "#A9C0E0"
PULSE = "#C6FF3D"

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
IMG = os.path.join(ROOT, "assets", "images")
BRAND = os.path.join(ROOT, "assets", "brand")
ICON_DIR = os.path.join(ROOT, "assets", "expo.icon")


# ---------------------------------------------------------------- geometry (mirrors geometry.ts)

def pentagon(cx, cy, r, rot_deg):
    return [
        (cx + r * math.cos(math.radians(rot_deg + 72 * k)), cy + r * math.sin(math.radians(rot_deg + 72 * k)))
        for k in range(5)
    ]


def pts(p):
    return " ".join(f"{x:.2f},{y:.2f}" for x, y in p)


def ball_svg(cx, cy, r, body=ICE, panel=ROYAL):
    """Clip-free football (patches pre-intersected with the circle) — safe for any SVG consumer."""
    seam = r * 0.075
    circle = Point(cx, cy).buffer(r - seam, resolution=64)  # rim ring covers the outer seam band
    center = pentagon(cx, cy, r * 0.37, -90)
    out = [f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r:.2f}" fill="{body}"/>']
    shapes = [Polygon(center).buffer(seam / 2, join_style=1)]
    for k in range(5):
        ang = -90 + 72 * k
        a = math.radians(ang)
        patch = pentagon(cx + r * 0.97 * math.cos(a), cy + r * 0.97 * math.sin(a), r * 0.27, ang + 180)
        shapes.append(Polygon(patch).buffer(seam / 2, join_style=1).intersection(circle))
        (x1, y1), (x2, y2) = center[k], patch[0]
        out.append(
            f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke="{panel}" '
            f'stroke-width="{seam:.2f}" stroke-linecap="round"/>'
        )
    for s in shapes:
        out.append(f'<polygon points="{pts(list(s.exterior.coords))}" fill="{panel}"/>')
    return "\n".join(out)


def lockup(cx, cy, s, pulse=PULSE, body=ICE, panel=ROYAL, glow=True, arcs=True, uid="m"):
    """Trace → ball → arcs, centred on (cx, cy). `s` is the lockup size unit (= 100 in geometry.ts)."""
    r = s * 0.23
    trace_len = s * 0.5
    arc_out = r * 1.62 - r
    total = trace_len + 2 * r + (arc_out if arcs else 0)
    left = cx - total / 2
    bx = left + trace_len + r
    stroke = s * 0.05
    h = r * 1.15
    end = bx - r * 0.98
    w = end - left
    trace = [(0, 0), (w * .26, 0), (w * .36, -h * .3), (w * .46, h * .26), (w * .58, -h), (w * .7, h * .55), (w * .79, 0), (w, 0)]
    d = "M" + " L".join(f"{left + x:.2f} {cy + y:.2f}" for x, y in trace)
    out = []
    if glow:
        out.append(
            f'<defs><filter id="{uid}g" x="-30%" y="-60%" width="160%" height="220%">'
            f'<feGaussianBlur stdDeviation="{s * 0.022:.2f}"/></filter></defs>'
            f'<path d="{d}" fill="none" stroke="{pulse}" stroke-opacity="0.6" stroke-width="{stroke:.2f}" '
            f'stroke-linecap="round" stroke-linejoin="round" filter="url(#{uid}g)"/>'
        )
    out.append(f'<path d="{d}" fill="none" stroke="{pulse}" stroke-width="{stroke:.2f}" stroke-linecap="round" stroke-linejoin="round"/>')
    if arcs:
        for rr, span_deg, wf in ((r * 1.3, 38, 0.8), (r * 1.62, 30, 0.5)):
            sp = math.radians(span_deg)
            x1, y1 = bx + rr * math.cos(-sp), cy + rr * math.sin(-sp)
            x2, y2 = bx + rr * math.cos(sp), cy + rr * math.sin(sp)
            out.append(
                f'<path d="M{x1:.2f} {y1:.2f} A{rr:.2f} {rr:.2f} 0 0 1 {x2:.2f} {y2:.2f}" fill="none" '
                f'stroke="{pulse}" stroke-width="{stroke * wf:.2f}" stroke-linecap="round"/>'
            )
    out.append(ball_svg(bx, cy, r, body, panel))
    return "\n".join(out)


def gradient_bg(w, h, uid="bg"):
    return (
        f'<defs><radialGradient id="{uid}" cx="0.5" cy="0.42" r="0.75">'
        f'<stop offset="0" stop-color="#1B4AA8"/><stop offset="0.55" stop-color="{ROYAL}"/>'
        f'<stop offset="1" stop-color="{DEEP}"/></radialGradient></defs>'
        f'<rect width="{w}" height="{h}" fill="url(#{uid})"/>'
    )


FONTS = os.path.join(ROOT, "node_modules", "@expo-google-fonts", "poppins")


def _advance(text, size, weight, spacing):
    from PIL import ImageFont

    f = ImageFont.truetype(os.path.join(FONTS, weight, f"Poppins_{weight}.ttf"), size)
    return f.getlength(text) + spacing * len(text)


def text_runs(runs, cx, y, size, weight="800ExtraBold", spacing_em=0.18):
    """Centred letter-spaced text built from explicitly positioned runs (renderer-proof)."""
    ls = size * spacing_em
    widths = [_advance(t, size, weight, ls) for t, _ in runs]
    total = sum(widths) - ls  # no trailing space after the last letter
    x = cx - total / 2
    fw = {"800ExtraBold": 800, "600SemiBold": 600}[weight]
    out = []
    for (t, color), w in zip(runs, widths):
        out.append(
            f'<text x="{x:.1f}" y="{y}" font-family="Poppins" font-weight="{fw}" font-size="{size}" '
            f'letter-spacing="{ls:.1f}" fill="{color}">{t}</text>'
        )
        x += w
    return "".join(out)


def wordmark(cx, y, size, color=ICE, accent=PULSE):
    return text_runs([("GAME", color), ("PULSE", accent)], cx, y, size)


# ---------------------------------------------------------------- output helpers

def svg(w, h, body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{body}</svg>'


def png(path, doc, w, h=None):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    cairosvg.svg2png(bytestring=doc.encode(), write_to=path, output_width=w, output_height=h or w)


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write(text)


def monochrome(path, doc, size):
    """White silhouette with the ball's panels knocked out (Android themed icons)."""
    buf = io.BytesIO()
    cairosvg.svg2png(bytestring=doc.encode(), write_to=buf, output_width=size, output_height=size)
    im = Image.open(buf).convert("RGBA")
    px = im.load()
    for yy in range(size):
        for xx in range(size):
            r_, g_, b_, a_ = px[xx, yy]
            lum = (r_ + g_ + b_) / 765
            px[xx, yy] = (255, 255, 255, int(a_ * lum))
    im.save(path)


# ---------------------------------------------------------------- assets

def main():
    S = 1024

    # App icon (square; iOS rounds it, stores use it as-is)
    png(os.path.join(IMG, "icon.png"), svg(S, S, gradient_bg(S, S) + lockup(S / 2, S / 2, 740)), S)

    # Android adaptive icon — content kept inside the 66% safe circle
    png(os.path.join(IMG, "android-icon-background.png"), svg(S, S, gradient_bg(S, S)), S)
    png(os.path.join(IMG, "android-icon-foreground.png"), svg(S, S, lockup(S / 2, S / 2, 540)), S)
    monochrome(
        os.path.join(IMG, "android-icon-monochrome.png"),
        svg(S, S, lockup(S / 2, S / 2, 540, pulse="#FFFFFF", body="#FFFFFF", panel="#000000", glow=False)),
        S,
    )

    # Native splash: ball only, edge to edge. app.json imageWidth (100) == NATIVE_BALL_DP in animated-splash.tsx
    png(os.path.join(IMG, "splash-icon.png"), svg(512, 512, ball_svg(256, 256, 256)), 512)

    # Favicon: ball + one pulse arc on a royal tile
    fav = (
        f'<rect width="64" height="64" rx="14" fill="{ROYAL}"/>'
        + f'<path d="M50 20 A21 21 0 0 1 50 44" fill="none" stroke="{PULSE}" stroke-width="4.5" stroke-linecap="round"/>'
        + ball_svg(29, 32, 19)
    )
    png(os.path.join(IMG, "favicon.png"), svg(64, 64, fav), 48)

    # iOS 26 Icon Composer bundle: background fill comes from icon.json, the mark is one layer
    write(os.path.join(ICON_DIR, "Assets", "gamepulse-mark.svg"), svg(S, S, lockup(S / 2, S / 2, 740, glow=False)))
    write(
        os.path.join(ICON_DIR, "icon.json"),
        json.dumps(
            {
                "fill": {"automatic-gradient": "extended-srgb:0.05490,0.18431,0.46275,1.00000"},
                "groups": [
                    {
                        "layers": [{"image-name": "gamepulse-mark.svg", "name": "gamepulse-mark"}],
                        "shadow": {"kind": "neutral", "opacity": 0.5},
                        "translucency": {"enabled": True, "value": 0.35},
                    }
                ],
                "supported-platforms": {"circles": ["watchOS"], "squares": "shared"},
            },
            indent=2,
        ),
    )

    # Marketing lockups
    write(os.path.join(BRAND, "gamepulse-mark.svg"), svg(760, 420, lockup(380, 210, 640)))
    png(os.path.join(BRAND, "gamepulse-mark.png"), svg(760, 420, lockup(380, 210, 640)), 1520, 840)
    full = (
        gradient_bg(1600, 900)
        + lockup(800, 380, 620)
        + wordmark(800, 640, 96)
        + text_runs([("FEEL EVERY MOMENT", POWDER)], 800, 712, 26, "600SemiBold", 0.35)
    )
    write(os.path.join(BRAND, "gamepulse-logo.svg"), svg(1600, 900, full))
    png(os.path.join(BRAND, "gamepulse-logo.png"), svg(1600, 900, full), 1600, 900)
    light = (
        f'<rect width="1600" height="900" fill="{ICE}"/>'
        + lockup(800, 380, 620, pulse="#2F63D6", body=ROYAL, panel=ICE, glow=False)
        + wordmark(800, 640, 96, color=ROYAL, accent="#2F63D6")
    )
    png(os.path.join(BRAND, "gamepulse-logo-light.png"), svg(1600, 900, light), 1600, 900)
    print("brand assets written")


if __name__ == "__main__":
    main()
