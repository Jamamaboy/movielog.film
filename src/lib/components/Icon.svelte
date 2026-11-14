<script lang="ts">
	type Name =
		| 'back'
		| 'next'
		| 'close'
		| 'plus'
		| 'book'
		| 'folder'
		| 'lock'
		| 'camera'
		| 'image'
		| 'download'
		| 'upload'
		| 'share'
		| 'check'
		| 'trash'
		| 'layout'
		| 'sticker'
		| 'grid'
		| 'ticket'
		| 'edit'
		| 'palette';

	let { name, size = 22, color = 'currentColor', stroke = 2 }: { name: Name; size?: number; color?: string; stroke?: number } =
		$props();
</script>

<svg
	aria-hidden="true"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke={color}
	stroke-width={stroke}
	stroke-linecap="round"
	stroke-linejoin="round"
>
	{#if name === 'back'}<path d="M15 5 L8 12 L15 19" />
	{:else if name === 'next'}<path d="M9 5 L16 12 L9 19" />
	{:else if name === 'close'}<path d="M6 6 L18 18 M18 6 L6 18" />
	{:else if name === 'plus'}<path d="M12 5 V19 M5 12 H19" />
	{:else if name === 'book'}<path d="M12 6 C9 4.5 6 4.5 3 5.5 V19 C6 18 9 18 12 19.5 C15 18 18 18 21 19 V5.5 C18 4.5 15 4.5 12 6 Z" /><path
			d="M12 6 V19.5"
		/>
	{:else if name === 'folder'}<path d="M3 7 a2 2 0 0 1 2 -2 h4 l2 2 h8 a2 2 0 0 1 2 2 v8 a2 2 0 0 1 -2 2 H5 a2 2 0 0 1 -2 -2 Z" />
	{:else if name === 'lock'}<rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11 V8 a4 4 0 0 1 8 0 V11" />
	{:else if name === 'camera'}<path d="M4 8 h3 l2 -3 h6 l2 3 h3 v11 H4 Z" /><circle cx="12" cy="13" r="3.5" />
	{:else if name === 'image'}<rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16 L15 11 L6 20" />
	{:else if name === 'download'}<path d="M12 4 V15 M7 10 L12 15 L17 10 M5 20 H19" />
	{:else if name === 'upload'}<path d="M12 15 V4 M7 9 L12 4 L17 9 M5 20 H19" />
	{:else if name === 'share'}<path d="M12 15 V4 M7 9 L12 4 L17 9 M5 13 V20 H19 V13" />
	{:else if name === 'check'}<path d="M5 12 L10 17 L19 7" />
	{:else if name === 'trash'}<path d="M4 7 H20 M9 7 V4 H15 V7 M6 7 L7 20 H17 L18 7" />
	{:else if name === 'layout'}<rect x="4" y="3" width="16" height="18" rx="2" /><path d="M4 10 H20" />
	{:else if name === 'sticker'}<path d="M20 12 a8 8 0 1 1 -8 -8 h8 Z" /><path d="M12 4 V12 H20" />
	{:else if name === 'grid'}<rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect
			x="4"
			y="13"
			width="7"
			height="7"
			rx="1"
		/><rect x="13" y="13" width="7" height="7" rx="1" />
	{:else if name === 'ticket'}<path d="M3 9 L21 5 L21 10 A2.5 2.5 0 0 0 21 15 L21 19 L3 21 L3 17 A2.5 2.5 0 0 0 3 12 Z" /><path
			d="M9 8.5 L9 19"
			stroke-dasharray="2 2.5"
		/>
	{:else if name === 'edit'}<path d="M4 20 L8 19 L19 8 L16 5 L5 16 Z" />
	{:else if name === 'palette'}<path d="M12 3 a9 9 0 1 0 0 18 c1.5 0 2 -1 2 -2 c0 -1.5 -1.5 -2 -0.5 -3 c0.8 -0.8 2 -0.5 3.5 -0.5 c2 0 4 -1.5 4 -4 C21 6.5 17 3 12 3 Z" /><circle
			cx="7.5"
			cy="11"
			r="1"
		/><circle cx="10" cy="7" r="1" /><circle cx="15" cy="7" r="1" />
	{/if}
</svg>
