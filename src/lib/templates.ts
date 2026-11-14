// Story layouts for a 1080 × 1920 Instagram Story.
//
// Boxes are not fixed percentages: they are worked out from the real shape of the
// review, so the review always spans the full content width and photos take the rest.
// Everything shares one side margin and one gap, and stays inside the "safe area"
// (Instagram covers the very top with the profile bar and the bottom with the reply box).

export const STORY_W = 1080;
export const STORY_H = 1920;
export const YELLOW = '#E8B94A';

export const MARGIN = 72; // left / right
export const GAP = 36; // between boxes
export const SAFE_TOP = 230;
export const SAFE_BOTTOM = 1690;

export type BoxKind = 'photo' | 'review';

export interface Box {
	kind: BoxKind;
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface Template {
	id: number;
	name: string;
	photos: number;
}

export const TEMPLATES: Template[] = [
	{ id: 1, name: 'Review only', photos: 0 },
	{ id: 2, name: 'Photo on top', photos: 1 },
	{ id: 3, name: 'Photo · Review · Photo', photos: 2 },
	{ id: 4, name: 'Photo grid', photos: 2 }
];

export function templateById(id: number): Template {
	return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

/** Shape of a review when we don't have one yet (thumbnails before capture). */
export const DEFAULT_REVIEW_ASPECT = 1.45;

/**
 * Boxes for template `t`, in 1080 × 1920 story pixels.
 * `reviewAspect` = width / height of the review card (ink + its theme padding).
 */
export function layoutStory(t: Template, reviewAspect = DEFAULT_REVIEW_ASPECT): Box[] {
	const W = STORY_W - MARGIN * 2;
	const H = SAFE_BOTTOM - SAFE_TOP;
	const x = MARGIN;

	// the review spans the full width, unless that makes it taller than `maxH`
	const review = (maxH: number) => {
		let w = W;
		let h = W / reviewAspect;
		if (h > maxH) {
			h = maxH;
			w = h * reviewAspect;
		}
		return { w, h };
	};

	switch (t.id) {
		case 2: {
			// photo fills everything above the review
			const r = review(H * 0.55);
			const ph = H - r.h - GAP;
			return [
				{ kind: 'photo', x, y: SAFE_TOP, w: W, h: ph },
				{ kind: 'review', x: x + (W - r.w) / 2, y: SAFE_TOP + ph + GAP, w: r.w, h: r.h }
			];
		}
		case 3: {
			// two wide "film still" photos around the review
			const r = review(H * 0.46);
			const ph = (H - r.h - GAP * 2) / 2;
			return [
				{ kind: 'photo', x, y: SAFE_TOP, w: W, h: ph },
				{ kind: 'review', x: x + (W - r.w) / 2, y: SAFE_TOP + ph + GAP, w: r.w, h: r.h },
				{ kind: 'photo', x, y: SAFE_TOP + ph + GAP * 2 + r.h, w: W, h: ph }
			];
		}
		case 4: {
			// a big photo and a tall narrow one side by side, review underneath
			const r = review(H * 0.5);
			const ph = H - r.h - GAP;
			const big = Math.round((W - GAP) * 0.66);
			return [
				{ kind: 'photo', x, y: SAFE_TOP, w: big, h: ph },
				{ kind: 'photo', x: x + big + GAP, y: SAFE_TOP, w: W - big - GAP, h: ph },
				{ kind: 'review', x: x + (W - r.w) / 2, y: SAFE_TOP + ph + GAP, w: r.w, h: r.h }
			];
		}
		default: {
			// review alone, centred on the story
			const r = review(H);
			return [{ kind: 'review', x: x + (W - r.w) / 2, y: (STORY_H - r.h) / 2, w: r.w, h: r.h }];
		}
	}
}

/** Scales a story-pixel box to a canvas of width `cw` (height follows the 9:16 ratio). */
export function scaleBox(b: Box, cw: number): Box {
	const k = cw / STORY_W;
	return { ...b, x: b.x * k, y: b.y * k, w: b.w * k, h: b.h * k };
}
