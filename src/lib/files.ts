// Share, download, backup (.movielog) and "save to folder" helpers.

import { listEntries, putEntry, getMeta, setMeta, type Entry } from './db.js';

export function fileName(e: Pick<Entry, 'createdAt' | 'id'>): string {
	const d = new Date(e.createdAt);
	const p = (n: number) => String(n).padStart(2, '0');
	return `movielog-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${e.id.slice(0, 6)}.png`;
}

export function download(blob: Blob, name: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = name;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function canShareFiles(): boolean {
	try {
		const f = new File([new Blob()], 'x.png', { type: 'image/png' });
		return !!navigator.canShare?.({ files: [f] });
	} catch {
		return false;
	}
}

/** Opens the system share sheet (iPhone: Instagram, Save Image…). Falls back to a download. */
export async function shareImage(blob: Blob, name: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
	const file = new File([blob], name, { type: 'image/png' });
	if (navigator.canShare?.({ files: [file] })) {
		try {
			await navigator.share({ files: [file] });
			return 'shared';
		} catch (err) {
			if ((err as DOMException)?.name === 'AbortError') return 'cancelled';
		}
	}
	download(blob, name);
	return 'downloaded';
}

// ---------- backup file ----------

interface BackupFile {
	app: 'movielog.film';
	version: 1;
	exportedAt: number;
	name?: string;
	entries: { id: string; createdAt: number; template: number; image: string }[];
}

const toDataUrl = (b: Blob) =>
	new Promise<string>((resolve, reject) => {
		const r = new FileReader();
		r.onload = () => resolve(r.result as string);
		r.onerror = () => reject(r.error);
		r.readAsDataURL(b);
	});

export async function exportBackup(): Promise<{ blob: Blob; name: string; count: number }> {
	const entries = await listEntries();
	const data: BackupFile = {
		app: 'movielog.film',
		version: 1,
		exportedAt: Date.now(),
		name: await getMeta<string>('name'),
		entries: await Promise.all(
			entries.map(async (e) => ({ id: e.id, createdAt: e.createdAt, template: e.template, image: await toDataUrl(e.image) }))
		)
	};
	const d = new Date();
	const name = `movielog-backup-${d.toISOString().slice(0, 10)}.movielog`;
	return { blob: new Blob([JSON.stringify(data)], { type: 'application/json' }), name, count: entries.length };
}

export async function importBackup(file: File): Promise<number> {
	const data = JSON.parse(await file.text()) as BackupFile;
	if (data?.app !== 'movielog.film' || !Array.isArray(data.entries)) {
		throw new Error('This is not a Movie Log backup file.');
	}
	for (const e of data.entries) {
		const image = await (await fetch(e.image)).blob();
		await putEntry({ id: e.id, createdAt: e.createdAt, template: e.template, image });
	}
	if (data.name && !(await getMeta('name'))) await setMeta('name', data.name);
	return data.entries.length;
}

// ---------- save to a folder (desktop Chrome / Edge) ----------

type DirHandle = {
	getFileHandle(name: string, o?: { create?: boolean }): Promise<{
		createWritable(): Promise<{ write(d: Blob | string): Promise<void>; close(): Promise<void> }>;
	}>;
};

export function canUseFolders(): boolean {
	return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/** Writes every page as a PNG plus a log.json into a folder the user picks. */
export async function saveToFolder(): Promise<number> {
	const picker = (window as unknown as { showDirectoryPicker: (o?: object) => Promise<DirHandle> }).showDirectoryPicker;
	const dir = await picker({ mode: 'readwrite' });
	const entries = await listEntries();
	const write = async (name: string, data: Blob | string) => {
		const fh = await dir.getFileHandle(name, { create: true });
		const w = await fh.createWritable();
		await w.write(data);
		await w.close();
	};
	for (const e of entries) await write(fileName(e), e.image);
	await write(
		'log.json',
		JSON.stringify(
			entries.map((e) => ({ id: e.id, createdAt: new Date(e.createdAt).toISOString(), template: e.template, file: fileName(e) })),
			null,
			2
		)
	);
	return entries.length;
}
