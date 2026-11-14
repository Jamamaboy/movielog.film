// Local storage for My Log, in the browser's IndexedDB. Nothing leaves the device.

export interface Entry {
	id: string;
	createdAt: number;
	template: number;
	image: Blob; // the finished 1080 × 1920 PNG
}

const DB_NAME = 'movielog';
const ENTRIES = 'entries';
const META = 'meta';

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
	if (!dbPromise) {
		dbPromise = new Promise((resolve, reject) => {
			const req = indexedDB.open(DB_NAME, 1);
			req.onupgradeneeded = () => {
				const db = req.result;
				if (!db.objectStoreNames.contains(ENTRIES)) db.createObjectStore(ENTRIES, { keyPath: 'id' });
				if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
			};
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});
	}
	return dbPromise;
}

async function run<T>(
	store: string,
	mode: IDBTransactionMode,
	fn: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
	const db = await open();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(store, mode);
		const req = fn(tx.objectStore(store));
		tx.oncomplete = () => resolve(req.result);
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error);
	});
}

// Images are stored as raw bytes: Safari (private tabs, older iOS) refuses Blobs in IndexedDB.
interface StoredEntry {
	id: string;
	createdAt: number;
	template: number;
	bytes: ArrayBuffer;
	type: string;
}

export async function listEntries(): Promise<Entry[]> {
	const all = await run<StoredEntry[]>(ENTRIES, 'readonly', (s) => s.getAll());
	return all
		.map((r) => ({ id: r.id, createdAt: r.createdAt, template: r.template, image: new Blob([r.bytes], { type: r.type }) }))
		.sort((a, b) => a.createdAt - b.createdAt);
}

export async function putEntry(e: Entry) {
	const rec: StoredEntry = {
		id: e.id,
		createdAt: e.createdAt,
		template: e.template,
		bytes: await e.image.arrayBuffer(),
		type: e.image.type || 'image/png'
	};
	return run(ENTRIES, 'readwrite', (s) => s.put(rec));
}
export const deleteEntry = (id: string) => run(ENTRIES, 'readwrite', (s) => s.delete(id));
export const clearEntries = () => run(ENTRIES, 'readwrite', (s) => s.clear());

export const getMeta = <T>(key: string) => run<T | undefined>(META, 'readonly', (s) => s.get(key));
export const setMeta = (key: string, value: unknown) => run(META, 'readwrite', (s) => s.put(value, key));

export function newId(): string {
	return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function formatDate(ts: number): string {
	return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
