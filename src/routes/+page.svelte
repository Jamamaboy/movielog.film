<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '#lib/components/Icon.svelte';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import { listEntries, formatDate } from '#lib/db.js';

	let count = $state<number | null>(null);
	let last = $state<number | null>(null);
	let cover = $state<string | null>(null);

	onMount(() => {
		let url: string | null = null;
		listEntries()
			.then((all) => {
				count = all.length;
				const newest = all[all.length - 1];
				last = newest?.createdAt ?? null;
				if (newest) cover = url = URL.createObjectURL(newest.image);
			})
			.catch(() => (count = 0));
		return () => {
			if (url) URL.revokeObjectURL(url);
		};
	});
</script>

<main class="screen home">
	<SiteHeader section="Home" />

	<!-- the "product shot": your latest page, or the logo before you have one -->
	<a class="stage" href={cover ? '/log' : '/add'} aria-label={cover ? 'Open My Log' : 'Add your first page'}>
		{#if cover}
			<img class="latest" src={cover} alt="Your latest page" />
		{:else}
			<img class="logo" src="/brand/logo.png" alt="Movie Log .film" width="656" height="502" />
		{/if}
	</a>

	<h1>Movie Log</h1>

	<div class="meta">
		<span class="count">{count ?? '–'}</span>
		<span class="mono muted">
			{#if count === null}&nbsp;{:else if count === 0}no pages yet{:else}page{count === 1 ? '' : 's'} · {formatDate(last!)}{/if}
		</span>
		<span class="rule" aria-hidden="true"></span>
		<span class="note muted">
			Saved on this device<br />
			<a href="/data">Your data</a> →
		</span>
	</div>

	<nav class="actions" aria-label="Start">
		<a class="btn primary" href="/add"><Icon name="plus" size={18} color="#fff" stroke={2.4} /> Add a page</a>
		<a class="btn" href="/log">My Log →</a>
	</nav>
</main>

<style>
	.home {
		width: 100%;
		max-width: 1200px;
		margin: 0 auto;
		padding-bottom: max(20px, env(safe-area-inset-bottom));
	}
	.stage {
		position: relative;
		flex: 1;
		min-height: 180px;
		margin: 8px 20px 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.latest {
		/* fills the free height, centred, like the product shot on the reference page */
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		height: 100%;
		max-height: 520px;
		aspect-ratio: 9 / 16;
		object-fit: cover;
		border-radius: 6px;
		box-shadow: 0 14px 40px rgba(0, 0, 0, 0.16);
	}
	.logo {
		width: min(62%, 340px);
		height: auto;
	}
	h1 {
		margin: 16px 0 0;
		padding: 0 16px;
		font-family: var(--display);
		font-size: clamp(64px, 20vw, 168px);
		font-weight: 700;
		line-height: 0.9;
		letter-spacing: -0.05em;
		word-spacing: 0.08em;
		white-space: nowrap;
	}
	.meta {
		margin: 14px 20px 0;
		display: flex;
		align-items: center;
		gap: 14px;
		min-height: 44px;
	}
	.count {
		font-family: var(--display);
		font-size: 40px;
		font-weight: 500;
		letter-spacing: -0.03em;
		line-height: 1;
	}
	.meta .mono {
		font-size: 15px;
	}
	.rule {
		width: 1px;
		align-self: stretch;
		background: var(--line);
		margin-left: auto;
	}
	@media (min-width: 700px) {
		.rule {
			margin-left: 12px;
		}
	}
	.note {
		font-size: 13px;
		line-height: 17px;
	}
	.note a {
		color: var(--muted);
		text-decoration: underline;
	}
	.actions {
		margin: 18px 20px 0;
		display: grid;
		grid-template-columns: 1.3fr 1fr;
		gap: 10px;
	}
	.actions .btn {
		height: 54px;
		border-radius: 27px;
	}
	@media (min-width: 900px) {
		.actions {
			max-width: 520px;
		}
	}
</style>
