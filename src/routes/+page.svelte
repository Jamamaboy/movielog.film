<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { listEntries, formatDate } from '#lib/db.js';

	let count = $state<number | null>(null);
	let last = $state<number | null>(null);

	onMount(async () => {
		try {
			const all = await listEntries();
			count = all.length;
			last = all.length ? all[all.length - 1].createdAt : null;
		} catch {
			count = 0;
		}
	});
</script>

<main class="screen home">
	<header class="bar">
		<div class="brand">
			<Icon name="ticket" size={26} stroke={1.8} />
			<span>Movie Log<span class="film">.film</span></span>
		</div>
		<a class="icon-btn" href="/data" aria-label="Your data"><Icon name="folder" /></a>
	</header>

	<section class="hero">
		<h1>Movie<br />Log</h1>
		<p class="muted">Turn the pages of your movie log into Stories.</p>
	</section>

	<nav class="menu" aria-label="Main">
		<a class="card add" href="/add">
			<span class="circle"><Icon name="plus" color="#fff" stroke={2.4} /></span>
			<span class="label">
				<strong>Add</strong>
				<span>Capture a page from your log</span>
			</span>
		</a>
		<a class="card log" href="/log">
			<span class="square"><Icon name="book" stroke={1.8} /></span>
			<span class="label">
				<strong>My Log</strong>
				<span class="muted">
					{#if count === null}…{:else if count === 0}No pages yet{:else}{count} page{count === 1 ? '' : 's'} · last added {formatDate(last!)}{/if}
				</span>
			</span>
			<Icon name="next" size={20} />
		</a>
	</nav>

	<p class="foot muted"><Icon name="lock" size={14} /> Saved on this device · no account</p>
</main>

<style>
	.home {
		max-width: 520px;
		margin: 0 auto;
		padding-left: 20px;
		padding-right: 20px;
		padding-bottom: max(24px, env(safe-area-inset-bottom));
	}
	.bar {
		height: 56px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-right: -10px;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 700;
		font-size: 17px;
		letter-spacing: -0.3px;
	}
	.film {
		color: var(--yellow-dark);
	}
	.hero {
		margin-top: clamp(12px, 4vh, 72px);
	}
	.hero h1 {
		margin: 0;
		font-size: clamp(56px, 17vw, 104px);
		line-height: 0.92;
		font-weight: 800;
		letter-spacing: -0.045em;
	}
	.hero p {
		margin: 16px 0 0;
		font-size: 16px;
		line-height: 24px;
		max-width: 300px;
	}
	.menu {
		margin-top: auto;
		padding-top: 24px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.card {
		border-radius: 20px;
		padding: 20px;
		display: flex;
		transition: transform 0.15s ease;
	}
	.card:active {
		transform: scale(0.98);
	}
	.add {
		height: 160px;
		background: var(--yellow);
		flex-direction: column;
		justify-content: space-between;
	}
	.add .circle {
		width: 48px;
		height: 48px;
		border-radius: 24px;
		background: var(--ink);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.add strong {
		font-size: 34px;
		font-weight: 800;
		letter-spacing: -1px;
		line-height: 1;
	}
	.add .label span {
		font-size: 14px;
		color: #2b2410;
	}
	.label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex-grow: 1;
	}
	.log {
		height: 112px;
		background: var(--surface);
		border: 1px solid var(--line);
		align-items: center;
		gap: 16px;
	}
	.log .square {
		width: 48px;
		height: 48px;
		border-radius: 12px;
		background: var(--bg);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.log strong {
		font-size: 24px;
		font-weight: 800;
		letter-spacing: -0.6px;
		line-height: 1;
	}
	.log .label span {
		font-size: 14px;
	}
	.foot {
		margin: 20px 0 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		font-size: 13px;
	}
</style>
