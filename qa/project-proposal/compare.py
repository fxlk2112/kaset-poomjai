"""Normalize reference/capture pairs for local visual review; no app data writes."""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw

HERE = Path(__file__).resolve().parent
REFERENCES = Path('C:/Users/USER/.codex/generated_images/01a207c1-667e-7670-86ba-5df7a70aacb0')
PAIRS = {
    'proposal': 'exec-6221ab14-8b3f-4220-ba44-0c173c21a436.png',
    'tasks': 'exec-8a2385e3-907e-4c52-8270-fcdeb5a09321.png',
    'project': 'exec-201b487f-40b0-48a6-9a38-39c9a99ccc43.png',
    'entry': 'exec-51bbdd38-f005-4a3d-bd1b-039753657179.png',
    'report': 'exec-ad2a35a9-799f-4075-9d07-6e710efc654a.png',
}
for name, filename in PAIRS.items():
    ref = Image.open(REFERENCES / filename).convert('RGB')
    actual = Image.open(HERE / (name + '-desktop.png')).convert('RGB')
    canvas = Image.new('RGB', (1560, 560), '#e6eeea')
    draw = ImageDraw.Draw(canvas)
    for x, img, title in [(0, ref, 'APPROVED REFERENCE'), (780, actual, 'IMPLEMENTATION')]:
        normalized = ImageOps.contain(img, (780, 530))
        canvas.paste(normalized, (x, 30))
        draw.text((x + 12, 8), title, fill='#123d30')
    canvas.save(HERE / ('comparison-' + name + '.jpg'), quality=93)
    print(name, 'reference', ref.size, 'capture', actual.size)

# Readable focal comparison for the material form and report editor.
for name, ref_box, actual_box in [
    ('entry', (220, 195, 1000, 940), (260, 210, 1020, 950)),
    ('report', (220, 242, 748, 940), (260, 292, 775, 1000)),
]:
    ref = Image.open(REFERENCES / PAIRS[name]).convert('RGB').crop(ref_box)
    actual = Image.open(HERE / (name + '-desktop.png')).convert('RGB').crop(actual_box)
    canvas = Image.new('RGB', (1400, 990), '#e6eeea')
    for x, img in [(0, ref), (700, actual)]:
        canvas.paste(ImageOps.contain(img, (700, 960)), (x, 30))
    ImageDraw.Draw(canvas).text((12, 8), 'REFERENCE (left) / IMPLEMENTATION (right)', fill='#123d30')
    canvas.save(HERE / ('comparison-' + name + '-focus.jpg'), quality=93)
