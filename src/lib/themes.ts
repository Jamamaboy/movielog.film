// Card themes for the review: what sits behind the handwriting, and the ink colour.

export type ThemeId = 'clear' | 'paper' | 'gray' | 'space' | 'film' | 'ticket';

export interface Theme {
	id: ThemeId;
	name: string;
	ink: string; // default ink colour ('original' keeps the pen colour)
}

export const THEMES: Theme[] = [
	{ id: 'clear', name: 'Clear', ink: '#111111' },
	{ id: 'paper', name: 'Paper', ink: '#111111' },
	{ id: 'gray', name: 'Gray', ink: '#1A1A1A' },
	{ id: 'space', name: 'Space', ink: '#F7F1E1' },
	{ id: 'film', name: 'Film', ink: '#FFFFFF' },
	{ id: 'ticket', name: 'Ticket', ink: '#3B2A14' }
];

export const INKS: { id: string; name: string }[] = [
	{ id: 'original', name: 'Pen' },
	{ id: '#111111', name: 'Black' },
	{ id: '#FFFFFF', name: 'White' },
	{ id: '#1F3A93', name: 'Blue' },
	{ id: '#B42318', name: 'Red' },
	{ id: '#E8B94A', name: 'Yellow' }
];

export interface CardStyle {
	theme: ThemeId;
	ink: string;
}

export const DEFAULT_STYLE: CardStyle = { theme: 'clear', ink: '#111111' };

export function themeById(id: string): Theme {
	return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

// ---------- drawing ----------

type R = { x: number; y: number; w: number; h: number };

export function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	r = Math.min(r, w / 2, h / 2);
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

const tintCache = new WeakMap<HTMLCanvasElement, Map<string, HTMLCanvasElement>>();

/** The ink in one flat colour (keeps its soft edges). */
export function tintInk(ink: HTMLCanvasElement, color: string): HTMLCanvasElement {
	if (color === 'original') return ink;
	let m = tintCache.get(ink);
	if (!m) tintCache.set(ink, (m = new Map()));
	const hit = m.get(color);
	if (hit) return hit;
	const c = document.createElement('canvas');
	c.width = ink.width;
	c.height = ink.height;
	const ctx = c.getContext('2d')!;
	ctx.drawImage(ink, 0, 0);
	ctx.globalCompositeOperation = 'source-in';
	ctx.fillStyle = color;
	ctx.fillRect(0, 0, c.width, c.height);
	m.set(color, c);
	return c;
}

/** Same stars every time for the same card size. */
function seeded(seed: number) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function drawSpace(ctx: CanvasRenderingContext2D, c: R, radius: number, k: number) {
	ctx.save();
	roundedRect(ctx, c.x, c.y, c.w, c.h, radius);
	ctx.clip();
	const g = ctx.createLinearGradient(c.x, c.y, c.x + c.w * 0.3, c.y + c.h);
	g.addColorStop(0, '#070B1F');
	g.addColorStop(0.55, '#141A44');
	g.addColorStop(1, '#2A1C55');
	ctx.fillStyle = g;
	ctx.fillRect(c.x, c.y, c.w, c.h);
	const neb = (fx: number, fy: number, fr: number, color: string) => {
		const n = ctx.createRadialGradient(c.x + c.w * fx, c.y + c.h * fy, 0, c.x + c.w * fx, c.y + c.h * fy, c.w * fr);
		n.addColorStop(0, color);
		n.addColorStop(1, 'rgba(0,0,0,0)');
		ctx.fillStyle = n;
		ctx.fillRect(c.x, c.y, c.w, c.h);
	};
	neb(0.8, 0.25, 0.55, 'rgba(140, 90, 220, 0.35)');
	neb(0.15, 0.85, 0.5, 'rgba(40, 150, 190, 0.25)');
	const rnd = seeded(Math.round(c.w) * 7 + Math.round(c.h));
	const count = Math.round((c.w * c.h) / (2600 * k * k));
	for (let i = 0; i < count; i++) {
		const x = c.x + rnd() * c.w;
		const y = c.y + rnd() * c.h;
		const big = rnd() > 0.96;
		const r = (big ? 1.6 + rnd() * 1.4 : 0.5 + rnd() * 1.1) * k * 1.6;
		ctx.globalAlpha = big ? 1 : 0.35 + rnd() * 0.6;
		ctx.fillStyle = rnd() > 0.85 ? '#FFE9B8' : '#FFFFFF';
		ctx.shadowColor = 'rgba(255,255,255,0.9)';
		ctx.shadowBlur = big ? 10 * k : 0;
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.restore();
}

function drawFilm(ctx: CanvasRenderingContext2D, c: R, band: number, k: number) {
	ctx.save();
	ctx.fillStyle = '#121212';
	roundedRect(ctx, c.x, c.y, c.w, c.h, 10 * k);
	ctx.fill();
	const hw = band * 0.62;
	const hh = band * 0.46;
	const gap = hw * 0.9;
	const n = Math.floor((c.w - gap) / (hw + gap));
	const start = c.x + (c.w - (n * hw + (n - 1) * gap)) / 2;
	ctx.fillStyle = '#ECE7DA';
	for (const top of [c.y + (band - hh) / 2, c.y + c.h - band + (band - hh) / 2]) {
		for (let i = 0; i < n; i++) {
			roundedRect(ctx, start + i * (hw + gap), top, hw, hh, hh * 0.25);
			ctx.fill();
		}
	}
	ctx.restore();
}

function drawTicket(ctx: CanvasRenderingContext2D, c: R, notch: number, k: number, bg: string) {
	ctx.save();
	ctx.shadowColor = 'rgba(0,0,0,0.16)';
	ctx.shadowBlur = 24 * k;
	ctx.shadowOffsetY = 8 * k;
	ctx.fillStyle = '#F4E8CC';
	roundedRect(ctx, c.x, c.y, c.w, c.h, 14 * k);
	ctx.fill();
	ctx.shadowColor = 'transparent';
	ctx.fillStyle = bg;
	for (const x of [c.x, c.x + c.w]) {
		ctx.beginPath();
		ctx.arc(x, c.y + c.h / 2, notch, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.strokeStyle = 'rgba(59, 42, 20, 0.35)';
	ctx.lineWidth = 3 * k;
	ctx.setLineDash([12 * k, 10 * k]);
	const inset = notch * 0.75;
	roundedRect(ctx, c.x + inset, c.y + inset, c.w - inset * 2, c.h - inset * 2, 8 * k);
	ctx.stroke();
	ctx.restore();
}

/** Card padding around the ink, as a fraction of the card width. */
export function cardPadding(theme: ThemeId): { x: number; y: number } {
	if (theme === 'paper' || theme === 'gray' || theme === 'space') return { x: 0.045, y: 0.045 };
	if (theme === 'film') return { x: 0.045, y: 0.11 };
	if (theme === 'ticket') return { x: 0.08, y: 0.06 };
	return { x: 0, y: 0 };
}

/** Width / height of the whole review card (ink plus the theme's padding). */
export function reviewAspect(ink: { width: number; height: number }, theme: ThemeId): number {
	const a = ink.width / ink.height;
	const p = cardPadding(theme);
	// card width 1 → ink width (1 - 2px), ink height (1 - 2px) / a, card height adds 2py
	return 1 / ((1 - 2 * p.x) / a + 2 * p.y);
}

/** Draws the review (card + ink) centred inside rectangle `r`. `k` = canvas width / 1080. */
export function drawReview(
	ctx: CanvasRenderingContext2D,
	ink: HTMLCanvasElement,
	r: R,
	style: CardStyle,
	k: number,
	bg: string
) {
	const theme = style.theme;
	const inkC = tintInk(ink, style.ink);
	const unit = r.w;
	const pad = cardPadding(theme);
	const px = unit * pad.x;
	const py = unit * pad.y;
	const s = Math.min((r.w - 2 * px) / inkC.width, (r.h - 2 * py) / inkC.height);
	const iw = inkC.width * s;
	const ih = inkC.height * s;
	const card = { x: r.x + (r.w - iw - 2 * px) / 2, y: r.y + (r.h - ih - 2 * py) / 2, w: iw + 2 * px, h: ih + 2 * py };
	const radius = 18 * k;

	ctx.save();
	if (theme === 'paper' || theme === 'gray') {
		ctx.shadowColor = 'rgba(0,0,0,0.16)';
		ctx.shadowBlur = 30 * k;
		ctx.shadowOffsetY = 10 * k;
		ctx.fillStyle = theme === 'paper' ? '#FFFFFF' : '#E6E6E2';
		roundedRect(ctx, card.x, card.y, card.w, card.h, radius);
		ctx.fill();
	} else if (theme === 'space') {
		drawSpace(ctx, card, radius, k);
	} else if (theme === 'film') {
		drawFilm(ctx, card, unit * 0.08, k);
	} else if (theme === 'ticket') {
		drawTicket(ctx, card, unit * 0.035, k, bg);
	}
	ctx.restore();

	ctx.save();
	if (theme === 'space' || theme === 'film') {
		ctx.shadowColor = 'rgba(255,255,255,0.35)';
		ctx.shadowBlur = 6 * k;
	}
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(inkC, card.x + px, card.y + py, iw, ih);
	ctx.restore();
}
