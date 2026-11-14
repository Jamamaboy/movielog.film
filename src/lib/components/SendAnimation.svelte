<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from './Icon.svelte';

	// The finished story folds into an envelope and flies into the My Log icon.
	let { src, ondone }: { src: string; ondone: () => void } = $props();

	let target: HTMLSpanElement;
	let tx = $state(0);
	let ty = $state(0);

	onMount(() => {
		const r = target.getBoundingClientRect();
		tx = r.left + r.width / 2 - window.innerWidth / 2;
		ty = r.top + r.height / 2 - window.innerHeight / 2;
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const t = setTimeout(ondone, reduce ? 300 : 1500);
		return () => clearTimeout(t);
	});
</script>

<div class="overlay" style:--tx="{tx}px" style:--ty="{ty}px" role="status" aria-live="polite">
	<span class="visually-hidden">Saved to My Log</span>
	<span class="target" bind:this={target}>
		<Icon name="book" stroke={1.8} />
		<span class="badge">+1</span>
	</span>
	<img class="card" {src} alt="" />
	<span class="envelope" aria-hidden="true">
		<span class="flap"></span>
	</span>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 40;
		background: rgba(242, 242, 240, 0.96);
		animation: bg 1.5s ease forwards;
	}
	.target {
		position: absolute;
		top: calc(env(safe-area-inset-top) + 8px);
		right: 12px;
		width: 48px;
		height: 48px;
		border-radius: 24px;
		background: #fff;
		border: 1px solid var(--line);
		display: flex;
		align-items: center;
		justify-content: center;
		animation: bump 1.5s ease forwards;
	}
	.badge {
		position: absolute;
		right: -6px;
		top: -6px;
		height: 22px;
		min-width: 22px;
		padding: 0 6px;
		border-radius: 11px;
		background: var(--yellow);
		border: 2px solid #fff;
		font-size: 11px;
		font-weight: 800;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		animation: badge 1.5s ease forwards;
	}
	.card {
		position: absolute;
		left: 50%;
		top: 50%;
		height: min(70dvh, 560px);
		aspect-ratio: 9 / 16;
		border-radius: 8px;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
		transform: translate(-50%, -50%);
		animation: card 1.5s cubic-bezier(0.5, 0, 0.3, 1) forwards;
	}
	.envelope {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 150px;
		height: 100px;
		margin: -50px 0 0 -75px;
		background: #fff;
		border: 2px solid var(--ink);
		border-radius: 8px;
		overflow: hidden;
		opacity: 0;
		animation: fly 1.5s cubic-bezier(0.5, 0, 0.3, 1) forwards;
	}
	.flap {
		position: absolute;
		left: -2px;
		top: -2px;
		width: 150px;
		height: 100px;
		background: var(--paper);
		clip-path: polygon(0 0, 100% 0, 50% 58%);
		border-bottom: 2px solid var(--ink);
	}
	.flap::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(to bottom right, transparent 49%, var(--ink) 50%, transparent 52%),
			linear-gradient(to bottom left, transparent 49%, var(--ink) 50%, transparent 52%);
	}
	@keyframes card {
		0% {
			transform: translate(-50%, -50%) scale(1);
		}
		30% {
			transform: translate(-50%, -50%) scale(0.28) rotate(-6deg);
			opacity: 1;
		}
		38% {
			transform: translate(-50%, -40%) scale(0.22) rotate(-6deg);
			opacity: 0;
		}
		100% {
			opacity: 0;
			transform: translate(-50%, -40%) scale(0.22);
		}
	}
	@keyframes fly {
		0%,
		28% {
			opacity: 0;
			transform: scale(0.7);
		}
		38% {
			opacity: 1;
			transform: scale(1);
		}
		48% {
			opacity: 1;
			transform: scale(1) rotate(-4deg);
		}
		70% {
			opacity: 1;
			transform: translate(calc(var(--tx) * 0.35), calc(var(--ty) * 0.75)) scale(0.6) rotate(-14deg);
		}
		86% {
			opacity: 1;
			transform: translate(var(--tx), var(--ty)) scale(0.2) rotate(-20deg);
		}
		92%,
		100% {
			opacity: 0;
			transform: translate(var(--tx), var(--ty)) scale(0.1);
		}
	}
	@keyframes bump {
		0%,
		84% {
			transform: scale(1);
		}
		90% {
			transform: scale(1.25);
		}
		100% {
			transform: scale(1);
		}
	}
	@keyframes badge {
		0%,
		86% {
			opacity: 0;
			transform: scale(0.4);
		}
		94%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}
	@keyframes bg {
		0%,
		90% {
			opacity: 1;
		}
		100% {
			opacity: 0.9;
		}
	}
</style>
