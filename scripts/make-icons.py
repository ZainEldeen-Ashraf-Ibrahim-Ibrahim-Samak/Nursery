"""Convert the branding/icon.png (currently a misnamed JPEG) into a real PNG
and a multi-resolution Windows .ico used by electron-builder."""
from PIL import Image
import os

base = os.path.join(os.path.dirname(__file__), "..", "assets")

for sub in ("branding", "default-branding"):
    src = os.path.join(base, sub, "icon.png")
    if not os.path.exists(src):
        continue
    img = Image.open(src).convert("RGBA")
    img.resize((256, 256), Image.LANCZOS).save(
        os.path.join(base, sub, "icon.png"), format="PNG"
    )
    print("wrote real PNG:", os.path.normpath(os.path.join(base, sub, "icon.png")))

ico_src = Image.open(os.path.join(base, "branding", "icon.png")).convert("RGBA")
sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
ico_src.save(os.path.join(base, "branding", "icon.ico"), format="ICO", sizes=sizes)
print("wrote icon.ico with sizes", sizes)
