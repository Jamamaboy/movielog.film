<script lang="ts">
	import { goto } from '$app/navigation';
	import Icon from '#lib/components/Icon.svelte';
	import BoxPicker from '#lib/components/BoxPicker.svelte';
	import PhotoAdjust from '#lib/components/PhotoAdjust.svelte';
	import SendAnimation from '#lib/components/SendAnimation.svelte';
	import {
		loadImage,
		estimateSkew,
		deskew,
		detectEntries,
		extractInk,
		renderStory,
		canvasToBlob,
		clampPhoto,
		type Rect,
		type PhotoState
	} from '#lib/imaging.js';
	import { TEMPLATES, templateById, layoutStory, STORY_W, STORY_H } from '#lib/templates.js';
	import { putEntry, newId, formatDate } from '#lib/db.js';
	import { THEMES, INKS, themeById, reviewAspect, DEFAULT_STYLE, type CardStyle, type ThemeId } from '#lib/themes.js';
	import { shareImage, download, fileName } from '#lib/files.js';

	type Step = 'capture' | 'select' | 'layout' | 'photos' | 'done';
	const STEP_NO: Record<Step, number> = { capture: 1, select: 2, layout: 3, photos: 4, done: 4 };

	let step = $state<Step>('capture');
	let busy = $state<string | null>(null);
	let error = $state<string | null>(null);

	// capture + select
	let source = $state.raw<HTMLCanvasElement | null>(null);
	let sourceUrl = $state('');
	let boxes = $state<Rect[]>([]);
	let guessed = $state(false);
	let selected = $state(0);
	let ink = $state.raw<HTMLCanvasElement | null>(null);
	let inkUrl = $state('');

	// layout + photos
	let templateId = $state(3);
	let photos = $state.raw<(PhotoState | null)[]>([]);
	let adjusting = $state<number | null>(null);
	let pendingSlot = -1;
	let photoInput = $state<HTMLInputElement>();

	// result
	let result = $state<{ url: string; blob: Blob; name: string; createdAt: number } | null>(null);
	let sending = $state(false);
	let toast = $state('');

	const template = $derived(templateById(templateId));

	// card style (theme + ink colour), remembered on this device
	function loadStyle(): CardStyle {
		try {
			const v = JSON.parse(localStorage.getItem('movielog.style') ?? '');
			if (v && typeof v.theme === 'string' && typeof v.ink === 'string') return { theme: themeById(v.theme).id, ink: v.ink };
		} catch {
			/* first visit or storage blocked */
		}
		return { ...DEFAULT_STYLE };
	}
	let style = $state<CardStyle>(loadStyle());
	let styling = $state(false);
	const isHex = $derived(/^#[0-9a-f]{6}$/i.test(style.ink));
	$effect(() => {
		const v = JSON.stringify({ theme: style.theme, ink: style.ink });
		try {
			localStorage.setItem('movielog.style', v);
		} catch {
			/* ignore */
		}
	});
	function setTheme(id: ThemeId) {
		style = { theme: id, ink: themeById(id).ink };
	}

	// photo boxes of the current layout, in story pixels (they follow the review's shape and theme)
	const slots = $derived(
		layoutStory(template, ink ? reviewAspect(ink, style.theme) : undefined).filter((b) => b.kind === 'photo')
	);
	const filled = $derived(slots.filter((_, i) => photos[i]).length);
	const ready = $derived(filled === slots.length);
	const reviewNo = $derived(String(selected + 1).padStart(2, '0'));

	// ---------- capture ----------

	async function onPhoto(file: Blob | undefined | null) {
		if (!file) return;
		error = null;
		busy = 'Finding the reviews on your page…';
		try {
			const raw = await loadImage(file, 2000);
			await tick();
			const c = deskew(raw, estimateSkew(raw));
			source = c;
			sourceUrl = c.toDataURL('image/jpeg', 0.85);
			await tick();
			const found = detectEntries(c);
			boxes = found.boxes;
			guessed = found.guessed;
			selected = 0;
			await refreshInk();
			step = 'select';
		} catch (err) {
			console.error(err);
			error = 'Could not read that photo. Try another one.';
		} finally {
			busy = null;
		}
	}

	async function useSample() {
		busy = 'Loading sample page…';
		try {
			const res = await fetch('/sample/page.jpg');
			await onPhoto(await res.blob());
		} catch {
			busy = null;
			error = 'Sample page not found.';
		}
	}

	const tick = () => new Promise((r) => setTimeout(r, 30));

	async function refreshInk() {
		if (!source || !boxes[selected]) return;
		await tick();
		const out = extractInk(source, boxes[selected]);
		ink = out;
		inkUrl = out.toDataURL('image/png');
	}

	// ---------- photos ----------

	function addPhoto(i: number) {
		pendingSlot = i;
		if (!photoInput) return;
		photoInput.value = '';
		photoInput.click();
	}

	async function onSlotFile(file: File | undefined) {
		if (!file || pendingSlot < 0) return;
		busy = 'Loading photo…';
		try {
			const img = await loadImage(file, 2400);
			const next = [...photos];
			next[pendingSlot] = clampPhoto({ img, zoom: 1, ox: 0, oy: 0 }, 1, 1);
			photos = next;
			adjusting = pendingSlot;
		} catch {
			error = 'Could not read that photo.';
		} finally {
			busy = null;
		}
	}

	function setPhoto(i: number, p: PhotoState | null) {
		const next = [...photos];
		next[i] = p;
		photos = next;
	}

	function chooseTemplate(id: number) {
		templateId = id;
		const n = templateById(id).photos;
		photos = Array.from({ length: n }, (_, i) => photos[i] ?? null);
	}

	// ---------- canvas drawing ----------

	function storyCanvas(node: HTMLCanvasElement, w: number) {
		node.width = w;
		node.height = Math.round((w * STORY_H) / STORY_W);
	}

	let editorCanvas = $state<HTMLCanvasElement>();
	$effect(() => {
		if (step === 'photos' && editorCanvas) {
			storyCanvas(editorCanvas, 720);
			renderStory(editorCanvas, template, ink, photos, true, { ...style });
		}
	});

	let thumbs = $state<HTMLCanvasElement[]>([]);
	$effect(() => {
		if (step !== 'layout') return;
		TEMPLATES.forEach((t, i) => {
			const c = thumbs[i];
			if (!c) return;
			storyCanvas(c, 360);
			renderStory(c, t, ink, [], true, { ...style });
		});
	});

	// ---------- finish ----------

	async function finish() {
		busy = 'Making your story…';
		try {
			const c = document.createElement('canvas');
			storyCanvas(c, STORY_W);
			renderStory(c, template, ink, photos, false, { ...style });
			const blob = await canvasToBlob(c);
			const entry = { id: newId(), createdAt: Date.now(), template: templateId, image: blob };
			await putEntry(entry);
			result = { url: URL.createObjectURL(blob), blob, name: fileName(entry), createdAt: entry.createdAt };
			busy = null;
			sending = true;
		} catch (err) {
			console.error(err);
			busy = null;
			error = 'Could not save. Is storage full or blocked (private browsing)?';
		}
	}

	async function share() {
		if (!result) return;
		const r = await shareImage(result.blob, result.name);
		if (r === 'downloaded') flash('Downloaded');
	}

	function flash(msg: string) {
		toast = msg;
		setTimeout(() => (toast = ''), 2000);
	}

	function restart() {
		step = 'capture';
		source = null;
		boxes = [];
		ink = null;
		photos = [];
		result = null;
	}

	function back() {
		if (step === 'capture' || step === 'done') goto('/');
		else if (step === 'select') step = 'capture';
		else if (step === 'layout') step = 'select';
		else if (step === 'photos') step = 'layout';
	}

	const pct = (v: number) => `${v}%`;
</script>

<svelte:head><title>Add · Movie Log .film</title></svelte:head>

<main class="screen add" class:dark={step === 'capture'}>
	<header class="topbar">
		<button class="icon-btn" type="button" aria-label={step === 'capture' || step === 'done' ? 'Close' : 'Back'} onclick={back}>
			<Icon name={step === 'capture' || step === 'done' ? 'close' : 'back'} />
		</button>
		<h1>
			{#if step === 'capture'}Capture{:else if step === 'select'}Select a review{:else if step === 'layout'}Choose a layout{:else if step === 'photos'}Add photos{:else}Share &amp; keep{/if}
		</h1>
		<span class="step mono">{step === 'done' ? '' : `${STEP_NO[step]}/4`}</span>
	</header>
	{#if step !== 'done'}
		<div class="progress" aria-hidden="true">
			{#each [1, 2, 3, 4] as n}<span class:on={n <= STEP_NO[step]}></span>{/each}
		</div>
	{/if}

	{#if step === 'capture'}
		<section class="capture">
			<div class="viewfinder">
				<span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
				<div class="vf-text">
					<Icon name="camera" size={40} stroke={1.5} color="#fff" />
					<p>Take a photo of one page of your Movie Log.<br />Fit the whole page, keep it flat, in good light.</p>
				</div>
			</div>
			<div class="capture-actions">
				<label class="btn primary big">
					<Icon name="camera" />
					<span>Take photo</span>
					<input class="visually-hidden" type="file" accept="image/*" capture="environment" onchange={(e) => onPhoto(e.currentTarget.files?.[0])} />
				</label>
				<label class="btn big">
					<Icon name="image" />
					<span>Choose a photo</span>
					<input class="visually-hidden" type="file" accept="image/*" onchange={(e) => onPhoto(e.currentTarget.files?.[0])} />
				</label>
				<button class="linkish" type="button" onclick={useSample}>No book nearby? Try a sample page</button>
			</div>
		</section>
	{:else if step === 'select' && source}
		<section class="col">
			<div class="pick" style:width="min(100%, calc((100dvh - 360px) * {source.width / source.height}))">
				<BoxPicker src={sourceUrl} aspect={source.width / source.height} bind:boxes bind:selected onchange={refreshInk} />
			</div>
			<p class="row">
				{#if guessed}
					<span>Couldn’t find the boxes — drag the corners to fit your review.</span>
				{:else}
					<span><b>{boxes.length} box{boxes.length === 1 ? '' : 'es'} found</b> · tap one, drag corners to adjust</span>
				{/if}
			</p>
			<div class="preview">
				<div class="checker ink">{#if inkUrl}<img src={inkUrl} alt="Review {reviewNo} with background removed" />{/if}</div>
				<div>
					<strong>Background removed</strong>
					<p class="muted">Only your handwriting and the printed lines are kept, on a transparent background.</p>
				</div>
			</div>
			<button class="btn primary wide" type="button" onclick={() => (step = 'layout')} disabled={!ink}>Use review {reviewNo}</button>
		</section>
	{:else if step === 'layout'}
		<section class="col">
			<div class="layouts">
				{#each TEMPLATES as t, i}
					<button type="button" class="layout" class:on={t.id === templateId} aria-pressed={t.id === templateId} onclick={() => chooseTemplate(t.id)}>
						<span class="thumb">
							<canvas bind:this={thumbs[i]} aria-hidden="true"></canvas>
							{#if t.id === templateId}<span class="tick"><Icon name="check" size={14} color="#fff" stroke={3.5} /></span>{/if}
						</span>
						<span class="name"><b>#{t.id}</b> {t.name}</span>
					</button>
				{/each}
			</div>
			<button class="btn primary wide" type="button" onclick={() => (step = 'photos')}>Use layout #{templateId}</button>
		</section>
	{:else if step === 'photos'}
		<section class="col">
			<p class="row between">
				<span><b>Photos {filled} / {slots.length}</b> · layout #{templateId}</span>
				<span class="muted small">{ready && slots.length ? 'Tap a photo to adjust' : slots.length ? 'Tap a slot to add' : 'No photos in this layout'}</span>
			</p>
			<div class="story" class:small={styling}>
				<canvas bind:this={editorCanvas} aria-label="Story preview"></canvas>
				{#each slots as r, i}
					<button
						type="button"
						class="slot"
						aria-label={photos[i] ? `Edit photo ${i + 1}` : `Add photo ${i + 1}`}
						style:left={pct((r.x / STORY_W) * 100)}
						style:top={pct((r.y / STORY_H) * 100)}
						style:width={pct((r.w / STORY_W) * 100)}
						style:height={pct((r.h / STORY_H) * 100)}
						onclick={() => (photos[i] ? (adjusting = i) : addPhoto(i))}
					>
						{#if photos[i]}<span class="edit"><Icon name="edit" size={16} /></span>{/if}
					</button>
				{/each}
			</div>
			{#if styling}
				<div class="style-panel">
					<div class="sp-head">
						<b>Review style</b>
						<button class="btn primary sp-done" type="button" onclick={() => (styling = false)}>Done</button>
					</div>
					<div class="themes" role="radiogroup" aria-label="Card theme">
						{#each THEMES as t}
							<button
								type="button"
								role="radio"
								aria-checked={style.theme === t.id}
								class="theme"
								class:on={style.theme === t.id}
								onclick={() => setTheme(t.id)}
							>
								<span class="chip"><span class="mini mini-{t.id}">Aa</span></span>
								<span class="tname">{t.name}</span>
							</button>
						{/each}
					</div>
					<div class="inks" role="radiogroup" aria-label="Text colour">
						<span class="lbl">Text</span>
						{#each INKS as c}
							<button
								type="button"
								role="radio"
								aria-checked={style.ink === c.id}
								aria-label={c.name}
								title={c.name}
								class="sw"
								class:on={style.ink === c.id}
								class:pen={c.id === 'original'}
								style:background={c.id === 'original' ? undefined : c.id}
								onclick={() => (style.ink = c.id)}
							></button>
						{/each}
						<label class="sw custom" class:on={isHex && !INKS.some((c) => c.id === style.ink)} title="Custom colour">
							<span class="visually-hidden">Custom colour</span>
							<input type="color" value={isHex ? style.ink : '#111111'} oninput={(e) => (style.ink = e.currentTarget.value.toUpperCase())} />
						</label>
					</div>
				</div>
			{:else}
				<div class="tools">
					<button class="btn" type="button" onclick={() => (step = 'layout')}><Icon name="layout" size={18} /> Layout</button>
					<button class="btn" type="button" onclick={() => (styling = true)}><Icon name="palette" size={18} /> Style</button>
					<button class="btn ghost" type="button" disabled><Icon name="sticker" size={18} /> Stickers · soon</button>
				</div>
				<button class="btn primary wide" type="button" disabled={!ready} onclick={finish}>
					{ready ? 'Finish' : `Finish · add ${slots.length - filled} more photo${slots.length - filled === 1 ? '' : 's'}`}
				</button>
			{/if}
			<input bind:this={photoInput} class="visually-hidden" type="file" accept="image/*" tabindex="-1" onchange={(e) => onSlotFile(e.currentTarget.files?.[0])} />
		</section>
	{:else if step === 'done' && result}
		<section class="col">
			<p class="saved"><Icon name="check" size={16} color="#1E7A3A" stroke={3} /> <b>Saved to My Log</b> · added {formatDate(result.createdAt)}</p>
			<img class="result" src={result.url} alt="Your finished story" />
			<p class="mono muted small center">PNG · 1080 × 1920 · Story</p>
			<div class="two">
				<button class="btn" type="button" onclick={() => result && download(result.blob, result.name)}><Icon name="download" size={18} /> Download</button>
				<button class="btn primary" type="button" onclick={share}><Icon name="share" size={18} /> Share</button>
			</div>
			<div class="two">
				<button class="btn linkbtn" type="button" onclick={restart}>Add another</button>
				<a class="btn linkbtn" href="/log">Open My Log</a>
			</div>
		</section>
	{/if}

	{#if error}<p class="error" role="alert">{error}</p>{/if}
</main>

{#if adjusting !== null && photos[adjusting]}
	{@const r = slots[adjusting]}
	<PhotoAdjust
		photo={photos[adjusting]!}
		aspect={r.w / r.h}
		index={adjusting}
		onclose={() => (adjusting = null)}
		ondone={(p) => {
			setPhoto(adjusting!, p);
			adjusting = null;
		}}
		onremove={() => {
			setPhoto(adjusting!, null);
			adjusting = null;
		}}
		onreplace={() => {
			const i = adjusting!;
			adjusting = null;
			addPhoto(i);
		}}
	/>
{/if}

{#if busy}
	<div class="busy" role="status"><span class="spinner"></span>{busy}</div>
{/if}

{#if sending && result}
	<SendAnimation
		src={result.url}
		ondone={() => {
			sending = false;
			step = 'done';
		}}
	/>
{/if}

{#if toast}<div class="toast" role="status">{toast}</div>{/if}

<style>
	.add {
		max-width: 600px;
		margin: 0 auto;
		width: 100%;
		padding-bottom: max(20px, env(safe-area-inset-bottom));
	}
	.add.dark {
		max-width: none;
		background: #0e0e0e;
		color: #fff;
	}
	.step {
		width: 44px;
		text-align: center;
		font-size: 12px;
		color: var(--muted);
	}
	.dark .step {
		color: #bdbdb6;
	}
	.progress {
		margin: 0 16px 12px;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 4px;
	}
	.progress span {
		height: 4px;
		border-radius: 2px;
		background: var(--line);
	}
	.progress span.on {
		background: var(--ink);
	}
	.dark .progress span {
		background: #3a3a37;
	}
	.dark .progress span.on {
		background: #fff;
	}
	.dark .progress,
	.dark .topbar {
		max-width: 600px;
		width: 100%;
		margin-left: auto;
		margin-right: auto;
	}
	.dark .progress {
		width: calc(100% - 32px);
	}

	/* capture */
	.capture {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 20px;
		padding: 0 16px;
		max-width: 600px;
		width: 100%;
		margin: 0 auto;
	}
	.viewfinder {
		position: relative;
		flex: 1;
		min-height: 300px;
		border-radius: 16px;
		background: #1f1f1d;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.vf-text {
		text-align: center;
		color: #d8d8d2;
		font-size: 15px;
		line-height: 22px;
		padding: 24px;
	}
	.c {
		position: absolute;
		width: 36px;
		height: 36px;
		border: 0 solid var(--yellow);
	}
	.tl {
		left: 24px;
		top: 24px;
		border-top-width: 4px;
		border-left-width: 4px;
		border-radius: 6px 0 0 0;
	}
	.tr {
		right: 24px;
		top: 24px;
		border-top-width: 4px;
		border-right-width: 4px;
		border-radius: 0 6px 0 0;
	}
	.bl {
		left: 24px;
		bottom: 24px;
		border-bottom-width: 4px;
		border-left-width: 4px;
		border-radius: 0 0 0 6px;
	}
	.br {
		right: 24px;
		bottom: 24px;
		border-bottom-width: 4px;
		border-right-width: 4px;
		border-radius: 0 0 6px 0;
	}
	.capture-actions {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.big {
		height: 56px;
		border-radius: 28px;
		cursor: pointer;
	}
	.dark .btn.primary {
		background: #fff;
		color: var(--ink);
		border-color: #fff;
	}
	.dark .btn:not(.primary) {
		background: transparent;
		color: #fff;
		border-color: #55554f;
	}
	.linkish {
		height: 44px;
		border: 0;
		background: none;
		text-decoration: underline;
		font-size: 14px;
		color: #d8d8d2;
	}

	/* shared column */
	.col {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 0 16px;
	}
	.pick {
		margin: 0 auto;
		min-width: 200px;
	}
	.row {
		margin: 0;
		font-size: 14px;
		display: flex;
		gap: 8px;
	}
	.between {
		justify-content: space-between;
		align-items: center;
	}
	.small {
		font-size: 13px;
	}
	.center {
		text-align: center;
		margin: 0;
	}
	.preview {
		display: flex;
		gap: 12px;
		align-items: center;
		padding: 12px;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--line);
	}
	.preview p {
		margin: 4px 0 0;
		font-size: 13px;
		line-height: 18px;
	}
	.ink {
		width: 150px;
		height: 106px;
		border-radius: 10px;
		overflow: hidden;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.ink img {
		max-width: 100%;
		max-height: 100%;
	}
	.wide {
		width: 100%;
		margin-top: auto;
		height: 56px;
		border-radius: 28px;
	}

	/* layouts */
	.layouts {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 14px 18px;
		width: min(100%, calc((100dvh - 260px) * 0.6));
		margin: 4px auto 0;
	}
	@media (min-width: 700px) {
		.layouts {
			grid-template-columns: repeat(4, minmax(0, 1fr));
			width: 100%;
		}
	}
	.layout {
		padding: 0;
		border: 0;
		background: none;
		display: flex;
		flex-direction: column;
		gap: 8px;
		text-align: left;
	}
	.thumb {
		position: relative;
		display: block;
		width: 100%;
		border-radius: 6px;
		outline: 1px solid var(--line);
		outline-offset: 0;
	}
	.layout.on .thumb {
		outline: 3px solid var(--ink);
		outline-offset: 3px;
	}
	.thumb canvas {
		display: block;
		width: 100%;
		aspect-ratio: 9 / 16;
		border-radius: 6px;
	}
	.tick {
		position: absolute;
		right: 8px;
		top: 8px;
		width: 28px;
		height: 28px;
		border-radius: 14px;
		background: var(--ink);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.name {
		font-size: 13px;
		line-height: 16px;
		min-height: 32px;
	}

	/* editor */
	.story {
		position: relative;
		width: min(100%, calc((100dvh - 290px) * 0.5625));
		min-width: 220px;
		margin: 0 auto;
		aspect-ratio: 9 / 16;
		border-radius: 6px;
		box-shadow: 0 6px 24px rgba(0, 0, 0, 0.14);
	}
	.story canvas {
		width: 100%;
		height: 100%;
		display: block;
		border-radius: 6px;
	}
	.slot {
		position: absolute;
		border: 0;
		padding: 0;
		background: transparent;
		border-radius: 4px;
	}
	.slot:hover {
		background: rgba(255, 255, 255, 0.12);
	}
	.edit {
		position: absolute;
		right: 8px;
		top: 8px;
		width: 32px;
		height: 32px;
		border-radius: 16px;
		background: rgba(255, 255, 255, 0.92);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.tools {
		display: flex;
		justify-content: center;
		flex-wrap: wrap;
		gap: 8px;
	}
	.story.small {
		width: min(100%, calc((100dvh - 470px) * 0.5625));
		min-width: 170px;
	}

	/* style panel */
	.style-panel {
		margin-top: auto;
		padding: 12px;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--line);
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.sp-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 15px;
	}
	.sp-done {
		height: 40px;
		padding: 0 18px;
		font-size: 14px;
	}
	.themes {
		display: flex;
		gap: 10px;
		overflow-x: auto;
		padding: 4px 2px 2px;
		scrollbar-width: none;
	}
	.theme {
		flex: 0 0 auto;
		padding: 0;
		border: 0;
		background: none;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}
	.chip {
		width: 64px;
		height: 64px;
		border-radius: 12px;
		background: var(--yellow);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.theme.on .chip {
		outline: 3px solid var(--ink);
		outline-offset: 2px;
	}
	.tname {
		font-size: 12px;
		font-weight: 500;
	}
	.mini {
		width: 46px;
		height: 32px;
		border-radius: 5px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 14px;
		font-weight: 700;
	}
	.mini-clear {
		color: #111;
	}
	.mini-paper {
		background: #fff;
		color: #111;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
	}
	.mini-gray {
		background: #e6e6e2;
		color: #1a1a1a;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.14);
	}
	.mini-space {
		color: #f7f1e1;
		background:
			radial-gradient(1.2px 1.2px at 18% 28%, #fff 98%, transparent),
			radial-gradient(1px 1px at 72% 22%, #fff 98%, transparent),
			radial-gradient(1.5px 1.5px at 84% 74%, #ffe9b8 98%, transparent),
			radial-gradient(1px 1px at 30% 82%, #fff 98%, transparent),
			radial-gradient(circle at 80% 25%, rgba(140, 90, 220, 0.55), transparent 60%),
			linear-gradient(160deg, #070b1f, #141a44 55%, #2a1c55);
		text-shadow: 0 0 4px rgba(255, 255, 255, 0.5);
	}
	.mini-film {
		color: #fff;
		background: #121212;
		border-top: 5px dotted #ece7da;
		border-bottom: 5px dotted #ece7da;
		height: 36px;
		font-size: 12px;
	}
	.mini-ticket {
		color: #3b2a14;
		background:
			radial-gradient(circle at 0 50%, var(--yellow) 4px, transparent 4.5px),
			radial-gradient(circle at 100% 50%, var(--yellow) 4px, transparent 4.5px),
			#f4e8cc;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.14);
	}
	.inks {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.lbl {
		font-size: 13px;
		font-weight: 600;
		margin-right: 2px;
	}
	.sw {
		position: relative;
		width: 32px;
		height: 32px;
		border-radius: 16px;
		border: 1px solid rgba(0, 0, 0, 0.18);
		padding: 0;
		cursor: pointer;
	}
	.sw::before {
		content: '';
		position: absolute;
		inset: -6px;
	}
	.sw.on {
		outline: 3px solid var(--ink);
		outline-offset: 2px;
	}
	.sw.pen {
		background: conic-gradient(#1f3a93 0 50%, #111 50% 100%);
	}
	.sw.custom {
		background: conic-gradient(#e53935, #fdd835, #43a047, #1e88e5, #8e24aa, #e53935);
		overflow: hidden;
	}
	.sw.custom input {
		position: absolute;
		inset: 0;
		opacity: 0;
		width: 100%;
		height: 100%;
		cursor: pointer;
	}
	.tools .btn {
		height: 44px;
		font-size: 14px;
		font-weight: 500;
		padding: 0 14px;
	}

	/* done */
	.saved {
		margin: 0 auto;
		display: flex;
		align-items: center;
		gap: 8px;
		height: 36px;
		padding: 0 14px;
		border-radius: 18px;
		background: var(--surface);
		border: 1px solid var(--line);
		font-size: 14px;
	}
	.result {
		width: min(100%, calc((100dvh - 330px) * 0.5625));
		min-width: 200px;
		margin: 0 auto;
		border-radius: 6px;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
	}
	.two {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.linkbtn {
		border: 0;
		background: none;
		text-decoration: underline;
		height: 44px;
		font-size: 14px;
	}

	.error {
		margin: 12px 16px 0;
		padding: 12px 14px;
		border-radius: 12px;
		background: #fdecea;
		color: var(--danger);
		font-size: 14px;
	}
	.busy {
		position: fixed;
		inset: 0;
		z-index: 30;
		background: rgba(17, 17, 17, 0.6);
		color: #fff;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		font-size: 15px;
		font-weight: 500;
	}
	.spinner {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: 4px solid rgba(255, 255, 255, 0.3);
		border-top-color: var(--yellow);
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.toast {
		position: fixed;
		left: 50%;
		bottom: calc(24px + env(safe-area-inset-bottom));
		transform: translateX(-50%);
		z-index: 50;
		background: var(--ink);
		color: #fff;
		padding: 10px 16px;
		border-radius: 20px;
		font-size: 14px;
	}
</style>
