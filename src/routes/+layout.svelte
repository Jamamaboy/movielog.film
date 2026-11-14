<script lang="ts">
	import '../app.css';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" type="image/png" href="/favicon.png" />
	<title>Movie Log .film</title>
</svelte:head>

{@render children()}
