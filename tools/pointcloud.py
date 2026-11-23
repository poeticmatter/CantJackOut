"""
Turns a picture into the glowing point-cloud mesh the game draws for its characters.

    python tools/pointcloud.py portrait ReferenceImages/Portrait.jpg src/assets/vesna.json
    python tools/pointcloud.py moth src/assets/moth.json

Points are sampled most densely where the picture has detail (eyes, lips, tattoo lines), joined
by a Delaunay triangulation, and written as compact integer arrays. Source photos never leave the
machine: only the JSON ships. Add --preview some.png to see what was sampled.
"""
import argparse
import json
import math
from dataclasses import dataclass

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps
from scipy.spatial import Delaunay

COORD_SCALE = 1000
WORK_HEIGHT = 640
EDGE_LENGTH_LIMIT = 2.6
SOFTEN_RADIUS = 2.5
# How much tighter points pack on the strongest detail than on plain skin.
DETAIL_DENSITY = 3.2
# Extra detail weight around the eyes, nose and mouth, so a face reads at a glance.
FEATURE_BOOST = 1.5

REGION_NONE, REGION_JAW, REGION_UPPER_LIP, REGION_LEFT_EYE, REGION_RIGHT_EYE = 0, 1, 2, 3, 4


@dataclass
class Landmarks:
    """Feature positions in the source image's pixels, used for animation regions and depth."""
    face_center: tuple[float, float]
    face_radius: tuple[float, float]
    left_eye: tuple[float, float]
    right_eye: tuple[float, float]
    eye_radius: tuple[float, float]
    mouth: tuple[float, float]
    mouth_half_width: float
    chin_y: float
    nose_tip: tuple[float, float]


# The owner's portrait, traced by hand: head outline and neck, and where the features sit.
# Coordinates are pixels in the 3024 x 4032 source photo.
PORTRAIT_SCALE = 3024 / 1659
PORTRAIT_OUTLINE_DISPLAY = [
    (905, 532), (1010, 548), (1098, 598), (1160, 688), (1192, 800), (1200, 920), (1218, 975),
    (1228, 1060), (1208, 1160), (1176, 1232), (1150, 1320), (1112, 1392), (1062, 1440),
    (1048, 1500), (1066, 1585), (790, 1585), (800, 1490), (758, 1440), (700, 1382), (662, 1302),
    (640, 1232), (612, 1160), (598, 1060), (618, 978), (640, 920), (646, 800), (680, 690),
    (740, 600), (820, 552),
]
PORTRAIT_LANDMARKS_DISPLAY = Landmarks(
    face_center=(905, 1000), face_radius=(300, 520),
    left_eye=(762, 1030), right_eye=(1036, 1026), eye_radius=(70, 34),
    mouth=(905, 1338), mouth_half_width=95, chin_y=1452, nose_tip=(905, 1222),
)


def scaled(point, factor):
    return (point[0] * factor, point[1] * factor)


def portrait_landmarks() -> Landmarks:
    d, f = PORTRAIT_LANDMARKS_DISPLAY, PORTRAIT_SCALE
    return Landmarks(
        face_center=scaled(d.face_center, f), face_radius=scaled(d.face_radius, f),
        left_eye=scaled(d.left_eye, f), right_eye=scaled(d.right_eye, f), eye_radius=scaled(d.eye_radius, f),
        mouth=scaled(d.mouth, f), mouth_half_width=d.mouth_half_width * f, chin_y=d.chin_y * f,
        nose_tip=scaled(d.nose_tip, f),
    )


def load_portrait(path: str):
    photo = ImageOps.exif_transpose(Image.open(path)).convert('L')
    outline = [scaled(point, PORTRAIT_SCALE) for point in PORTRAIT_OUTLINE_DISPLAY]
    mask = Image.new('L', photo.size, 0)
    ImageDraw.Draw(mask).polygon(outline, fill=255)
    return photo, mask, outline, portrait_landmarks()


def draw_moth():
    """A moth with eye-spotted wings, drawn so its pattern gives the sampler detail to follow."""
    size = (1600, 1200)
    picture, mask = Image.new('L', size, 0), Image.new('L', size, 0)
    ink, shape = ImageDraw.Draw(picture), ImageDraw.Draw(mask)
    cx = size[0] / 2
    for side in (-1, 1):
        fore = [(cx, 420), (cx + side * 260, 180), (cx + side * 610, 120), (cx + side * 720, 260),
                (cx + side * 640, 520), (cx + side * 300, 640), (cx, 600)]
        hind = [(cx, 600), (cx + side * 330, 660), (cx + side * 560, 780), (cx + side * 520, 1010),
                (cx + side * 300, 1060), (cx + side * 120, 900), (cx, 760)]
        for wing in (fore, hind):
            shape.polygon(wing, fill=255)
            ink.polygon(wing, fill=90, outline=255)
        spot = (cx + side * 430, 340)
        for radius, tone in ((120, 230), (85, 40), (45, 255), (18, 30)):
            ink.ellipse([spot[0] - radius, spot[1] - radius, spot[0] + radius, spot[1] + radius], fill=tone)
        hind_spot = (cx + side * 360, 880)
        for radius, tone in ((70, 220), (40, 60), (16, 255)):
            ink.ellipse([hind_spot[0] - radius, hind_spot[1] - radius, hind_spot[0] + radius, hind_spot[1] + radius], fill=tone)
        for vein in range(5):
            angle = math.radians(-60 + vein * 25)
            end = (cx + side * 650 * math.cos(angle) * 0.95, 430 + 420 * math.sin(angle) * 0.75)
            ink.line([(cx + side * 40, 470), end], fill=200, width=6)
        antenna = [(cx + side * 20, 330), (cx + side * 90, 160), (cx + side * 200, 60)]
        ink.line(antenna, fill=255, width=8)
        shape.line(antenna, fill=255, width=40)
    body = [cx - 45, 300, cx + 45, 980]
    ink.ellipse(body, fill=240)
    shape.ellipse(body, fill=255)
    for ring in range(6):
        y = 620 + ring * 55
        ink.line([(cx - 40, y), (cx + 40, y)], fill=60, width=6)
    landmarks = Landmarks(face_center=(cx, 600), face_radius=(760, 560), left_eye=(-1e9, -1e9), right_eye=(-1e9, -1e9),
                          eye_radius=(1, 1), mouth=(-1e9, -1e9), mouth_half_width=1, chin_y=-1e9, nose_tip=(cx, 600))
    return picture, mask, None, landmarks


def tone_map(gray: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Brightness inside the mask stretched to 0..1, so shading reads on any photo."""
    inside = gray[mask > 0]
    low, high = np.percentile(inside, 2), np.percentile(inside, 98)
    return np.clip((gray - low) / max(1e-6, high - low), 0, 1)


def detail_map(gray: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Edge strength inside the mask, 0..1: where the eye goes, so where the points go.
    The picture is softened first so freckles and skin texture don't count as features."""
    softened = np.asarray(Image.fromarray(gray.astype(np.uint8)).filter(ImageFilter.GaussianBlur(SOFTEN_RADIUS)), dtype=float)
    levels = tone_map(softened, mask)
    gx = np.zeros_like(levels)
    gy = np.zeros_like(levels)
    gx[:, 1:-1] = levels[:, 2:] - levels[:, :-2]
    gy[1:-1, :] = levels[2:, :] - levels[:-2, :]
    edges = np.hypot(gx, gy)
    edges = np.asarray(Image.fromarray((np.clip(edges * 4, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2)), dtype=float) / 255
    edges[mask == 0] = 0
    return np.clip(edges / max(1e-6, np.percentile(edges[mask > 0], 97)), 0, 1)


def sample_points(detail: np.ndarray, mask: np.ndarray, base_spacing: float, rng: np.random.Generator):
    """Variable-density dart throwing: tighter spacing where there's more detail."""
    height, width = mask.shape
    cell = base_spacing / 2.5
    grid: dict[tuple[int, int], list[int]] = {}
    points, spacings = [], []
    for _ in range(int(width * height / (cell * cell) * 1.6)):
        x, y = rng.uniform(0, width), rng.uniform(0, height)
        if mask[int(y), int(x)] == 0:
            continue
        spacing = base_spacing / (1 + DETAIL_DENSITY * detail[int(y), int(x)] ** 1.1)
        gx, gy = int(x / cell), int(y / cell)
        reach = int(math.ceil(base_spacing / cell))
        if any(
            (points[other][0] - x) ** 2 + (points[other][1] - y) ** 2 < (min(spacing, spacings[other])) ** 2
            for dx in range(-reach, reach + 1) for dy in range(-reach, reach + 1)
            for other in grid.get((gx + dx, gy + dy), ())
        ):
            continue
        grid.setdefault((gx, gy), []).append(len(points))
        points.append((x, y))
        spacings.append(spacing)
    return np.array(points), np.array(spacings)


def outline_points(outline, factor: float, spacing: float):
    points = []
    for start, end in zip(outline, outline[1:] + outline[:1]):
        a, b = np.array(start) * factor, np.array(end) * factor
        steps = max(1, int(np.linalg.norm(b - a) / spacing))
        points.extend(a + (b - a) * step / steps for step in range(steps))
    return np.array(points)


def mesh_edges(points: np.ndarray, spacings: np.ndarray, mask: np.ndarray):
    triangles = Delaunay(points).simplices
    edges = set()
    for triangle in triangles:
        for a, b in ((triangle[0], triangle[1]), (triangle[1], triangle[2]), (triangle[2], triangle[0])):
            edges.add((min(a, b), max(a, b)))
    kept = []
    for a, b in edges:
        length = np.linalg.norm(points[a] - points[b])
        mid = (points[a] + points[b]) / 2
        if length > EDGE_LENGTH_LIMIT * max(spacings[a], spacings[b]):
            continue
        if mask[min(mask.shape[0] - 1, int(mid[1])), min(mask.shape[1] - 1, int(mid[0]))] == 0:
            continue
        kept.append((int(a), int(b)))
    return kept


def region_of(x: float, y: float, marks: Landmarks) -> int:
    def inside(center, radius):
        return ((x - center[0]) / radius[0]) ** 2 + ((y - center[1]) / radius[1]) ** 2 <= 1

    if inside(marks.left_eye, marks.eye_radius):
        return REGION_LEFT_EYE
    if inside(marks.right_eye, marks.eye_radius):
        return REGION_RIGHT_EYE
    is_mouth_wide = abs(x - marks.mouth[0]) <= marks.mouth_half_width * 1.5
    if is_mouth_wide and marks.mouth[1] <= y <= marks.chin_y + marks.face_radius[1] * 0.06:
        return REGION_JAW
    if abs(x - marks.mouth[0]) <= marks.mouth_half_width and marks.mouth[1] - marks.face_radius[1] * 0.05 <= y < marks.mouth[1]:
        return REGION_UPPER_LIP
    return REGION_NONE


def depth_of(x: float, y: float, marks: Landmarks) -> float:
    """A rough egg-shaped head with a nose, enough for a slight turn to read as 3D."""
    dx = (x - marks.face_center[0]) / marks.face_radius[0]
    dy = (y - marks.face_center[1]) / marks.face_radius[1]
    shell = math.sqrt(max(0.0, 1 - dx * dx - dy * dy))
    nose = math.exp(-(((x - marks.nose_tip[0]) / (marks.face_radius[0] * 0.16)) ** 2 + ((y - marks.nose_tip[1]) / (marks.face_radius[1] * 0.14)) ** 2))
    return min(1.0, shell * 0.85 + nose * 0.25)


def build(picture: Image.Image, mask: Image.Image, outline, marks: Landmarks, point_target: int, seed: int):
    factor = WORK_HEIGHT / picture.size[1] if outline is None else None
    box = mask.getbbox()
    margin = 20
    box = (max(0, box[0] - margin), max(0, box[1] - margin), min(picture.size[0], box[2] + margin), min(picture.size[1], box[3] + margin))
    factor = WORK_HEIGHT / (box[3] - box[1])
    size = (int((box[2] - box[0]) * factor), WORK_HEIGHT)
    gray = np.asarray(picture.crop(box).resize(size, Image.LANCZOS), dtype=float)
    work_mask = np.asarray(mask.crop(box).resize(size, Image.NEAREST))
    detail = np.maximum(detail_map(gray, work_mask), feature_emphasis(size, box, factor, marks) * detail_map(gray, work_mask) * FEATURE_BOOST)
    detail = np.clip(detail, 0, 1)
    tone = tone_map(gray, work_mask)
    area = float((work_mask > 0).sum())
    spacing = math.sqrt(area / point_target) * 1.25
    rng = np.random.default_rng(seed)
    points, spacings = sample_points(detail, work_mask, spacing, rng)
    if outline is not None:
        rim = outline_points([(x - box[0], y - box[1]) for x, y in outline], factor, spacing * 0.7)
        points = np.vstack([points, rim])
        spacings = np.concatenate([spacings, np.full(len(rim), spacing * 0.7)])
    edges = mesh_edges(points, spacings, np.asarray(work_mask.copy()) if outline is None else _dilated(work_mask))
    return points, edges, detail, tone, size, box, factor


def feature_emphasis(size, box, factor, marks: Landmarks) -> np.ndarray:
    """1 around the eyes, brows, nose and mouth, fading to 0: the features a face is read by."""
    ys, xs = np.mgrid[0:size[1], 0:size[0]]
    source_x, source_y = xs / factor + box[0], ys / factor + box[1]
    emphasis = np.zeros(size[::-1])
    eye_w, eye_h = marks.eye_radius[0] * 1.6, marks.eye_radius[1] * 3.2
    spots = [
        (marks.left_eye, (eye_w, eye_h)), (marks.right_eye, (eye_w, eye_h)),
        (marks.nose_tip, (marks.face_radius[0] * 0.22, marks.face_radius[1] * 0.12)),
        (marks.mouth, (marks.mouth_half_width * 1.4, marks.face_radius[1] * 0.09)),
    ]
    for center, (rx, ry) in spots:
        distance = ((source_x - center[0]) / rx) ** 2 + ((source_y - center[1]) / ry) ** 2
        emphasis = np.maximum(emphasis, np.exp(-distance))
    return emphasis


def _dilated(mask: np.ndarray) -> np.ndarray:
    return np.asarray(Image.fromarray(mask).filter(ImageFilter.MaxFilter(5)))


def point_brightness(points, detail, tone, size) -> list[float]:
    """Lit skin glows, shadows sink, and feature lines glow hardest, like a sculpted light mesh."""
    values = []
    for x, y in points:
        row, column = min(size[1] - 1, int(y)), min(size[0] - 1, int(x))
        values.append(min(1.0, 0.15 + 0.55 * float(tone[row, column]) ** 1.2 + 0.4 * float(detail[row, column])))
    return values


def encode(points, edges, brightness, size, box, factor, marks: Landmarks):
    cx, cy = (marks.face_center[0] - box[0]) * factor, (marks.face_center[1] - box[1]) * factor
    unit = size[1] / 2
    flat = []
    for (x, y), glow in zip(points, brightness):
        source_x, source_y = x / factor + box[0], y / factor + box[1]
        flat.extend([
            round((x - cx) / unit * COORD_SCALE), round((y - cy) / unit * COORD_SCALE),
            round(depth_of(source_x, source_y, marks) * COORD_SCALE), round(glow * 100),
            region_of(source_x, source_y, marks),
        ])
    return {'pointStride': 5, 'coordScale': COORD_SCALE, 'points': flat, 'edges': [index for edge in edges for index in edge]}


def save_preview(path: str, points, edges, brightness, size):
    preview = Image.new('RGB', size, (6, 10, 28))
    draw = ImageDraw.Draw(preview)
    for a, b in edges:
        glow = (brightness[a] + brightness[b]) / 2
        draw.line([tuple(points[a]), tuple(points[b])], fill=(int(20 + 60 * glow), int(50 + 150 * glow), int(90 + 160 * glow)), width=1)
    for (x, y), glow in zip(points, brightness):
        radius = 0.8 + 1.4 * glow
        draw.ellipse([x - radius, y - radius, x + radius, y + radius], fill=(int(80 + 170 * glow), int(140 + 115 * glow), 255))
    preview.save(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('kind', choices=['portrait', 'moth'])
    parser.add_argument('paths', nargs='+', help='portrait: SOURCE OUTPUT; moth: OUTPUT')
    parser.add_argument('--points', type=int, default=1900)
    parser.add_argument('--seed', type=int, default=7)
    parser.add_argument('--preview')
    args = parser.parse_args()
    if args.kind == 'portrait':
        source, output = args.paths
        picture, mask, outline, marks = load_portrait(source)
    else:
        (output,) = args.paths
        picture, mask, outline, marks = draw_moth()
    points, edges, detail, tone, size, box, factor = build(picture, mask, outline, marks, args.points, args.seed)
    brightness = point_brightness(points, detail, tone, size)
    with open(output, 'w', encoding='utf-8') as file:
        json.dump(encode(points, edges, brightness, size, box, factor, marks), file, separators=(',', ':'))
    if args.preview:
        save_preview(args.preview, points, edges, brightness, size)
    print(f'{len(points)} points, {len(edges)} edges -> {output}')


if __name__ == '__main__':
    main()
