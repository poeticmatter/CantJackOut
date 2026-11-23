"""
Turns a picture into the glowing mesh the game draws for its characters.

    python tools/pointcloud.py portrait ReferenceImages/Portrait.jpg src/assets/vesna.json
    python tools/pointcloud.py moth src/assets/moth.json

The look is a lit 3D scan made of light: an even triangulation whose brightness comes from the
picture's own shading (smoothed so skin texture disappears and the form stays), with creases such
as eyelids, lips and nostrils traced brighter, and a rim of light around the silhouette.
Source photos never leave the machine: only the JSON ships. Add --preview some.png to see the result.
"""
import argparse
import json
import math
from dataclasses import dataclass

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps
from scipy.ndimage import distance_transform_edt, gaussian_filter
from scipy.spatial import Delaunay

COORD_SCALE = 1000
WORK_HEIGHT = 900
EDGE_LENGTH_LIMIT = 2.2
# How much tighter points pack around the eyes, nose and mouth than elsewhere.
FEATURE_DENSITY = 1.6
# Scales, in work-image pixels, that separate form (broad shading) from creases and from skin texture.
TEXTURE_BLUR = 2.2
CREASE_BLUR = (2.0, 6.0)
FORM_BLUR = 3.5
LOCAL_CONTRAST_BLUR = 80
RIM_WIDTH = 5.0
# The soft glow under the mesh: the light map blurred and shrunk to this many rows, and how bright it is.
HAZE_STRENGTH = 0.35
HAZE_ROWS = 72
HAZE_BLUR = 10

REGION_NONE, REGION_JAW, REGION_UPPER_LIP, REGION_LEFT_EYE, REGION_RIGHT_EYE = 0, 1, 2, 3, 4


@dataclass
class Landmarks:
    """Feature positions in the source picture's pixels, for animation regions, density and depth."""
    face_center: tuple[float, float]
    face_radius: tuple[float, float]
    left_eye: tuple[float, float]
    right_eye: tuple[float, float]
    eye_radius: tuple[float, float]
    mouth: tuple[float, float]
    mouth_half_width: float
    chin_y: float
    nose_tip: tuple[float, float]
    # Below this line the picture fades out, like shoulders dissolving into the dark.
    fade_start_y: float
    fade_end_y: float


@dataclass
class Bump:
    """A Gaussian hill (or, with negative height, a hollow) on the head's depth, in source pixels."""
    center: tuple[float, float]
    radius: tuple[float, float]
    height: float


@dataclass
class Sculpt:
    """What turns a flat, front-lit photo into a lit 3D form: a depth model, traced contours, and
    the line above which the photo's own lines (the scalp tattoo) are kept."""
    bumps: list[Bump]
    contours: list['Contour']
    sparks: list[tuple[float, float]]
    photo_lines_above_y: float


@dataclass
class Source:
    picture: Image.Image
    mask: Image.Image
    marks: Landmarks
    sculpt: Sculpt | None


# The owner's portrait, traced from a gridded crop. Pixels in the 3024 x 4032 source photo.
PORTRAIT_OUTLINE = [
    (1650, 978), (1790, 995), (1915, 1045), (2020, 1130), (2095, 1240), (2140, 1370), (2160, 1520),
    (2172, 1650), (2192, 1690), (2196, 1760), (2185, 1850), (2180, 1960), (2165, 2090), (2125, 2260),
    (2060, 2420), (1985, 2540), (1905, 2622), (1870, 2660), (1880, 2780), (1900, 2900),
    (1400, 2900), (1420, 2780), (1440, 2660), (1395, 2620), (1320, 2530), (1255, 2400), (1215, 2250),
    (1190, 2100), (1170, 1960), (1150, 1800), (1140, 1650), (1145, 1500), (1170, 1360), (1220, 1235),
    (1300, 1130), (1400, 1050), (1520, 995),
]
PORTRAIT_LANDMARKS = Landmarks(
    face_center=(1655, 1820), face_radius=(520, 840),
    left_eye=(1402, 1886), right_eye=(1858, 1864), eye_radius=(105, 42),
    mouth=(1640, 2465), mouth_half_width=175, chin_y=2645, nose_tip=(1618, 2240),
    fade_start_y=2680, fade_end_y=2900,
)


def ellipse(center, radius, steps=28):
    return [(center[0] + radius[0] * math.cos(2 * math.pi * k / steps), center[1] + radius[1] * math.sin(2 * math.pi * k / steps)) for k in range(steps + 1)]


@dataclass
class Contour:
    points: list[tuple[float, float]]
    glow: float


# Traced from gridded close-ups of the portrait: eyelids, creases, irises, brows, nose, lips.
PORTRAIT_CONTOURS = [
    Contour([(1299, 1905), (1335, 1885), (1380, 1867), (1425, 1860), (1470, 1864), (1515, 1875), (1547, 1894)], 0.95),
    Contour([(1299, 1905), (1362, 1909), (1425, 1910), (1488, 1905), (1547, 1894)], 0.6),
    Contour([(1320, 1872), (1353, 1853), (1425, 1840), (1497, 1849), (1542, 1871)], 0.45),
    Contour(ellipse((1416, 1884), (20, 20), steps=14), 0.5),
    Contour([(1736, 1894), (1776, 1858), (1830, 1842), (1884, 1840), (1938, 1849), (1983, 1876)], 0.95),
    Contour([(1736, 1894), (1776, 1900), (1848, 1907), (1920, 1900), (1983, 1876)], 0.6),
    Contour([(1758, 1835), (1848, 1822), (1938, 1828), (1992, 1853)], 0.45),
    Contour(ellipse((1872, 1865), (20, 20), steps=14), 0.5),
    Contour([(1227, 1871), (1290, 1835), (1362, 1815), (1434, 1810), (1497, 1821), (1524, 1835)], 0.7),
    Contour([(1731, 1785), (1812, 1772), (1902, 1777), (1992, 1795), (2064, 1821)], 0.7),
    Contour([(1530, 2150), (1504, 2192), (1511, 2237), (1537, 2267), (1575, 2271), (1627, 2290)], 0.75),
    Contour([(1725, 2150), (1759, 2192), (1755, 2237), (1725, 2264), (1687, 2267), (1627, 2290)], 0.75),
    Contour([(1455, 2441), (1537, 2451), (1635, 2471), (1725, 2459), (1830, 2455)], 0.95),
    Contour([(1500, 2470), (1560, 2495), (1635, 2504), (1710, 2495), (1785, 2470)], 0.45),
]
# Single bright points: the catchlights that make the eyes look back at you.
PORTRAIT_SPARKS = [(1408, 1878), (1864, 1858)]

PORTRAIT_BUMPS = [
    Bump((1402, 1886), (115, 70), -0.16), Bump((1858, 1866), (115, 70), -0.16),
    Bump((1380, 1815), (170, 45), 0.07), Bump((1890, 1795), (170, 45), 0.07),
    Bump((1627, 2010), (55, 170), 0.12), Bump((1627, 2200), (85, 80), 0.18),
    Bump((1525, 2215), (55, 50), 0.06), Bump((1735, 2215), (55, 50), 0.06),
    Bump((1385, 2085), (150, 110), 0.07), Bump((1890, 2065), (150, 110), 0.07),
    Bump((1640, 2470), (200, 65), 0.07), Bump((1640, 2455), (190, 9), -0.04),
    Bump((1635, 2585), (140, 85), 0.07), Bump((1635, 2537), (90, 14), -0.03),
    Bump((1190, 1760), (90, 200), -0.06), Bump((2135, 1740), (90, 200), -0.06),
]


def smooth_outline(points, samples_per_segment=12):
    """Catmull-Rom through the traced points, so the silhouette has no corners."""
    closed = points + points[:3]
    result = []
    for index in range(len(points)):
        p0, p1, p2, p3 = (np.array(closed[index + offset], dtype=float) for offset in range(4))
        for step in range(samples_per_segment):
            t = step / samples_per_segment
            result.append(tuple(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)))
    return result


def load_portrait(path: str) -> Source:
    photo = ImageOps.exif_transpose(Image.open(path)).convert('L')
    mask = Image.new('L', photo.size, 0)
    ImageDraw.Draw(mask).polygon(smooth_outline(PORTRAIT_OUTLINE), fill=255)
    return Source(photo, mask, PORTRAIT_LANDMARKS, Sculpt(PORTRAIT_BUMPS, PORTRAIT_CONTOURS, PORTRAIT_SPARKS, photo_lines_above_y=1660))


def draw_moth() -> Source:
    """A moth with eye-spotted wings, drawn so its pattern gives the mesh something to light."""
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
            ink.polygon(wing, fill=110, outline=255)
        for center, rings in (((cx + side * 430, 340), ((120, 230), (85, 40), (45, 255), (18, 30))),
                              ((cx + side * 360, 880), ((70, 220), (40, 60), (16, 255)))):
            for radius, tone in rings:
                ink.ellipse([center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius], fill=tone)
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
    off_canvas = (-1e9, -1e9)
    marks = Landmarks(face_center=(cx, 600), face_radius=(760, 560), left_eye=off_canvas, right_eye=off_canvas,
                      eye_radius=(1, 1), mouth=off_canvas, mouth_half_width=1, chin_y=-1e9, nose_tip=(cx, 600),
                      fade_start_y=1e9, fade_end_y=1e9 + 1)
    return Source(picture, mask, marks, sculpt=None)


@dataclass
class Work:
    """The source cropped to its mask and scaled to WORK_HEIGHT, with the maps the mesh is lit by."""
    box: tuple[int, int, int, int]
    factor: float
    mask: np.ndarray
    light: np.ndarray
    features: np.ndarray

    def to_source(self, x: float, y: float) -> tuple[float, float]:
        return x / self.factor + self.box[0], y / self.factor + self.box[1]


def normalized(values: np.ndarray, mask: np.ndarray, low=2.0, high=98.0) -> np.ndarray:
    inside = values[mask]
    bottom, top = np.percentile(inside, low), np.percentile(inside, high)
    return np.clip((values - bottom) / max(1e-6, top - bottom), 0, 1)


def photo_lines(gray: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Mid-scale dark lines in the photo (creases, tattoo linework), with skin texture blurred away."""
    clean = gaussian_filter(gray, TEXTURE_BLUR)
    crease = gaussian_filter(clean, CREASE_BLUR[1]) - gaussian_filter(clean, CREASE_BLUR[0])
    return normalized(np.clip(crease, 0, None), mask, low=50, high=99.5)


def photo_form(gray: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Broad shading straight from the picture, for sources without a sculpted depth model."""
    form = gaussian_filter(gaussian_filter(gray, TEXTURE_BLUR), FORM_BLUR)
    return normalized(form - 0.55 * gaussian_filter(form, LOCAL_CONTRAST_BLUR), mask) ** 1.4


def sculpted_light(source_x: np.ndarray, source_y: np.ndarray, marks: Landmarks, bumps: list[Bump], factor: float) -> np.ndarray:
    """Lights an egg-shaped head plus bumps from the upper left, with a rim where it turns away."""
    u = (source_x - marks.face_center[0]) / marks.face_radius[0]
    v = (source_y - marks.face_center[1]) / marks.face_radius[1]
    depth = np.sqrt(np.clip(1 - u * u - v * v, 0, None)) * 0.9
    for bump in bumps:
        depth = depth + bump.height * np.exp(-(((source_x - bump.center[0]) / bump.radius[0]) ** 2 + ((source_y - bump.center[1]) / bump.radius[1]) ** 2))
    depth_pixels = depth * marks.face_radius[0] * factor
    gy, gx = np.gradient(gaussian_filter(depth_pixels, 1.5))
    normal = np.stack([-gx, -gy, np.ones_like(gx)])
    normal /= np.linalg.norm(normal, axis=0)
    key = np.array([-0.45, -0.55, 0.7])
    key /= np.linalg.norm(key)
    lambert = np.clip(np.tensordot(key, normal, axes=1), 0, 1)
    rim = np.clip(1 - normal[2], 0, 1) ** 2.2
    return np.clip(0.06 + 0.75 * lambert ** 1.3 + 0.9 * rim, 0, 1.2)


def prepare(source: Source) -> Work:
    margin = 12
    left, top, right, bottom = source.mask.getbbox()
    box = (max(0, left - margin), max(0, top - margin), min(source.picture.size[0], right + margin), min(source.picture.size[1], bottom + margin))
    factor = WORK_HEIGHT / (box[3] - box[1])
    size = (int((box[2] - box[0]) * factor), WORK_HEIGHT)
    gray = np.asarray(source.picture.crop(box).resize(size, Image.LANCZOS), dtype=float)
    mask = np.asarray(source.mask.crop(box).resize(size, Image.NEAREST)) > 0
    ys, xs = np.mgrid[0:size[1], 0:size[0]]
    source_x, source_y = xs / factor + box[0], ys / factor + box[1]
    silhouette = np.exp(-distance_transform_edt(mask) / RIM_WIDTH)
    lines = photo_lines(gray, mask)
    if source.sculpt is None:
        light = 0.1 + 0.62 * photo_form(gray, mask) + 0.75 * np.maximum(lines, silhouette)
        features = np.zeros(mask.shape)
    else:
        scalp = np.clip((source.sculpt.photo_lines_above_y - source_y) / 120, 0, 1)
        tattoo = scalp * np.clip(lines * 1.6 - 0.25, 0, 1)
        light = sculpted_light(source_x, source_y, source.marks, source.sculpt.bumps, factor) * (1 - 0.35 * scalp)
        light = light + 0.12 * lines + 1.1 * tattoo + 0.8 * silhouette
        features = np.maximum(feature_emphasis(source_x, source_y, source.marks), tattoo)
    fade = np.clip((source.marks.fade_end_y - source_y) / (source.marks.fade_end_y - source.marks.fade_start_y), 0, 1)
    return Work(box=box, factor=factor, mask=mask, light=np.clip(light, 0, 1.25) * fade, features=features)


def feature_emphasis(source_x: np.ndarray, source_y: np.ndarray, marks: Landmarks) -> np.ndarray:
    """1 around the eyes, nose and mouth, fading to 0: where a face is read, so where detail goes."""
    spots = [
        (marks.left_eye, (marks.eye_radius[0] * 1.5, marks.eye_radius[1] * 2.6)),
        (marks.right_eye, (marks.eye_radius[0] * 1.5, marks.eye_radius[1] * 2.6)),
        (marks.nose_tip, (marks.face_radius[0] * 0.25, marks.face_radius[1] * 0.12)),
        (marks.mouth, (marks.mouth_half_width * 1.3, marks.face_radius[1] * 0.08)),
    ]
    emphasis = np.zeros(source_x.shape)
    for center, (rx, ry) in spots:
        emphasis = np.maximum(emphasis, np.exp(-(((source_x - center[0]) / rx) ** 2 + ((source_y - center[1]) / ry) ** 2)))
    return emphasis


def sample_points(work: Work, spacing: float, rng: np.random.Generator) -> np.ndarray:
    """Blue-noise dart throwing: an even mesh, a little finer where the features are."""
    height, width = work.mask.shape
    cell = spacing / FEATURE_DENSITY / math.sqrt(2)
    grid: dict[tuple[int, int], list[int]] = {}
    points: list[tuple[float, float]] = []
    reach = int(math.ceil(spacing / cell))
    for _ in range(int(width * height / (cell * cell) * 1.8)):
        x, y = rng.uniform(0, width), rng.uniform(0, height)
        if not work.mask[int(y), int(x)]:
            continue
        local = spacing / (1 + (FEATURE_DENSITY - 1) * work.features[int(y), int(x)])
        gx, gy = int(x / cell), int(y / cell)
        neighbours = (other for dx in range(-reach, reach + 1) for dy in range(-reach, reach + 1) for other in grid.get((gx + dx, gy + dy), ()))
        if any((points[other][0] - x) ** 2 + (points[other][1] - y) ** 2 < local * local for other in neighbours):
            continue
        grid.setdefault((gx, gy), []).append(len(points))
        points.append((x, y))
    return np.array(points)


def outline_points(mask: np.ndarray, spacing: float) -> np.ndarray:
    """Points along the silhouette, so the rim is a clean line rather than a ragged edge."""
    shrunk = np.asarray(Image.fromarray(mask.astype(np.uint8) * 255).filter(ImageFilter.MinFilter(3))) > 0
    ys, xs = np.nonzero(mask & ~shrunk)
    chosen: list[tuple[float, float]] = []
    for x, y in zip(xs, ys):
        if all((x - cx) ** 2 + (y - cy) ** 2 >= spacing * spacing for cx, cy in chosen):
            chosen.append((float(x), float(y)))
    return np.array(chosen)


def contour_points(work: Work, contours, spacing: float) -> tuple[np.ndarray, list[tuple[int, int]], list[float]]:
    """Points every so often along each traced contour, the edges that join them in order, and their glow."""
    points: list[tuple[float, float]] = []
    edges: list[tuple[int, int]] = []
    glow: list[float] = []
    for contour in contours:
        work_line = [((x - work.box[0]) * work.factor, (y - work.box[1]) * work.factor) for x, y in contour.points]
        start = len(points)
        for (ax, ay), (bx, by) in zip(work_line, work_line[1:]):
            steps = max(1, int(math.hypot(bx - ax, by - ay) / spacing))
            points.extend((ax + (bx - ax) * k / steps, ay + (by - ay) * k / steps) for k in range(steps))
        points.append(work_line[-1])
        edges.extend((index, index + 1) for index in range(start, len(points) - 1))
        glow.extend([contour.glow] * (len(points) - start))
    return np.array(points), edges, glow


def clear_around(points: np.ndarray, keep_out: np.ndarray, distance: float) -> np.ndarray:
    """Drops mesh points that crowd a contour, so contour lines stay crisp."""
    if len(keep_out) == 0:
        return points
    nearest = np.min(np.linalg.norm(points[:, None, :] - keep_out[None, :, :], axis=2), axis=1)
    return points[nearest >= distance]


def mesh_edges(points: np.ndarray, mask: np.ndarray, spacing: float) -> list[tuple[int, int]]:
    edges = set()
    for triangle in Delaunay(points).simplices:
        for a, b in ((triangle[0], triangle[1]), (triangle[1], triangle[2]), (triangle[2], triangle[0])):
            edges.add((int(min(a, b)), int(max(a, b))))
    grown = np.asarray(Image.fromarray(mask.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(5))) > 0
    kept = []
    for a, b in edges:
        mid = (points[a] + points[b]) / 2
        if np.linalg.norm(points[a] - points[b]) > EDGE_LENGTH_LIMIT * spacing:
            continue
        if not grown[min(mask.shape[0] - 1, int(mid[1])), min(mask.shape[1] - 1, int(mid[0]))]:
            continue
        kept.append((a, b))
    return kept


def region_of(x: float, y: float, marks: Landmarks) -> int:
    def inside(center, radius):
        return ((x - center[0]) / radius[0]) ** 2 + ((y - center[1]) / radius[1]) ** 2 <= 1

    if inside(marks.left_eye, (marks.eye_radius[0] * 1.1, marks.eye_radius[1] * 1.2)):
        return REGION_LEFT_EYE
    if inside(marks.right_eye, (marks.eye_radius[0] * 1.1, marks.eye_radius[1] * 1.2)):
        return REGION_RIGHT_EYE
    if abs(x - marks.mouth[0]) <= marks.mouth_half_width * 1.9 and marks.mouth[1] <= y <= marks.chin_y + marks.face_radius[1] * 0.05:
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


def build(source: Source, point_target: int, seed: int):
    work = prepare(source)
    spacing = math.sqrt(float(work.mask.sum()) / point_target) * 1.07
    mesh = sample_points(work, spacing, np.random.default_rng(seed))
    rim = outline_points(work.mask, spacing * 0.8)
    contours = source.sculpt.contours if source.sculpt is not None else []
    traced, traced_edges, traced_glow = contour_points(work, contours, spacing * 0.6)
    if len(traced) > 0:
        mesh = clear_around(mesh, traced, spacing * 0.55)
    sparks = [((x - work.box[0]) * work.factor, (y - work.box[1]) * work.factor) for x, y in (source.sculpt.sparks if source.sculpt else [])]
    points = np.vstack([part for part in (traced, mesh, rim, np.array(sparks).reshape(-1, 2)) if len(part) > 0])
    edges = sorted(set(traced_edges) | set(mesh_edges(points, work.mask, spacing)))
    height, width = work.mask.shape
    glow = [float(work.light[min(height - 1, int(y)), min(width - 1, int(x))]) for x, y in points]
    glow[:len(traced)] = [max(level, contour) for level, contour in zip(glow[:len(traced)], traced_glow)]
    for index in range(len(points) - len(sparks), len(points)):
        glow[index] = 1.0
    return work, points, edges, glow


def haze(work: Work) -> np.ndarray:
    """The surface glow under the mesh, so the face reads as lit skin rather than wire on black."""
    blurred = gaussian_filter(work.light * work.mask, HAZE_BLUR)
    height, width = work.mask.shape
    rows = HAZE_ROWS
    columns = max(1, round(width * rows / height))
    small = Image.fromarray(np.clip(blurred * 255, 0, 255).astype(np.uint8)).resize((columns, rows), Image.BILINEAR)
    return np.asarray(small)


def encode(work: Work, points, edges, glow, marks: Landmarks) -> dict:
    center_x, center_y = (marks.face_center[0] - work.box[0]) * work.factor, (marks.face_center[1] - work.box[1]) * work.factor
    unit = work.mask.shape[0] / 2
    height, width = work.mask.shape
    glow_map = haze(work)
    flat = []
    for (x, y), brightness in zip(points, glow):
        source_x, source_y = work.to_source(x, y)
        flat.extend([
            round((x - center_x) / unit * COORD_SCALE), round((y - center_y) / unit * COORD_SCALE),
            round(depth_of(source_x, source_y, marks) * COORD_SCALE), round(min(1.0, brightness) * 100),
            region_of(source_x, source_y, marks),
        ])
    corner = lambda x, y: [round((x - center_x) / unit * COORD_SCALE), round((y - center_y) / unit * COORD_SCALE)]
    return {
        'pointStride': 5, 'coordScale': COORD_SCALE, 'points': flat, 'edges': [index for edge in edges for index in edge],
        'haze': {'columns': glow_map.shape[1], 'rows': glow_map.shape[0], 'topLeft': corner(0, 0), 'bottomRight': corner(width, height),
                 'values': glow_map.flatten().tolist()},
    }


def save_preview(path: str, work: Work, points, edges, glow, rgb=(110, 214, 255)):
    """Roughly what the game draws: a haze, then lines and dots in additive light, with a soft bloom."""
    size = work.mask.shape[::-1]
    lines = Image.new('L', size, 0)
    draw = ImageDraw.Draw(lines)
    for a, b in edges:
        level = min(1.0, (glow[a] + glow[b]) / 2)
        draw.line([tuple(points[a]), tuple(points[b])], fill=int(255 * level ** 1.6 * 0.75), width=1)
    dots = Image.new('L', size, 0)
    dot_draw = ImageDraw.Draw(dots)
    for (x, y), level in zip(points, glow):
        level = min(1.0, level)
        radius = 0.8 + 1.3 * level
        dot_draw.ellipse([x - radius, y - radius, x + radius, y + radius], fill=int(255 * level ** 1.2))
    bloom = dots.filter(ImageFilter.GaussianBlur(4))
    glow_map = np.asarray(Image.fromarray(haze(work)).resize(size, Image.BILINEAR), dtype=float) / 255
    light = (np.asarray(lines, dtype=float) + np.asarray(dots, dtype=float) + 1.3 * np.asarray(bloom, dtype=float)) / 255 + HAZE_STRENGTH * glow_map
    tint = np.array(rgb, dtype=float) / 255
    color = light[..., None] * tint + np.clip(light - 0.85, 0, 1)[..., None]
    image = np.clip(np.array([5, 8, 23], dtype=float) / 255 + color, 0, 1)
    Image.fromarray((image * 255).astype(np.uint8)).save(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('kind', choices=['portrait', 'moth'])
    parser.add_argument('paths', nargs='+', help='portrait: SOURCE OUTPUT; moth: OUTPUT')
    parser.add_argument('--points', type=int, default=5200)
    parser.add_argument('--seed', type=int, default=7)
    parser.add_argument('--preview')
    args = parser.parse_args()
    if args.kind == 'portrait':
        source_path, output = args.paths
        source = load_portrait(source_path)
    else:
        (output,) = args.paths
        source = draw_moth()
    work, points, edges, glow = build(source, args.points, args.seed)
    with open(output, 'w', encoding='utf-8') as file:
        json.dump(encode(work, points, edges, glow, source.marks), file, separators=(',', ':'))
    if args.preview:
        save_preview(args.preview, work, points, edges, glow)
    print(f'{len(points)} points, {len(edges)} edges -> {output}')


if __name__ == '__main__':
    main()
