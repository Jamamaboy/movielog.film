<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';

	// "☰ MENU / SECTION" header from the brand CI, with a full-screen menu.
	let { section, dark = false, right }: { section: string; dark?: boolean; right?: Snippet } = $props();

	let open = $state(false);

	const links = [
		{ href: '/', label: 'Home' },
		{ href: '/add', label: 'Add a page' },
		{ href: '/log', label: 'My Log' },
		{ href: '/data', label: 'Your data' }
	];

	function key(e: KeyboardEvent) {
		if (open && e.key === 'Escape') open = false;
	}
</script>

<svelte:window onkeydown={key} />

<header class="site" class:dark>
	<button class="menu-btn" type="button" aria-expanded={open} aria-controls="site-menu" onclick={() => (open = true)}>
		<span class="burger" aria-hidden="true"><span></span><span></span></span>
		<span>MENU</span>
	</button>
	<span class="slash" aria-hidden="true">/</span>
	<span class="section">{section}</span>
	<span class="grow"></span>
	{@render right?.()}
</header>

{#if open}
	<div id="site-menu" class="overlay" role="dialog" aria-modal="true" aria-label="Menu">
		<header class="site">
			<button class="menu-btn" type="button" onclick={() => (open = false)}>
				<span class="burger x" aria-hidden="true"><span></span><span></span></span>
				<span>CLOSE</span>
			</button>
		</header>
		<nav aria-label="Main">
			<ul>
				{#each links as l}
					<li>
						<a
							href={l.href}
							aria-current={page.url.pathname === l.href ? 'page' : undefined}
							onclick={() => (open = false)}>{l.label}</a
						>
					</li>
				{/each}
			</ul>
		</nav>
		<footer>
			<img src="/brand/logo.png" alt="Movie Log .film" width="164" height="125" />
			<p class="mono">
				v0.1.0 · saved on this device<br />
				<a href="https://github.com/Jamamaboy/movielog.film" target="_blank" rel="noreferrer">Open source on GitHub ↗</a>
			</p>
		</footer>
	</div>
{/if}

<style>
	.site {
		height: 64px;
		padding: 0 20px;
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 17px;
		font-weight: 500;
		letter-spacing: 0.01em;
		text-transform: uppercase;
	}
	.site.dark {
		color: #fff;
	}
	.menu-btn {
		display: inline-flex;
		align-items: center;
		gap: 18px;
		height: 44px;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		letter-spacing: inherit;
		color: inherit;
	}
	.burger {
		position: relative;
		width: 30px;
		height: 12px;
		display: inline-block;
	}
	.burger span {
		position: absolute;
		left: 0;
		width: 100%;
		height: 1.5px;
		background: currentColor;
		transition: transform 0.2s ease;
	}
	.burger span:first-child {
		top: 0;
	}
	.burger span:last-child {
		bottom: 0;
	}
	.burger.x span:first-child {
		transform: translateY(5.25px) rotate(28deg);
	}
	.burger.x span:last-child {
		transform: translateY(-5.25px) rotate(-28deg);
	}
	.slash {
		margin-left: -4px;
	}
	.section {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.grow {
		flex: 1;
	}

	.overlay {
		position: fixed;
		inset: 0;
		z-index: 60;
		background: var(--bg);
		color: var(--ink);
		display: flex;
		flex-direction: column;
		padding: env(safe-area-inset-top) 0 max(20px, env(safe-area-inset-bottom));
		animation: drop 0.22s ease;
	}
	nav {
		flex: 1;
		padding: 24px 20px;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--line);
	}
	li {
		border-bottom: 1px solid var(--line);
	}
	nav a {
		display: block;
		padding: 14px 0 10px;
		font-family: var(--display);
		font-size: clamp(40px, 11vw, 72px);
		font-weight: 700;
		line-height: 1;
		letter-spacing: -0.04em;
		word-spacing: 0.06em;
	}
	nav a[aria-current='page'] {
		color: var(--muted);
	}
	nav a:hover {
		color: var(--yellow-dark);
	}
	footer {
		padding: 0 20px;
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 16px;
	}
	footer img {
		width: 120px;
		height: auto;
	}
	footer p {
		margin: 0;
		font-size: 13px;
		line-height: 20px;
		color: var(--muted);
		text-align: right;
	}
	footer a {
		text-decoration: underline;
		color: var(--ink);
	}
	@keyframes drop {
		from {
			opacity: 0;
			transform: translateY(-12px);
		}
	}
</style>
