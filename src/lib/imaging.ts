// Image helpers that run fully in the browser (no server, no OpenCV yet).
// - detectEntries: finds the review boxes on a Movie Log page from its printed rule lines
// - extractInk: keeps only the ink of a crop, on a transparent background
// - renderStory: draws a template (yellow story + review + photos) onto a canvas

import { STORY_W, YELLOW, layoutStory, scaleBox, type Template } from './templates.js';
import { drawReview, reviewAspect, roundedRect, DEFAULT_STYLE, type CardStyle } from './themes.js';

/** A rectangle in 0..1 units of the source image. */
export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface PhotoState {
	img: HTMLCanvasElement;
	zoom: number; // 1 = just covers the slot
	ox: number; // offset as a fraction of the slot width
	oy: number; // offset as a fraction of the slot height
}

// ---------- loading ----------

export async function loadImage(src: Blob | string, maxSide = 2000): Promise<HTMLCanvasElement> {
	const url = typeof src === 'string' ? src : URL.createObjectURL(src);
	try {
		const img = new Image();
		img.src = url;
		await img.decode();
		const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
		const c = document.createElement('canvas');
		c.width = Math.round(img.naturalWidth * scale);
		c.height = Math.round(img.naturalHeight * scale);
		const ctx = c.getContext('2d')!;
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(img, 0, 0, c.width, c.height);
		return c;
	} finally {
		if (typeof src !== 'string') URL.revokeObjectURL(url);
	}
}

// ---------- shared pixel helpers ----------

function toGray(data: Uint8ClampedArray, n: number): Float32Array {
	const g = new Float32Array(n);
	for (let i = 0, j = 0; i < n; i++, j += 4) {
		g[i] = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
	}
	return g;
}

/**
 * Local paper brightness: the brightest value in each cell, smoothed with a 3×3 average,
 * then bilinearly stretched back to full size. Ink is darker than this; paper is about equal.
 */
function localBackground(gray: Float32Array, w: number, h: number, cell: number): Float32Array {
	const gw = Math.ceil(w / cell);
	const gh = Math.ceil(h / cell);
	const grid = new Float32Array(gw * gh);
	for (let y = 0; y < h; y++) {
		const gy = Math.floor(y / cell);
		for (let x = 0; x < w; x++) {
			const k = gy * gw + Math.floor(x / cell);
			const v = gray[y * w + x];
			if (v > grid[k]) grid[k] = v;
		}
	}
	const smooth = new Float32Array(gw * gh);
	for (let y = 0; y < gh; y++) {
		for (let x = 0; x < gw; x++) {
			let sum = 0;
			let n = 0;
			for (let dy = -1; dy <= 1; dy++) {
				for (let dx = -1; dx <= 1; dx++) {
					const xx = x + dx;
					const yy = y + dy;
					if (xx < 0 || yy < 0 || xx >= gw || yy >= gh) continue;
					sum += grid[yy * gw + xx];
					n++;
				}
			}
			smooth[y * gw + x] = sum / n;
		}
	}
	const bg = new Float32Array(w * h);
	for (let y = 0; y < h; y++) {
		const fy = Math.min(Math.max((y + 0.5) / cell - 0.5, 0), gh - 1);
		const y0 = Math.floor(fy);
		const y1 = Math.min(y0 + 1, gh - 1);
		const ty = fy - y0;
		for (let x = 0; x < w; x++) {
			const fx = Math.min(Math.max((x + 0.5) / cell - 0.5, 0), gw - 1);
			const x0 = Math.floor(fx);
			const x1 = Math.min(x0 + 1, gw - 1);
			const tx = fx - x0;
			const a = smooth[y0 * gw + x0] * (1 - tx) + smooth[y0 * gw + x1] * tx;
			const b = smooth[y1 * gw + x0] * (1 - tx) + smooth[y1 * gw + x1] * tx;
			bg[y * w + x] = a * (1 - ty) + b * ty;
		}
	}
	return bg;
}

function percentile(arr: Float32Array, p: number): number {
	const sorted = Float32Array.from(arr).sort();
	return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

// ---------- detection ----------

interface Line {
	y: number;
	x0: number;
	x1: number;
}

const median = (xs: number[]) => {
	const s = [...xs].sort((a, b) => a - b);
	return s[Math.floor(s.length / 2)];
};

/** Small grayscale copy of the photo and a map of ink pixels that sit on paper. */
function inkMap(src: HTMLCanvasElement, w = 400, threshold = 0.82) {
	const h = Math.round((src.height / src.width) * w);
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	const ctx = c.getContext('2d', { willReadFrequently: true })!;
	ctx.drawImage(src, 0, 0, w, h);
	const gray = toGray(ctx.getImageData(0, 0, w, h).data, w * h);
	const bg = localBackground(gray, w, h, 16);
	const paperLevel = percentile(bg, 0.95) * 0.6;
	// ink pixels on paper (ignores the table, pens and shadows)
	const ink = new Uint8Array(w * h);
	for (let i = 0; i < w * h; i++) {
		ink[i] = bg[i] > paperLevel && gray[i] / bg[i] < threshold ? 1 : 0;
	}
	return { w, h, ink, gray };
}

/**
 * Tilt of the page in degrees. Tries angles and keeps the one where the ink
 * lines up best in rows (the printed rules make sharp peaks when level).
 */
export function estimateSkew(src: HTMLCanvasElement): number {
	const { w, h, ink } = inkMap(src, 400);
	const xs: number[] = [];
	const ys: number[] = [];
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			if (ink[y * w + x]) {
				xs.push(x - w / 2);
				ys.push(y);
			}
		}
	}
	let best = 0;
	let bestScore = -1;
	const bins = new Float64Array(h + w);
	for (let deg = -10; deg <= 10.001; deg += 0.25) {
		const t = Math.tan((deg * Math.PI) / 180);
		bins.fill(0);
		for (let i = 0; i < xs.length; i++) {
			const b = Math.round(ys[i] - xs[i] * t + w / 2);
			if (b >= 0 && b < bins.length) bins[b]++;
		}
		let score = 0;
		for (let i = 0; i < bins.length; i++) score += bins[i] * bins[i];
		if (score > bestScore) {
			bestScore = score;
			best = deg;
		}
	}
	return best;
}

/** Rotates the photo so the page is level. */
export function deskew(src: HTMLCanvasElement, deg: number): HTMLCanvasElement {
	if (Math.abs(deg) < 0.3) return src;
	const c = document.createElement('canvas');
	c.width = src.width;
	c.height = src.height;
	const ctx = c.getContext('2d')!;
	ctx.fillStyle = '#2a2a28';
	ctx.fillRect(0, 0, c.width, c.height);
	ctx.translate(c.width / 2, c.height / 2);
	ctx.rotate((-deg * Math.PI) / 180);
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(src, -src.width / 2, -src.height / 2);
	return c;
}

/**
 * Finds review boxes on a (level) page. The Movie Log page prints long horizontal rules:
 * a tight group of rules at the top of each review, then an empty notes area.
 * Each review runs from the first rule of its group to the first rule of the next group.
 */
export function detectEntries(src: HTMLCanvasElement): { boxes: Rect[]; guessed: boolean } {
	// printed rules are thin and light, so work at a higher resolution with a looser threshold
	const { w, h, ink, gray } = inkMap(src, 800, 0.88);
	// thicken vertically by 1px so slightly tilted rules stay continuous
	const thick = new Uint8Array(w * h);
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const i = y * w + x;
			thick[i] = ink[i] | (y > 0 ? ink[i - w] : 0) | (y < h - 1 ? ink[i + w] : 0);
		}
	}
	// keep only long horizontal runs (rules); handwriting strokes are short
	const minRun = Math.round(w * 0.1);
	const rowLen = new Int32Array(h);
	const rowX0 = new Int32Array(h).fill(w);
	const rowX1 = new Int32Array(h).fill(-1);
	for (let y = 0; y < h; y++) {
		let start = -1;
		for (let x = 0; x <= w; x++) {
			const on = x < w && thick[y * w + x] === 1;
			if (on && start < 0) start = x;
			if (!on && start >= 0) {
				const len = x - start;
				if (len >= minRun) {
					rowLen[y] += len;
					rowX0[y] = Math.min(rowX0[y], start);
					rowX1[y] = Math.max(rowX1[y], x - 1);
				}
				start = -1;
			}
		}
	}
	// rows with enough rule pixels become lines; touching rows merge into one line
	const lines: Line[] = [];
	let lastRow = -10;
	for (let y = 0; y < h; y++) {
		if (rowLen[y] < w * 0.15) continue;
		const last = lines[lines.length - 1];
		if (last && y - lastRow <= 2) {
			last.x0 = Math.min(last.x0, rowX0[y]);
			last.x1 = Math.max(last.x1, rowX1[y]);
		} else {
			lines.push({ y, x0: rowX0[y], x1: rowX1[y] });
		}
		lastRow = y;
	}
	// a printed rule has paper on both sides; the edge of the page has the dark table on one side
	const band = (y0: number, y1: number, x0: number, x1: number) => {
		let sum = 0;
		let n = 0;
		for (let y = Math.max(0, y0); y <= Math.min(h - 1, y1); y++) {
			for (let x = x0; x <= x1; x++) {
				sum += gray[y * w + x];
				n++;
			}
		}
		return n ? sum / n : 0;
	};
	const paper = percentile(gray, 0.9);
	const rules = lines.filter((l) => {
		if (l.x1 - l.x0 <= w * 0.3) return false;
		const above = band(l.y - 8, l.y - 5, l.x0, l.x1);
		const below = band(l.y + 5, l.y + 8, l.x0, l.x1);
		return Math.min(above, below) > paper * 0.6;
	});

	// group rules; a big empty gap (the notes area) separates groups
	const groups: Line[][] = [];
	for (const l of rules) {
		const g = groups[groups.length - 1];
		if (g && l.y - g[g.length - 1].y < h * 0.07) g.push(l);
		else groups.push([l]);
	}

	const boxes: Rect[] = [];
	let lastHeight = 0;
	for (let gi = 0; gi < groups.length; gi++) {
		const g = groups[gi];
		if (g.length < 2) continue;
		const top = g[0].y;
		let bottom = gi + 1 < groups.length ? groups[gi + 1][0].y : top + (lastHeight || h - top);
		bottom = Math.min(bottom, h - 1);
		if (bottom - top < h * 0.12) continue;
		lastHeight = bottom - top;
		const inside = rules.filter((l) => l.y >= top && l.y <= bottom);
		const x0 = Math.max(0, median(inside.map((l) => l.x0)) - w * 0.06);
		const x1 = Math.min(w, median(inside.map((l) => l.x1)) + w * 0.01);
		const y0 = Math.max(0, top - h * 0.004);
		const y1 = Math.min(h, bottom + h * 0.004);
		boxes.push({ x: x0 / w, y: y0 / h, w: (x1 - x0) / w, h: (y1 - y0) / h });
	}

	if (boxes.length === 0) {
		return {
			guessed: true,
			boxes: [
				{ x: 0.08, y: 0.08, w: 0.84, h: 0.4 },
				{ x: 0.08, y: 0.52, w: 0.84, h: 0.4 }
			]
		};
	}
	return { boxes, guessed: false };
}

/** Sum of `m` over a (2r+1)² window around each pixel, using an integral image. */
function boxSum(m: Uint8Array, w: number, h: number, r: number): Int32Array {
	const I = new Int32Array((w + 1) * (h + 1));
	for (let y = 0; y < h; y++) {
		let row = 0;
		for (let x = 0; x < w; x++) {
			row += m[y * w + x];
			I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row;
		}
	}
	const out = new Int32Array(w * h);
	for (let y = 0; y < h; y++) {
		const y0 = Math.max(0, y - r);
		const y1 = Math.min(h, y + r + 1);
		for (let x = 0; x < w; x++) {
			const x0 = Math.max(0, x - r);
			const x1 = Math.min(w, x + r + 1);
			out[y * w + x] = I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0];
		}
	}
	return out;
}

// ---------- background removal ----------

/** Crops `rect` and keeps only the ink, on a transparent background. */
export function extractInk(src: HTMLCanvasElement, rect: Rect): HTMLCanvasElement {
	const sx = Math.round(rect.x * src.width);
	const sy = Math.round(rect.y * src.height);
	const sw = Math.max(8, Math.round(rect.w * src.width));
	const sh = Math.max(8, Math.round(rect.h * src.height));
	const c = document.createElement('canvas');
	c.width = sw;
	c.height = sh;
	const ctx = c.getContext('2d', { willReadFrequently: true })!;
	ctx.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
	const img = ctx.getImageData(0, 0, sw, sh);
	const d = img.data;
	const gray = toGray(d, sw * sh);
	const bg = localBackground(gray, sw, sh, Math.max(12, Math.round(sw / 40)));
	const paperLevel = percentile(bg, 0.9) * 0.7;

	const n = sw * sh;
	const alpha = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		const ratio = gray[i] / Math.max(bg[i], 1);
		alpha[i] = bg[i] < paperLevel ? 0 : Math.min(1, Math.max(0, (0.88 - ratio) / 0.28));
	}

	// Writing is thin strokes. Big solid dark areas (page edge, shadow, table) are not:
	// find spots where most of a small window is dark, grow them a little, and drop them.
	const R = Math.max(8, Math.round(Math.max(sw, sh) * 0.025));
	const dark = new Uint8Array(n);
	for (let i = 0; i < n; i++) dark[i] = alpha[i] > 0.3 ? 1 : 0;
	const solid = new Uint8Array(n);
	const sum1 = boxSum(dark, sw, sh, R);
	const area = (2 * R + 1) * (2 * R + 1);
	for (let i = 0; i < n; i++) solid[i] = sum1[i] > area * 0.7 ? 1 : 0;
	const near = boxSum(solid, sw, sh, R);
	for (let i = 0; i < n; i++) if (near[i] > 0) alpha[i] = 0;

	let minX = sw,
		minY = sh,
		maxX = -1,
		maxY = -1;
	for (let i = 0, j = 0; i < n; i++, j += 4) {
		const a = alpha[i];
		// darken a little so the ink reads well on yellow
		d[j] = d[j] * 0.75;
		d[j + 1] = d[j + 1] * 0.75;
		d[j + 2] = d[j + 2] * 0.8;
		d[j + 3] = Math.round(a * 255);
		if (a > 0.3) {
			const x = i % sw;
			const y = (i / sw) | 0;
			if (x < minX) minX = x;
			if (x > maxX) maxX = x;
			if (y < minY) minY = y;
			if (y > maxY) maxY = y;
		}
	}
	ctx.putImageData(img, 0, 0);
	if (maxX < 0) return c;

	// trim empty margins so the review fills its slot
	const pad = Math.round(Math.max(sw, sh) * 0.015);
	const tx = Math.max(0, minX - pad);
	const ty = Math.max(0, minY - pad);
	const tw = Math.min(sw, maxX + pad) - tx;
	const th = Math.min(sh, maxY + pad) - ty;
	const out = document.createElement('canvas');
	out.width = tw;
	out.height = th;
	out.getContext('2d')!.drawImage(c, tx, ty, tw, th, 0, 0, tw, th);
	return out;
}

// ---------- rendering ----------

function coverSize(img: HTMLCanvasElement, rw: number, rh: number, zoom: number) {
	const s = Math.max(rw / img.width, rh / img.height) * zoom;
	return { dw: img.width * s, dh: img.height * s };
}

/** Keeps the photo covering the whole slot after a move or zoom. */
export function clampPhoto(p: PhotoState, rw: number, rh: number): PhotoState {
	const zoom = Math.min(4, Math.max(1, p.zoom));
	const { dw, dh } = coverSize(p.img, rw, rh, zoom);
	const mx = (dw - rw) / 2 / rw;
	const my = (dh - rh) / 2 / rh;
	return { ...p, zoom, ox: Math.min(mx, Math.max(-mx, p.ox)), oy: Math.min(my, Math.max(-my, p.oy)) };
}

export function drawPhoto(
	ctx: CanvasRenderingContext2D,
	p: PhotoState,
	r: { x: number; y: number; w: number; h: number },
	radius = 0
) {
	// the box can change shape (layout or theme change), so keep the photo covering it
	p = clampPhoto(p, r.w, r.h);
	const { dw, dh } = coverSize(p.img, r.w, r.h, p.zoom);
	const cx = r.x + r.w / 2 + p.ox * r.w;
	const cy = r.y + r.h / 2 + p.oy * r.h;
	ctx.save();
	roundedRect(ctx, r.x, r.y, r.w, r.h, radius);
	ctx.clip();
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(p.img, cx - dw / 2, cy - dh / 2, dw, dh);
	ctx.restore();
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, k: number) {
	ctx.save();
	ctx.fillStyle = '#F3DC9E';
	roundedRect(ctx, r.x, r.y, r.w, r.h, 14 * k);
	ctx.fill();
	ctx.strokeStyle = '#8A6A12';
	ctx.lineWidth = 4 * k;
	ctx.setLineDash([14 * k, 10 * k]);
	roundedRect(ctx, r.x + 2 * k, r.y + 2 * k, r.w - 4 * k, r.h - 4 * k, 12 * k);
	ctx.stroke();
	ctx.setLineDash([]);
	// photo icon
	const s = Math.min(r.w, r.h) * 0.22;
	const cx = r.x + r.w / 2;
	const cy = r.y + r.h / 2 - (r.w > 200 * k ? 18 * k : 0);
	ctx.lineWidth = Math.max(2, 5 * k);
	ctx.lineJoin = 'round';
	ctx.strokeRect(cx - s / 2, cy - s * 0.4, s, s * 0.8);
	ctx.beginPath();
	ctx.moveTo(cx - s / 2, cy + s * 0.3);
	ctx.lineTo(cx - s * 0.1, cy - s * 0.05);
	ctx.lineTo(cx + s * 0.15, cy + s * 0.15);
	ctx.lineTo(cx + s / 2, cy - s * 0.1);
	ctx.stroke();
	if (r.w > 200 * k) {
		ctx.fillStyle = '#4A3A0A';
		ctx.font = `600 ${32 * k}px Inter, sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		ctx.fillText('Tap to add photo', cx, cy + s * 0.55);
	}
	ctx.restore();
}

/** Draws the full story into `canvas` (any size with a 9:16 ratio). */
export function renderStory(
	canvas: HTMLCanvasElement,
	t: Template,
	ink: HTMLCanvasElement | null,
	photos: (PhotoState | null)[],
	placeholders = true,
	style: CardStyle = DEFAULT_STYLE
) {
	const ctx = canvas.getContext('2d')!;
	const W = canvas.width;
	const H = canvas.height;
	const k = W / STORY_W;
	ctx.fillStyle = YELLOW;
	ctx.fillRect(0, 0, W, H);
	let pi = 0;
	const boxes = layoutStory(t, ink ? reviewAspect(ink, style.theme) : undefined);
	for (const box of boxes) {
		const r = scaleBox(box, W);
		if (box.kind === 'photo') {
			const p = photos[pi++];
			if (p) drawPhoto(ctx, p, r, 14 * k);
			else if (placeholders) drawPlaceholder(ctx, r, k);
		} else if (ink) {
			drawReview(ctx, ink, r, style, k, YELLOW);
		}
	}
}

export function canvasToBlob(c: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
	return new Promise((resolve, reject) =>
		c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not export image'))), type, quality)
	);
}
