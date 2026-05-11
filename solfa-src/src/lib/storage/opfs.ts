export type OpfsErrorCode =
	| 'NOT_FOUND'
	| 'ALREADY_EXISTS'
	| 'TYPE_MISMATCH'
	| 'LOCKED'
	| 'QUOTA'
	| 'INVALID_PATH'
	| 'UNAVAILABLE'
	| 'UNKNOWN';

export class OpfsError extends Error {
	constructor(
		public readonly code: OpfsErrorCode,
		message: string,
		public readonly cause?: unknown
	) {
		super(message);
		this.name = 'OpfsError';
	}
}

export interface FileNode {
	type: 'file' | 'dir';
	name: string;
	path: string;
	children?: FileNode[];
}

function mapDomException(e: unknown): OpfsError {
	if (e instanceof OpfsError) return e;
	if (e instanceof DOMException) {
		switch (e.name) {
			case 'NotFoundError':
				return new OpfsError('NOT_FOUND', e.message, e);
			case 'TypeMismatchError':
				return new OpfsError('TYPE_MISMATCH', e.message, e);
			case 'NoModificationAllowedError':
				return new OpfsError('LOCKED', e.message, e);
			case 'QuotaExceededError':
				return new OpfsError('QUOTA', e.message, e);
			case 'InvalidStateError':
				return new OpfsError('LOCKED', e.message, e);
			default:
				return new OpfsError('UNKNOWN', e.message, e);
		}
	}
	if (e instanceof Error) return new OpfsError('UNKNOWN', e.message, e);
	return new OpfsError('UNKNOWN', String(e), e);
}

// --- Pure path helpers ---

export function parsePath(path: string): string[] {
	if (!path.startsWith('/')) {
		throw new OpfsError('INVALID_PATH', `Path must start with "/": ${path}`);
	}
	if (path === '/') return [];
	const segments = path.slice(1).split('/');
	for (const seg of segments) {
		if (seg === '') {
			throw new OpfsError('INVALID_PATH', `Path contains empty segment: ${path}`);
		}
	}
	return segments;
}

export function joinPath(...segments: string[]): string {
	if (segments.length === 0) return '/';
	return '/' + segments.join('/');
}

export function dirname(path: string): string {
	const segs = parsePath(path);
	if (segs.length <= 1) return '/';
	return '/' + segs.slice(0, -1).join('/');
}

export function basename(path: string): string {
	const segs = parsePath(path);
	if (segs.length === 0) return '';
	return segs[segs.length - 1];
}

// --- Internal helpers ---

async function getRoot(): Promise<FileSystemDirectoryHandle> {
	if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) {
		throw new OpfsError('UNAVAILABLE', 'OPFS is not supported in this environment');
	}
	return navigator.storage.getDirectory();
}

async function navigateTo(
	root: FileSystemDirectoryHandle,
	segs: string[],
	createDirs = false
): Promise<FileSystemDirectoryHandle> {
	let current = root;
	for (const seg of segs) {
		current = await current.getDirectoryHandle(seg, { create: createDirs });
	}
	return current;
}

async function buildTree(
	name: string,
	path: string,
	dir: FileSystemDirectoryHandle
): Promise<FileNode> {
	const children: FileNode[] = [];
	for await (const [entryName, handle] of dir as unknown as AsyncIterable<
		[string, FileSystemHandle]
	>) {
		const childPath = path === '/' ? `/${entryName}` : `${path}/${entryName}`;
		if (handle.kind === 'directory') {
			children.push(
				await buildTree(entryName, childPath, handle as FileSystemDirectoryHandle)
			);
		} else {
			children.push({ type: 'file', name: entryName, path: childPath });
		}
	}
	children.sort((a, b) => {
		if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
		return a.name.localeCompare(b.name);
	});
	return { type: 'dir', name, path, children };
}

// --- API ---

export async function scanTree(): Promise<FileNode> {
	const root = await getRoot();
	return buildTree('', '/', root);
}

export async function readFile(path: string): Promise<string> {
	const segs = parsePath(path);
	if (segs.length === 0) throw new OpfsError('TYPE_MISMATCH', 'Cannot read root as file');
	try {
		const root = await getRoot();
		const parent = await navigateTo(root, segs.slice(0, -1));
		const fileHandle = await parent.getFileHandle(segs[segs.length - 1]);
		const file = await fileHandle.getFile();
		return new TextDecoder().decode(await file.arrayBuffer());
	} catch (e) {
		throw mapDomException(e);
	}
}

export async function writeFile(path: string, contents: string): Promise<void> {
	const segs = parsePath(path);
	if (segs.length === 0) throw new OpfsError('TYPE_MISMATCH', 'Cannot write to root path');
	try {
		const root = await getRoot();
		const parent = await navigateTo(root, segs.slice(0, -1), true);
		const fileHandle = await parent.getFileHandle(segs[segs.length - 1], { create: true });
		const writable = await fileHandle.createWritable();
		await writable.write(new TextEncoder().encode(contents));
		await writable.close();
	} catch (e) {
		throw mapDomException(e);
	}
}

export async function deleteEntry(path: string, opts?: { recursive?: boolean }): Promise<void> {
	if (path === '/') throw new OpfsError('INVALID_PATH', 'Cannot delete root');
	const segs = parsePath(path);
	try {
		const root = await getRoot();
		const parent = await navigateTo(root, segs.slice(0, -1));
		await parent.removeEntry(segs[segs.length - 1], { recursive: opts?.recursive ?? false });
	} catch (e) {
		throw mapDomException(e);
	}
}

export async function move(srcPath: string, destPath: string): Promise<void> {
	const srcSegs = parsePath(srcPath);
	const destSegs = parsePath(destPath);

	if (await exists(destPath)) {
		throw new OpfsError('ALREADY_EXISTS', `Destination already exists: ${destPath}`);
	}

	try {
		const root = await getRoot();
		const srcParent = await navigateTo(root, srcSegs.slice(0, -1));
		const srcName = srcSegs[srcSegs.length - 1];
		const destParent = await navigateTo(root, destSegs.slice(0, -1), true);
		const destName = destSegs[destSegs.length - 1];

		// Try as file
		let fileHandle: FileSystemFileHandle | null = null;
		try {
			fileHandle = await srcParent.getFileHandle(srcName);
		} catch (e) {
			if (!(e instanceof DOMException && e.name === 'TypeMismatchError')) {
				throw e;
			}
		}

		if (fileHandle) {
			// Prefer native FileSystemFileHandle.move() when available (Chrome 121+)
			const movable = fileHandle as FileSystemFileHandle & {
				move?: (dir: FileSystemDirectoryHandle, name: string) => Promise<void>;
			};
			if (typeof movable.move === 'function') {
				await movable.move(destParent, destName);
				return;
			}
			// Non-atomic fallback: read source, write to dest, delete source
			const file = await fileHandle.getFile();
			const contents = new TextDecoder().decode(await file.arrayBuffer());
			const destFile = await destParent.getFileHandle(destName, { create: true });
			const writable = await destFile.createWritable();
			await writable.write(new TextEncoder().encode(contents));
			await writable.close();
			await srcParent.removeEntry(srcName);
			return;
		}

		// Directory move: recursive copy + delete (not atomic)
		await copy(srcPath, destPath);
		await deleteEntry(srcPath, { recursive: true });
	} catch (e) {
		throw mapDomException(e);
	}
}

export async function copy(srcPath: string, destPath: string): Promise<void> {
	const srcSegs = parsePath(srcPath);

	if (await exists(destPath)) {
		throw new OpfsError('ALREADY_EXISTS', `Destination already exists: ${destPath}`);
	}

	try {
		const root = await getRoot();
		const srcParent = await navigateTo(root, srcSegs.slice(0, -1));
		const srcName = srcSegs[srcSegs.length - 1];

		// Try as file
		let fileHandle: FileSystemFileHandle | null = null;
		try {
			fileHandle = await srcParent.getFileHandle(srcName);
		} catch (e) {
			if (!(e instanceof DOMException && e.name === 'TypeMismatchError')) {
				throw e;
			}
		}

		if (fileHandle) {
			const file = await fileHandle.getFile();
			const contents = new TextDecoder().decode(await file.arrayBuffer());
			await writeFile(destPath, contents);
			return;
		}

		// Directory copy: recursive walk
		const dirHandle = await srcParent.getDirectoryHandle(srcName);
		await copyDir(dirHandle, srcPath, destPath);
	} catch (e) {
		throw mapDomException(e);
	}
}

async function copyDir(
	srcDir: FileSystemDirectoryHandle,
	srcPath: string,
	destPath: string
): Promise<void> {
	await ensureDir(destPath);
	for await (const [name, handle] of srcDir as unknown as AsyncIterable<
		[string, FileSystemHandle]
	>) {
		const childSrc = srcPath === '/' ? `/${name}` : `${srcPath}/${name}`;
		const childDest = destPath === '/' ? `/${name}` : `${destPath}/${name}`;
		if (handle.kind === 'directory') {
			await copyDir(handle as FileSystemDirectoryHandle, childSrc, childDest);
		} else {
			const fh = handle as FileSystemFileHandle;
			const file = await fh.getFile();
			const contents = new TextDecoder().decode(await file.arrayBuffer());
			await writeFile(childDest, contents);
		}
	}
}

export async function ensureDir(path: string): Promise<void> {
	const segs = parsePath(path);
	try {
		const root = await getRoot();
		await navigateTo(root, segs, true);
	} catch (e) {
		throw mapDomException(e);
	}
}

export async function exists(path: string): Promise<boolean> {
	try {
		const segs = parsePath(path);
		if (segs.length === 0) return true;
		const root = await getRoot();
		const parent = await navigateTo(root, segs.slice(0, -1));
		const name = segs[segs.length - 1];
		try {
			await parent.getFileHandle(name);
			return true;
		} catch {}
		try {
			await parent.getDirectoryHandle(name);
			return true;
		} catch {}
		return false;
	} catch (e) {
		if (e instanceof OpfsError && e.code === 'UNAVAILABLE') throw e;
		return false;
	}
}
