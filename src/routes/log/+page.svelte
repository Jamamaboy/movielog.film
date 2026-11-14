<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { listEntries, deleteEntry, getMeta, setMeta, formatDate, type Entry } from '#lib/db.js';
	import { shareImage, download, fileName } from '#lib/files.js';

	type Page = { kind: 'cover' } | { kind: 'entry'; no: number; entry: Entry; url: string };

	let entries = $state.raw<Entry[]>([]);
	let urls = new Map<string, string>();
	let loaded = $state(false);
	let name = $state('');
	let view = $state<'book' | 'grid'>('book');
	let page = $state(0); // index of the page shown (left page of the spread on desktop)
	let dir = $state(1);
	let wide = $state(false);

	const pages = $derived<Page[]>([
		{ kind: 'cover' },
		...entries.map((entry, i) => ({ kind: 'entry' as const, no: i + 1, entry, url: urlFor(entry) }))
	]);
	const step = $derived(wide ? 2 : 1);
	const shown = $derived(pages.slice(page, page + step));
	const year = $derived(new Date(entries[0]?.createdAt ?? Date.now()).getFullYear());

	function urlFor(e: Entry) {
		let u = urls.get(e.id);
		if (!u) {
			u = URL.createObjectURL(e.image);
			urls.set(e.id, u);
		}
		return u;
	}

	onMount(() => {
		const mq = window.matchMedia('(min-width: 900px)');
		const sync = () => {
			wide = mq.matches;
			page = wide ? page - (page % 2) : page;
		};
		sync();
		mq.addEventListener('change', sync);
		load();
		const key = (e: KeyboardEvent) => {
			if (view !== 'book' || (e.target as HTMLElement)?.tagName === 'INPUT') return;
			if (e.key === 'ArrowRight') go(1);
			if (e.key === 'ArrowLeft') go(-1);
		};
		window.addEventListener('keydown', key);
		return () => {
			mq.removeEventListener('change', sync);
			window.removeEventListener('keydown', key);
			urls.forEach((u) => URL.revokeObjectURL(u));
		};
	});

	async function load() {
		try {
			entries = await listEntries();
			name = (await getMeta<string>('name')) ?? '';
		} finally {
			loaded = true;
		}
	}

	function go(d: number) {
		const next = page + d * step;
		if (next < 0 || next >= pages.length) return;
		dir = d;
		page = next;
	}

	function open(i: number) {
		view = 'book';
		dir = 1;
		page = wide ? i - (i % 2) : i;
	}

	async function remove(e: Entry) {
		if (!confirm('Delete this page from My Log? This cannot be undone.')) return;
		await deleteEntry(e.id);
		entries = entries.filter((x) => x.id !== e.id);
		page = Math.min(page, Math.max(0, pages.length - 1 - step));
		if (wide) page -= page % 2;
	}

	// swipe
	let sx = 0;
	let sy = 0;
	const pdown = (e: PointerEvent) => {
		sx = e.clientX;
		sy = e.clientY;
	};
	const pup = (e: PointerEvent) => {
		const dx = e.clientX - sx;
		if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - sy)) go(dx < 0 ? 1 : -1);
	};

	function flip(node: Element, { d, out = false }: { d: number; out?: boolean }) {
		const from = d > 0 ? (out ? -90 : 90) : out ? 90 : -90;
		return {
			duration: 320,
			css: (t: number) => `transform: perspective(1400px) rotateY(${(1 - t) * from}deg); opacity: ${0.3 + 0.7 * t}`
		};
	}
</script>

<svelte:head><title>My Log · Movie Log .film</title></svelte:head>

<main class="screen log">
	<header class="topbar">
		<a class="icon-btn" href="/" aria-label="Back"><Icon name="back" /></a>
		<h1>My Log</h1>
		<a class="icon-btn" href="/add" aria-label="Add"><Icon name="plus" /></a>
	</header>

	<div class="seg" role="group" aria-label="View">
		<button type="button" aria-pressed={view === 'book'} onclick={() => (view = 'book')}>Book</button>
		<button type="button" aria-pressed={view === 'grid'} onclick={() => (view = 'grid')}>Grid</button>
	</div>

	{#if !loaded}
		<p class="center muted">Loading…</p>
	{:else if view === 'grid'}
		{#if entries.length === 0}
			<p class="center muted">No pages yet.</p>
		{:else}
			<ul class="grid">
				{#each pages as p, i}
					{#if p.kind === 'entry'}
						<li>
							<button type="button" onclick={() => open(i)}>
								<img src={p.url} alt="Page {p.no}" loading="lazy" />
								<span class="mono">No. {String(p.no).padStart(2, '0')}</span>
								<span class="muted">{formatDate(p.entry.createdAt)}</span>
							</button>
						</li>
					{/if}
				{/each}
			</ul>
		{/if}
	{:else}
		<div class="book" class:spread={wide} role="region" aria-label="My Log book" onpointerdown={pdown} onpointerup={pup}>
			{#key page}
				<div class="pages" in:flip={{ d: dir }}>
					{#each shown as p (p.kind === 'cover' ? 'cover' : p.entry.id)}
						{#if p.kind === 'cover'}
							<article class="page cover">
								<span class="rule mono">MOVIE LOG</span>
								<span class="grow"></span>
								<h2>Movie Log</h2>
								<div class="fields">
									<label class="field">
										<span class="mono">NAME:</span>
										<input
											type="text"
											placeholder="Your name"
											bind:value={name}
											onchange={() => setMeta('name', name)}
											onpointerdown={(e) => e.stopPropagation()}
										/>
									</label>
									<div class="field year">
										<span class="mono">YEAR:</span>
										<span>{year}</span>
									</div>
								</div>
								<span class="grow"></span>
								<p class="hint">
									{entries.length === 0 ? 'No pages yet' : `${entries.length} page${entries.length === 1 ? '' : 's'} · swipe to open`}
								</p>
							</article>
						{:else}
							<article class="page paper">
								<div class="form">
									<div class="no"><span class="mono">NO.</span><b>{String(p.no).padStart(2, '0')}</b></div>
									<div class="date"><span class="mono">DATE ADDED:</span><b>{formatDate(p.entry.createdAt)}</b></div>
								</div>
								<img src={p.url} alt="Story page {p.no}" draggable="false" />
								<div class="acts">
									<button class="icon-btn outline" type="button" aria-label="Download" onclick={() => download(p.entry.image, fileName(p.entry))}>
										<Icon name="download" size={18} />
									</button>
									<button
										class="icon-btn outline dark"
										type="button"
										aria-label="Share"
										onclick={() => shareImage(p.entry.image, fileName(p.entry))}
									>
										<Icon name="share" size={18} color="#fff" />
									</button>
									<button class="icon-btn outline" type="button" aria-label="Delete" onclick={() => remove(p.entry)}>
										<Icon name="trash" size={18} />
									</button>
								</div>
							</article>
						{/if}
					{/each}
					{#if wide && shown.length === 1}
						<article class="page paper blank" aria-hidden="true">
							{#if entries.length === 0}<a class="btn primary" href="/add">Add your first page</a>{/if}
						</article>
					{/if}
				</div>
			{/key}
		</div>

		{#if !wide && entries.length === 0}
			<a class="btn primary first" href="/add"><Icon name="plus" size={18} color="#fff" /> Add your first page</a>
		{/if}

		<nav class="pager" aria-label="Pages">
			<button class="icon-btn outline" type="button" aria-label="Previous page" disabled={page === 0} onclick={() => go(-1)}>
				<Icon name="back" size={18} />
			</button>
			<span class="mono">{page === 0 ? 'Cover' : `${page}${wide && shown.length === 2 ? `–${page + 1}` : ''} / ${entries.length}`}</span>
			<button class="icon-btn outline" type="button" aria-label="Next page" disabled={page + step >= pages.length} onclick={() => go(1)}>
				<Icon name="next" size={18} />
			</button>
		</nav>
	{/if}
</main>

<style>
	.log {
		width: 100%;
		max-width: 1100px;
		margin: 0 auto;
		padding-bottom: max(20px, env(safe-area-inset-bottom));
	}
	.seg {
		margin: 0 auto 16px;
		width: 200px;
		padding: 4px;
		border-radius: 22px;
		background: #e4e4df;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 4px;
	}
	.seg button {
		height: 36px;
		border-radius: 18px;
		border: 0;
		background: transparent;
		font-size: 14px;
		font-weight: 600;
	}
	.seg button[aria-pressed='true'] {
		background: var(--ink);
		color: #fff;
	}
	.center {
		text-align: center;
	}

	/* book */
	.book {
		flex: 1;
		display: flex;
		justify-content: center;
		align-items: flex-start;
		padding: 0 16px;
		touch-action: pan-y;
		user-select: none;
		-webkit-user-select: none;
	}
	.pages {
		display: flex;
		transform-origin: left center;
		filter: drop-shadow(0 10px 24px rgba(0, 0, 0, 0.16));
	}
	.page {
		--pw: min(calc(100vw - 48px), calc((100dvh - 250px) * 0.62), 420px);
		width: var(--pw);
		aspect-ratio: 0.62;
		border-radius: 4px 10px 10px 4px;
		padding: 18px 20px;
		display: flex;
		flex-direction: column;
		box-shadow: inset 10px 0 12px -10px rgba(0, 0, 0, 0.25);
	}
	.spread .page {
		--pw: min(calc((100vw - 64px) / 2), calc((100dvh - 230px) * 0.62), 440px);
	}
	.spread .page:first-child {
		border-radius: 10px 4px 4px 10px;
		box-shadow: inset -10px 0 12px -10px rgba(0, 0, 0, 0.25);
	}
	.cover {
		background: var(--yellow);
		padding-left: 28px;
	}
	.rule {
		border-top: 1px solid var(--ink);
		padding-top: 8px;
		font-size: 11px;
		letter-spacing: 0.5px;
	}
	.grow {
		flex: 1;
	}
	.cover h2 {
		margin: 0;
		border-top: 1px solid var(--ink);
		padding-top: 10px;
		font-size: clamp(34px, 11vw, 48px);
		font-weight: 800;
		letter-spacing: -0.03em;
		line-height: 1;
	}
	.fields {
		display: flex;
		gap: 12px;
		margin-top: 18px;
	}
	.field {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
		border-bottom: 1px solid #2b2410;
		padding-bottom: 4px;
	}
	.field .mono {
		font-size: 10px;
		letter-spacing: 0.5px;
		color: #2b2410;
	}
	.field input {
		border: 0;
		background: transparent;
		padding: 0;
		font-size: 16px;
		width: 100%;
		min-height: 28px;
		outline-offset: 4px;
	}
	.field input::placeholder {
		color: #6b5418;
	}
	.year {
		flex: 0 0 70px;
		font-size: 16px;
	}
	.hint {
		margin: 0;
		font-size: 13px;
		color: #2b2410;
	}
	.paper {
		background: var(--paper);
		border: 1px solid #cfcfc9;
		gap: 12px;
	}
	.form {
		display: flex;
		border-top: 1px solid #8a8a84;
		border-bottom: 1px solid #8a8a84;
	}
	.form > div {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 6px 10px;
	}
	.form .mono {
		font-size: 10px;
		letter-spacing: 0.5px;
		color: #4a4a45;
	}
	.no {
		width: 64px;
		padding-left: 0 !important;
		border-right: 1px solid #8a8a84;
	}
	.paper img {
		flex: 1;
		min-height: 0;
		width: 100%;
		object-fit: contain;
		filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.12));
	}
	.acts {
		display: flex;
		justify-content: center;
		gap: 8px;
	}
	.acts .dark {
		background: var(--ink);
		border-color: var(--ink);
	}
	.blank {
		align-items: center;
		justify-content: center;
	}
	.first {
		margin: 16px auto 0;
	}
	.pager {
		margin: 16px auto 0;
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.pager span {
		min-width: 80px;
		text-align: center;
		font-size: 13px;
	}
	.pager button:disabled {
		opacity: 0.35;
	}

	/* grid */
	.grid {
		list-style: none;
		margin: 0;
		padding: 0 16px;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 16px;
	}
	.grid button {
		width: 100%;
		padding: 0;
		border: 0;
		background: none;
		display: flex;
		flex-direction: column;
		gap: 4px;
		text-align: left;
		font-size: 12px;
	}
	.grid img {
		width: 100%;
		aspect-ratio: 9 / 16;
		border-radius: 6px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
		margin-bottom: 4px;
	}
</style>
