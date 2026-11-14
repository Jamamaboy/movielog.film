<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from './Icon.svelte';
	import { clampPhoto, drawPhoto, type PhotoState } from '#lib/imaging.js';

	let {
		photo,
		aspect,
		index,
		ondone,
		onreplace,
		onremove,
		onclose
	}: {
		photo: PhotoState;
		aspect: number; // slot width / height
		index: number;
		ondone: (p: PhotoState) => void;
		onreplace: () => void;
		onremove: () => void;
		onclose: () => void;
	} = $props();

	// local copy while editing; the parent gets it back on Done
	// svelte-ignore state_referenced_locally
	let p = $state.raw<PhotoState>(photo);
	let canvas: HTMLCanvasElement;
	let box: HTMLDivElement;
	let size = $state({ w: 300, h: 300 });
	const pointers = new Map<number, { x: number; y: number }>();
	let pinch = 0;

	function fit() {
		const maxW = Math.min(box.clientWidth, 560);
		const maxH = Math.min(window.innerHeight * 0.45, 420);
		let w = maxW;
		let h = w / aspect;
		if (h > maxH) {
			h = maxH;
			w = h * aspect;
		}
		size = { w: Math.round(w), h: Math.round(h) };
	}

	onMount(() => {
		fit();
		window.addEventListener('resize', fit);
		// wheel must be non-passive so the page does not scroll while zooming
		canvas.addEventListener('wheel', wheel, { passive: false });
		return () => {
			window.removeEventListener('resize', fit);
			canvas.removeEventListener('wheel', wheel);
		};
	});

	$effect(() => {
		if (!canvas) return;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = size.w * dpr;
		canvas.height = size.h * dpr;
		const ctx = canvas.getContext('2d')!;
		ctx.fillStyle = '#1c1c1a';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		drawPhoto(ctx, p, { x: 0, y: 0, w: canvas.width, h: canvas.height });
	});

	const update = (next: Partial<PhotoState>) => (p = clampPhoto({ ...p, ...next }, size.w, size.h));

	function down(e: PointerEvent) {
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
		pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		if (pointers.size === 2) pinch = distance();
	}

	function distance() {
		const [a, b] = [...pointers.values()];
		return Math.hypot(a.x - b.x, a.y - b.y);
	}

	function move(e: PointerEvent) {
		const prev = pointers.get(e.pointerId);
		if (!prev) return;
		const cur = { x: e.clientX, y: e.clientY };
		pointers.set(e.pointerId, cur);
		if (pointers.size === 1) {
			update({ ox: p.ox + (cur.x - prev.x) / size.w, oy: p.oy + (cur.y - prev.y) / size.h });
		} else if (pointers.size === 2) {
			const d = distance();
			if (pinch > 0) update({ zoom: p.zoom * (d / pinch) });
			pinch = d;
		}
	}

	function up(e: PointerEvent) {
		pointers.delete(e.pointerId);
		pinch = pointers.size === 2 ? distance() : 0;
	}

	function wheel(e: WheelEvent) {
		e.preventDefault();
		update({ zoom: p.zoom * Math.exp(-e.deltaY * 0.0015) });
	}
</script>

<div class="backdrop" role="presentation" onclick={onclose}></div>
<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="adjust-title">
	<div class="grip"></div>
	<div class="head">
		<h2 id="adjust-title">Adjust photo {index + 1}</h2>
		<button class="icon-btn" type="button" aria-label="Close" onclick={onclose}><Icon name="close" size={20} /></button>
	</div>
	<div class="stage" bind:this={box}>
		<canvas
			bind:this={canvas}
			style:width="{size.w}px"
			style:height="{size.h}px"
			onpointerdown={down}
			onpointermove={move}
			onpointerup={up}
			onpointercancel={up}
		></canvas>
	</div>
	<p class="hint muted">Drag to move · pinch or scroll to zoom</p>
	<div class="zoom">
		<label for="zoom">Zoom</label>
		<input id="zoom" type="range" min="1" max="4" step="0.01" value={p.zoom} oninput={(e) => update({ zoom: +e.currentTarget.value })} />
		<span class="mono muted">{p.zoom.toFixed(1)}×</span>
	</div>
	<div class="actions">
		<button class="btn" type="button" onclick={onreplace}>Replace</button>
		<button class="btn danger" type="button" onclick={onremove}>Remove</button>
		<button class="btn primary" type="button" onclick={() => ondone(p)}>Done</button>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		z-index: 20;
		animation: fade 0.2s ease;
	}
	.sheet {
		position: fixed;
		left: 50%;
		bottom: 0;
		transform: translateX(-50%);
		width: min(100%, 640px);
		max-height: 92dvh;
		overflow: auto;
		z-index: 21;
		background: #fff;
		border-radius: 24px 24px 0 0;
		padding: 10px 16px max(20px, env(safe-area-inset-bottom));
		animation: up 0.25s ease;
	}
	@media (min-width: 700px) {
		.sheet {
			bottom: auto;
			top: 50%;
			transform: translate(-50%, -50%);
			border-radius: 24px;
		}
	}
	.grip {
		width: 40px;
		height: 4px;
		border-radius: 2px;
		background: var(--line);
		margin: 0 auto 6px;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	h2 {
		margin: 0;
		font-size: 18px;
	}
	.stage {
		display: flex;
		justify-content: center;
		padding: 16px 0;
		background: #1c1c1a;
		border-radius: 14px;
	}
	canvas {
		display: block;
		touch-action: none;
		cursor: grab;
		outline: 2px solid #fff;
	}
	.hint {
		margin: 8px 0 0;
		text-align: center;
		font-size: 13px;
	}
	.zoom {
		margin-top: 8px;
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 14px;
		font-weight: 600;
	}
	.zoom input {
		flex: 1;
		height: 44px;
		accent-color: var(--ink);
	}
	.zoom span {
		width: 40px;
		text-align: right;
		font-weight: 400;
	}
	.actions {
		margin-top: 8px;
		display: grid;
		grid-template-columns: 1fr 1fr 1.4fr;
		gap: 8px;
	}
	.actions .btn {
		padding: 0 8px;
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
	@keyframes up {
		from {
			transform: translate(-50%, 40px);
			opacity: 0;
		}
	}
</style>
