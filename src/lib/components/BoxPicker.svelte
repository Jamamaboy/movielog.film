<script lang="ts">
	import type { Rect } from '#lib/imaging.js';

	let {
		src,
		aspect,
		boxes = $bindable(),
		selected = $bindable(),
		onchange
	}: {
		src: string;
		aspect: number; // width / height of the photo
		boxes: Rect[];
		selected: number;
		onchange: () => void;
	} = $props();

	let frame: HTMLDivElement;
	type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'move';
	let drag: { id: number; handle: Handle; start: Rect; px: number; py: number } | null = null;

	const MIN = 0.06;
	const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

	function down(e: PointerEvent, handle: Handle) {
		e.stopPropagation();
		e.preventDefault();
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
		drag = { id: e.pointerId, handle, start: { ...boxes[selected] }, px: e.clientX, py: e.clientY };
	}

	function move(e: PointerEvent) {
		if (!drag || e.pointerId !== drag.id) return;
		const r = frame.getBoundingClientRect();
		const dx = (e.clientX - drag.px) / r.width;
		const dy = (e.clientY - drag.py) / r.height;
		const s = drag.start;
		let { x, y, w, h } = s;
		if (drag.handle === 'move') {
			x = clamp(s.x + dx, 0, 1 - s.w);
			y = clamp(s.y + dy, 0, 1 - s.h);
		} else {
			if (drag.handle.includes('w')) {
				x = clamp(s.x + dx, 0, s.x + s.w - MIN);
				w = s.x + s.w - x;
			}
			if (drag.handle.includes('e')) w = clamp(s.w + dx, MIN, 1 - s.x);
			if (drag.handle.includes('n')) {
				y = clamp(s.y + dy, 0, s.y + s.h - MIN);
				h = s.y + s.h - y;
			}
			if (drag.handle.includes('s')) h = clamp(s.h + dy, MIN, 1 - s.y);
		}
		boxes[selected] = { x, y, w, h };
	}

	function up(e: PointerEvent) {
		if (!drag || e.pointerId !== drag.id) return;
		drag = null;
		onchange();
	}

	function pick(i: number) {
		if (i === selected) return;
		selected = i;
		onchange();
	}

	const pct = (v: number) => `${(v * 100).toFixed(3)}%`;
</script>

<div
	class="frame"
	role="group"
	aria-label="Detected review boxes"
	bind:this={frame}
	style:aspect-ratio={aspect}
	onpointermove={move} onpointerup={up} onpointercancel={up}>
	<img {src} alt="The page you captured" draggable="false" />
	<div class="dim"></div>
	{#each boxes as b, i}
		{@const on = i === selected}
		<button
			type="button"
			class="box"
			class:on
			aria-pressed={on}
			aria-label={`Review ${String(i + 1).padStart(2, '0')}${on ? ', selected' : ''}`}
			style:left={pct(b.x)}
			style:top={pct(b.y)}
			style:width={pct(b.w)}
			style:height={pct(b.h)}
			onclick={() => pick(i)}
			onpointerdown={(e) => on && down(e, 'move')}
		>
			<span class="tag">{#if on}✓ {/if}{String(i + 1).padStart(2, '0')}</span>
			{#if on}
				{#each ['nw', 'ne', 'sw', 'se'] as const as hnd}
					<span class="handle {hnd}" role="presentation" onpointerdown={(e) => down(e, hnd)}></span>
				{/each}
			{/if}
		</button>
	{/each}
</div>

<style>
	.frame {
		position: relative;
		width: 100%;
		border-radius: 14px;
		overflow: hidden;
		background: #2a2a28;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
	}
	img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		pointer-events: none;
	}
	.dim {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.3);
		pointer-events: none;
	}
	.box {
		position: absolute;
		padding: 0;
		border: 2px dashed rgba(255, 255, 255, 0.95);
		border-radius: 6px;
		background: transparent;
		touch-action: none;
	}
	.box.on {
		border: 3px solid var(--yellow);
		background: rgba(232, 185, 74, 0.14);
		box-shadow: 0 0 0 2000px rgba(0, 0, 0, 0.25);
		cursor: move;
		z-index: 1;
	}
	.tag {
		position: absolute;
		left: -3px;
		top: -14px;
		height: 24px;
		padding: 0 8px;
		border-radius: 12px;
		background: #fff;
		color: var(--ink);
		font-size: 12px;
		font-weight: 700;
		display: flex;
		align-items: center;
		white-space: nowrap;
	}
	.on .tag {
		background: var(--yellow);
	}
	.handle {
		position: absolute;
		width: 36px;
		height: 36px;
		touch-action: none;
	}
	.handle::after {
		content: '';
		position: absolute;
		left: 10px;
		top: 10px;
		width: 16px;
		height: 16px;
		border-radius: 8px;
		background: #fff;
		border: 3px solid var(--yellow);
		box-sizing: border-box;
	}
	.nw {
		left: -19px;
		top: -19px;
		cursor: nwse-resize;
	}
	.ne {
		right: -19px;
		top: -19px;
		cursor: nesw-resize;
	}
	.sw {
		left: -19px;
		bottom: -19px;
		cursor: nesw-resize;
	}
	.se {
		right: -19px;
		bottom: -19px;
		cursor: nwse-resize;
	}
</style>
