<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '#lib/components/Icon.svelte';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import { listEntries, clearEntries } from '#lib/db.js';
	import { exportBackup, importBackup, download, canUseFolders, saveToFolder } from '#lib/files.js';

	let count = $state(0);
	let bytes = $state(0);
	let folders = $state(false);
	let msg = $state('');
	let err = $state('');

	onMount(() => {
		folders = canUseFolders();
		refresh();
	});

	async function refresh() {
		const all = await listEntries();
		count = all.length;
		bytes = all.reduce((s, e) => s + e.image.size, 0);
	}

	const mb = (b: number) => (b / 1024 / 1024).toFixed(1);

	async function act(fn: () => Promise<string>) {
		msg = '';
		err = '';
		try {
			msg = await fn();
			await refresh();
		} catch (e) {
			if ((e as DOMException)?.name === 'AbortError') return;
			err = (e as Error).message || 'Something went wrong.';
		}
	}

	const doExport = () =>
		act(async () => {
			const { blob, name, count } = await exportBackup();
			download(blob, name);
			return `Exported ${count} page${count === 1 ? '' : 's'} to ${name}`;
		});

	const doImport = (file: File | undefined) =>
		file &&
		act(async () => {
			const n = await importBackup(file);
			return `Imported ${n} page${n === 1 ? '' : 's'}`;
		});

	const doFolder = () =>
		act(async () => {
			const n = await saveToFolder();
			return `Saved ${n} page${n === 1 ? '' : 's'} and log.json to the folder`;
		});

	const doClear = () =>
		act(async () => {
			if (!confirm('Delete every page on this device? Export a backup first if you want to keep them.')) return '';
			await clearEntries();
			return 'All pages deleted from this device';
		});
</script>

<svelte:head><title>Your data · Movie Log .film</title></svelte:head>

<main class="screen data">
	<div class="full"><SiteHeader section="Your data" /></div>

	<div class="note">
		<Icon name="lock" />
		<p><b>Everything stays on this device.</b> No account and no server — your photos never leave your phone or computer.</p>
	</div>

	<h2 class="mono">ON THIS DEVICE</h2>
	<div class="card">
		<div class="line"><b>{count} page{count === 1 ? '' : 's'}</b><span class="muted">{mb(bytes)} MB</span></div>
		<p class="muted">Saved in this browser. Clearing your browser data deletes it, so export a backup now and then.</p>
	</div>

	<h2 class="mono">BACKUP</h2>
	<div class="card">
		<button class="btn primary" type="button" onclick={doExport} disabled={count === 0}>
			<Icon name="download" size={18} color={count === 0 ? '#5f5f5a' : '#fff'} /> Export .movielog file
		</button>
		<label class="btn">
			<Icon name="upload" size={18} /> Import a backup
			<input class="visually-hidden" type="file" accept=".movielog,application/json" onchange={(e) => doImport(e.currentTarget.files?.[0])} />
		</label>
		<p class="muted">One file with every page. Open it on any device to continue.</p>
	</div>

	<h2 class="mono">FOLDER</h2>
	<div class="card">
		<div class="line">
			<b>Save to a folder</b>
			{#if !folders}<span class="pill">Computer only</span>{/if}
		</div>
		<p class="muted">
			{folders
				? 'Writes every page as a PNG plus log.json into a folder you pick.'
				: 'Works in Chrome or Edge on a computer. On iPhone, use Export instead.'}
		</p>
		<button class="btn" class:ghost={!folders} type="button" disabled={!folders || count === 0} onclick={doFolder}>
			<Icon name="folder" size={18} /> Choose folder
		</button>
	</div>

	{#if msg}<p class="ok" role="status">{msg}</p>{/if}
	{#if err}<p class="err" role="alert">{err}</p>{/if}

	<button class="btn danger clear" type="button" onclick={doClear} disabled={count === 0}>Delete all pages</button>
	<p class="foot muted">Movie Log .film · v0.1.0 · open source (MIT)</p>
</main>

<style>
	.data {
		max-width: 560px;
		margin: 0 auto;
		width: 100%;
		padding-left: 16px;
		padding-right: 16px;
		padding-bottom: max(24px, env(safe-area-inset-bottom));
	}
	.full {
		margin: 0 -16px;
	}
	.note {
		margin-top: 4px;
		padding: 16px;
		border-radius: var(--radius);
		background: var(--yellow);
		display: flex;
		gap: 12px;
		align-items: flex-start;
	}
	.note p {
		margin: 0;
		font-size: 14px;
		line-height: 20px;
	}
	h2 {
		margin: 22px 4px 8px;
		font-size: 12px;
		letter-spacing: 1px;
		font-weight: 500;
		color: var(--muted);
	}
	.card {
		padding: 16px;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--line);
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.card p {
		margin: 0;
		font-size: 13px;
		line-height: 18px;
	}
	.card .btn {
		height: 48px;
		font-size: 15px;
		cursor: pointer;
	}
	.line {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 15px;
	}
	.pill {
		font-size: 12px;
		font-weight: 600;
		padding: 4px 8px;
		border-radius: 10px;
		background: #ececE8;
		color: #4a4a45;
	}
	.ok,
	.err {
		margin: 16px 0 0;
		padding: 12px 14px;
		border-radius: 12px;
		font-size: 14px;
	}
	.ok {
		background: #e7f4ea;
		color: #1e5a2e;
	}
	.err {
		background: #fdecea;
		color: var(--danger);
	}
	.clear {
		margin-top: 24px;
		background: transparent;
	}
	.clear:disabled {
		opacity: 0.4;
	}
	.foot {
		text-align: center;
		font-size: 12px;
		margin: 16px 0 0;
	}
</style>
