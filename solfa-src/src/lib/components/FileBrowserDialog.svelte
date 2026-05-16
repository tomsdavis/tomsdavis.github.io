<script lang="ts">
	import ConfirmDialog from './ConfirmDialog.svelte';
	import { fileSystemState } from '$lib/stores/file-system-state.svelte';
	import * as opfs from '$lib/storage/opfs';
	import { basename, dirname, joinPath } from '$lib/storage/opfs';
	import { deserializeAppState } from '$lib/utils/serialization';
	import type { FileNode } from '$lib/storage/opfs';
	import type { SerializedAppState } from '$lib/types/serialization';

	interface Props {
		open: boolean;
		onClose: () => void;
		onLoad: (state: SerializedAppState, path: string) => void;
		onSaveAs: (path: string) => Promise<void>;
		onNew: () => void;
		isDirty?: boolean;
	}

	let { open, onClose, onLoad, onSaveAs, onNew, isDirty = false }: Props = $props();

	// Save-as input
	let saveAsName = $state('');
	let saveAsError = $state('');

	// Inline rename state
	let renamingPath = $state<string | null>(null);
	let renameValue = $state('');

	// New folder inline input
	let newFolderActive = $state(false);
	let newFolderName = $state('');

	// Error message at bottom of dialog
	let errorMsg = $state('');

	// Expanded folder paths
	let expandedPaths = $state(new Set<string>(['/']));

	// Button busy guard
	let busy = $state(false);

	// Confirm dialog state
	let confirmOpen = $state(false);
	let confirmTitle = $state('');
	let confirmMessage = $state('');
	let confirmLabel = $state('OK');
	let confirmDestructive = $state(false);
	let confirmAction = $state<(() => Promise<void>) | null>(null);

	// New composition confirm
	let newConfirmOpen = $state(false);

	// Import hidden file input
	let importInput = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (open) {
			fileSystemState.refresh();
			errorMsg = '';
			saveAsError = '';
		}
	});

	function handleKeydown(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'Escape' && !confirmOpen && !newConfirmOpen) onClose();
	}

	// Flatten tree to rows for rendering
	function flattenTree(node: FileNode, depth: number): Array<{ node: FileNode; depth: number }> {
		const rows: Array<{ node: FileNode; depth: number }> = [];
		for (const child of node.children ?? []) {
			rows.push({ node: child, depth });
			if (child.type === 'dir' && expandedPaths.has(child.path)) {
				rows.push(...flattenTree(child, depth + 1));
			}
		}
		return rows;
	}

	function displayName(node: FileNode): string {
		if (node.type === 'file' && node.name.endsWith('.solfa.json')) {
			return node.name.slice(0, -'.solfa.json'.length);
		}
		return node.name;
	}

	function toggleExpand(path: string) {
		const next = new Set(expandedPaths);
		if (next.has(path)) next.delete(path);
		else next.add(path);
		expandedPaths = next;
	}

	function selectRow(node: FileNode) {
		if (node.type === 'dir') {
			toggleExpand(node.path);
		}
		fileSystemState.selectedPath = node.path;
	}

	// Determine current folder for Save-As based on selection
	function currentFolder(): string {
		const sel = fileSystemState.selectedPath;
		if (!sel) return '/';
		// find the node
		const node = findNode(fileSystemState.tree, sel);
		if (!node) return '/';
		if (node.type === 'dir') return sel;
		return dirname(sel);
	}

	function findNode(root: FileNode, path: string): FileNode | null {
		if (root.path === path) return root;
		for (const child of root.children ?? []) {
			const found = findNode(child, path);
			if (found) return found;
		}
		return null;
	}

	function validateName(name: string): string | null {
		const trimmed = name.trim();
		if (!trimmed) return 'Name cannot be empty.';
		if (trimmed.includes('/')) return 'Name cannot contain "/".';
		if (trimmed === '.solfa.json') return 'Invalid name.';
		return null;
	}

	function showConfirm(title: string, message: string, label: string, destructive: boolean, action: () => Promise<void>) {
		confirmTitle = title;
		confirmMessage = message;
		confirmLabel = label;
		confirmDestructive = destructive;
		confirmAction = action;
		confirmOpen = true;
	}

	async function runConfirm() {
		confirmOpen = false;
		if (confirmAction) {
			busy = true;
			try { await confirmAction(); } catch (e) { errorMsg = String(e); } finally { busy = false; }
		}
	}

	// --- Actions ---

	async function handleSaveAs() {
		const err = validateName(saveAsName);
		if (err) { saveAsError = err; return; }
		saveAsError = '';
		const folder = currentFolder();
		const path = folder === '/' ? `/${saveAsName.trim()}.solfa.json` : `${folder}/${saveAsName.trim()}.solfa.json`;
		if (await opfs.exists(path)) {
			showConfirm(`Overwrite "${saveAsName.trim()}"?`, `A file named "${saveAsName.trim()}" already exists. Replace it?`, 'Overwrite', true, async () => {
				busy = true;
				try { await onSaveAs(path); await fileSystemState.refresh(); saveAsName = ''; } finally { busy = false; }
			});
			return;
		}
		busy = true;
		try { await onSaveAs(path); await fileSystemState.refresh(); saveAsName = ''; } catch (e) { saveAsError = String(e); } finally { busy = false; }
	}

	async function handleOpen() {
		const sel = fileSystemState.selectedPath;
		if (!sel) return;
		busy = true;
		errorMsg = '';
		try {
			const json = await opfs.readFile(sel);
			const state = deserializeAppState(json);
			onLoad(state, sel);
			onClose();
		} catch (e) {
			errorMsg = `Failed to open: ${e instanceof Error ? e.message : String(e)}`;
		} finally {
			busy = false;
		}
	}

	function startRename() {
		const sel = fileSystemState.selectedPath;
		if (!sel) return;
		renamingPath = sel;
		renameValue = displayName(findNode(fileSystemState.tree, sel)!);
	}

	async function commitRename(e?: Event) {
		e?.preventDefault();
		const src = renamingPath;
		if (!src) return;
		renamingPath = null;
		const trimmed = renameValue.trim();
		if (!trimmed) return;
		const err = validateName(trimmed);
		if (err) { errorMsg = err; return; }
		const node = findNode(fileSystemState.tree, src);
		if (!node) return;
		const folder = dirname(src);
		const newName = node.type === 'file' ? `${trimmed}.solfa.json` : trimmed;
		const destPath = folder === '/' ? `/${newName}` : `${folder}/${newName}`;
		if (await opfs.exists(destPath)) {
			showConfirm(`Overwrite "${trimmed}"?`, `"${trimmed}" already exists. Replace it?`, 'Overwrite', true, async () => {
				await opfs.deleteEntry(destPath, { recursive: true });
				await opfs.move(src, destPath);
				fileSystemState.selectedPath = destPath;
				await fileSystemState.refresh();
			});
			return;
		}
		busy = true;
		try {
			await opfs.move(src, destPath);
			fileSystemState.selectedPath = destPath;
			await fileSystemState.refresh();
		} catch (e) { errorMsg = String(e); } finally { busy = false; }
	}

	function handleRenameKey(e: KeyboardEvent) {
		if (e.key === 'Enter') commitRename();
		if (e.key === 'Escape') { renamingPath = null; }
	}

	async function handleDelete() {
		const sel = fileSystemState.selectedPath;
		if (!sel) return;
		const node = findNode(fileSystemState.tree, sel);
		if (!node) return;
		const name = displayName(node);
		const extra = node.type === 'dir' ? ' and all its contents' : '';
		showConfirm(`Delete "${name}"?`, `Delete "${name}"${extra}? This cannot be undone.`, 'Delete', true, async () => {
			await opfs.deleteEntry(sel, { recursive: true });
			fileSystemState.selectedPath = null;
			await fileSystemState.refresh();
		});
	}

	function handleCopy() {
		const sel = fileSystemState.selectedPath;
		if (!sel) return;
		fileSystemState.clipboard = { kind: 'copy', path: sel };
	}

	async function handlePaste() {
		const cb = fileSystemState.clipboard;
		if (!cb) return;
		const sel = fileSystemState.selectedPath;
		const destFolder = sel ? (findNode(fileSystemState.tree, sel)?.type === 'dir' ? sel : dirname(sel)) : '/';
		const srcBase = basename(cb.path);
		const destPath = destFolder === '/' ? `/${srcBase}` : `${destFolder}/${srcBase}`;
		if (await opfs.exists(destPath)) {
			showConfirm(`Overwrite "${displayName({ type: 'file', name: srcBase, path: destPath })}"?`, `"${srcBase}" already exists here. Replace it?`, 'Overwrite', true, async () => {
				await opfs.deleteEntry(destPath, { recursive: true });
				await opfs.copy(cb.path, destPath);
				await fileSystemState.refresh();
			});
			return;
		}
		busy = true;
		try { await opfs.copy(cb.path, destPath); await fileSystemState.refresh(); } catch (e) { errorMsg = String(e); } finally { busy = false; }
	}

	function startNewFolder() {
		newFolderActive = true;
		newFolderName = '';
	}

	async function commitNewFolder(e?: Event) {
		e?.preventDefault();
		newFolderActive = false;
		const trimmed = newFolderName.trim();
		if (!trimmed) return;
		const err = validateName(trimmed);
		if (err) { errorMsg = err; return; }
		const sel = fileSystemState.selectedPath;
		const folder = sel ? (findNode(fileSystemState.tree, sel)?.type === 'dir' ? sel : dirname(sel)) : '/';
		const path = folder === '/' ? `/${trimmed}` : `${folder}/${trimmed}`;
		busy = true;
		try { await opfs.ensureDir(path); await fileSystemState.refresh(); } catch (e) { errorMsg = String(e); } finally { busy = false; }
	}

	function handleNewFolderKey(e: KeyboardEvent) {
		if (e.key === 'Enter') commitNewFolder();
		if (e.key === 'Escape') { newFolderActive = false; }
	}

	function handleNew() {
		if (isDirty) {
			newConfirmOpen = true;
		} else {
			onNew();
			onClose();
		}
	}

	function confirmNew() {
		newConfirmOpen = false;
		onNew();
		onClose();
	}

	function handleImport() {
		importInput?.click();
	}

	async function handleImportFile(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		input.value = '';
		errorMsg = '';
		try {
			const text = await file.text();
			const state = deserializeAppState(text);
			// Pre-fill save-as with the file stem
			const stem = file.name.replace(/\.solfa\.json$/, '').replace(/\.json$/, '');
			saveAsName = stem;
			// Store the raw json for saving
			pendingImportJson = text;
			pendingImportState = state;
		} catch (e) {
			errorMsg = `Import failed: ${e instanceof Error ? e.message : String(e)}`;
		}
	}

	let pendingImportJson = $state('');
	let pendingImportState = $state<SerializedAppState | null>(null);

	async function handleSaveAsWithImport() {
		if (!pendingImportJson) { await handleSaveAs(); return; }
		const err = validateName(saveAsName);
		if (err) { saveAsError = err; return; }
		saveAsError = '';
		const folder = currentFolder();
		const path = folder === '/' ? `/${saveAsName.trim()}.solfa.json` : `${folder}/${saveAsName.trim()}.solfa.json`;
		const doSave = async () => {
			await opfs.writeFile(path, pendingImportJson);
			pendingImportJson = '';
			pendingImportState = null;
			saveAsName = '';
			await fileSystemState.refresh();
		};
		if (await opfs.exists(path)) {
			showConfirm(`Overwrite "${saveAsName.trim()}"?`, `"${saveAsName.trim()}" already exists. Replace it?`, 'Overwrite', true, doSave);
			return;
		}
		busy = true;
		try { await doSave(); } catch (e) { saveAsError = String(e); } finally { busy = false; }
	}

	async function handleExport() {
		const sel = fileSystemState.selectedPath;
		if (!sel) return;
		busy = true;
		errorMsg = '';
		try {
			const json = await opfs.readFile(sel);
			const name = basename(sel);
			const blob = new Blob([json], { type: 'application/json' });
			const file = new File([blob], name, { type: 'application/json' });

			// Mobile prefers Web Share; desktop prefers FSA (avoids OS share sheet).
			// iOS Safari: Web Share requires a user gesture and AbortError is normal if the user dismisses.
			const isMobile = ('userAgentData' in navigator && (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile) ||
				/Mobi|Android|iPhone/.test(navigator.userAgent);

			if (isMobile && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
				await navigator.share({ files: [file] });
			} else if ('showSaveFilePicker' in window) {
				const handle = await (window as Window & { showSaveFilePicker: (opts: object) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
					suggestedName: name,
					types: [{ description: 'Solfa JSON', accept: { 'application/json': ['.json', '.solfa.json'] } }]
				});
				const writable = await handle.createWritable();
				await writable.write(blob);
				await writable.close();
			} else if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
				await navigator.share({ files: [file] });
			} else {
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = name;
				a.click();
				URL.revokeObjectURL(url);
			}
		} catch (e) {
			if (e instanceof Error && e.name !== 'AbortError') {
				errorMsg = `Export failed: ${e.message}`;
			}
		} finally {
			busy = false;
		}
	}

	const selectedNode = $derived(
		fileSystemState.selectedPath ? findNode(fileSystemState.tree, fileSystemState.selectedPath) : null
	);
	const canOpen = $derived(selectedNode?.type === 'file');
	const canRename = $derived(selectedNode !== null);
	const canDelete = $derived(selectedNode !== null);
	const canCopy = $derived(selectedNode !== null);
	const canPaste = $derived(fileSystemState.clipboard !== null);
	const canExport = $derived(selectedNode?.type === 'file');
	const clipboardName = $derived(fileSystemState.clipboard ? displayName({ type: 'file', name: basename(fileSystemState.clipboard.path), path: fileSystemState.clipboard.path }) : '');
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Hidden import input -->
<input
	type="file"
	accept=".solfa.json,application/json"
	style="display:none"
	bind:this={importInput}
	onchange={handleImportFile}
/>

{#if open}
	<div class="overlay" onclick={onClose} role="presentation">
		<div class="dialog" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="File browser">

			<div class="dialog-header">
				<h2>Files</h2>
				<button class="close-x" onclick={onClose} aria-label="Close">✕</button>
			</div>

			<!-- Save As row -->
			<div class="save-as-row">
				{#if pendingImportJson}
					<span class="import-label">Import as:</span>
				{/if}
				<input
					type="text"
					class="name-input"
					placeholder="Name..."
					bind:value={saveAsName}
					onkeydown={(e) => e.key === 'Enter' && (pendingImportJson ? handleSaveAsWithImport() : handleSaveAs())}
				/>
				<button
					class="save-as-btn"
					onclick={pendingImportJson ? handleSaveAsWithImport : handleSaveAs}
					disabled={!saveAsName.trim() || busy}
				>Save</button>
			</div>
			{#if saveAsError}
				<p class="inline-error">{saveAsError}</p>
			{/if}

			{#if fileSystemState.clipboard}
				<div class="clipboard-hint">📋 "{clipboardName}" copied — Paste to duplicate</div>
			{/if}

			<!-- File tree -->
			<div class="tree-scroll">
				{#if (fileSystemState.tree.children ?? []).length === 0}
					<p class="empty">No files yet. Save something!</p>
				{:else}
					{#each flattenTree(fileSystemState.tree, 0) as { node, depth }}
						<div
							class="tree-row"
							class:selected={fileSystemState.selectedPath === node.path}
							style="padding-left: {8 + depth * 16}px"
							onclick={() => selectRow(node)}
							role="option"
							aria-selected={fileSystemState.selectedPath === node.path}
						>
							{#if node.type === 'dir'}
								<span class="icon">{expandedPaths.has(node.path) ? '📂' : '📁'}</span>
							{:else}
								<span class="icon">🎵</span>
							{/if}
							{#if renamingPath === node.path}
								<form onsubmit={commitRename} style="flex:1;display:flex">
									<input
										class="rename-input"
										type="text"
										bind:value={renameValue}
										onkeydown={handleRenameKey}
										onblur={commitRename}
										autofocus
									/>
								</form>
							{:else}
								<span class="row-name">{displayName(node)}</span>
							{/if}
						</div>
					{/each}
				{/if}

				{#if newFolderActive}
					<form class="new-folder-form" onsubmit={commitNewFolder}>
						<span class="icon">📁</span>
						<input
							class="rename-input"
							type="text"
							placeholder="Folder name..."
							bind:value={newFolderName}
							onkeydown={handleNewFolderKey}
							onblur={commitNewFolder}
							autofocus
						/>
					</form>
				{/if}
			</div>

			<!-- Action bar -->
			<div class="action-bar">
				<button onclick={handleOpen} disabled={!canOpen || busy} aria-label="Open selected file">
					Open
				</button>
				<button onclick={startRename} disabled={!canRename || busy} aria-label="Rename selected">
					Rename
				</button>
				<button class="destructive-btn" onclick={handleDelete} disabled={!canDelete || busy} aria-label="Delete selected">
					Delete
				</button>
				<button onclick={handleCopy} disabled={!canCopy || busy} aria-label="Copy selected">
					Copy
				</button>
				<button onclick={handlePaste} disabled={!canPaste || busy} aria-label="Paste clipboard">
					Paste
				</button>
				<button onclick={startNewFolder} disabled={busy} aria-label="New folder">
					New Folder
				</button>
			</div>

			<!-- Bottom bar -->
			<div class="bottom-bar">
				<button onclick={handleNew} disabled={busy}>New</button>
				<button onclick={handleImport} disabled={busy}>Import</button>
				<button onclick={handleExport} disabled={!canExport || busy}>Export</button>
			</div>

			{#if errorMsg}
				<p class="bottom-error">{errorMsg}</p>
			{/if}
		</div>
	</div>
{/if}

<!-- Confirm dialog for overwrite / rename / delete / paste -->
<ConfirmDialog
	open={confirmOpen}
	title={confirmTitle}
	message={confirmMessage}
	confirmLabel={confirmLabel}
	destructive={confirmDestructive}
	onConfirm={runConfirm}
	onCancel={() => (confirmOpen = false)}
/>

<!-- New composition confirm -->
<ConfirmDialog
	open={newConfirmOpen}
	title="New composition?"
	message="Start a new composition? Unsaved changes will be lost."
	confirmLabel="New"
	destructive={false}
	onConfirm={confirmNew}
	onCancel={() => (newConfirmOpen = false)}
/>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 900;
	}

	.dialog {
		background: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 0;
		width: min(480px, calc(100vw - 16px));
		max-height: 85vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.dialog-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 16px 12px;
		border-bottom: 1px solid var(--border);
	}

	h2 {
		margin: 0;
		font-size: 18px;
	}

	.close-x {
		background: none;
		border: none;
		color: var(--text-muted);
		font-size: 16px;
		cursor: pointer;
		padding: 4px 8px;
		border-radius: 4px;
	}

	.close-x:hover {
		background: var(--bg-cell);
		color: var(--text);
	}

	.save-as-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 16px 0;
	}

	.import-label {
		font-size: 12px;
		color: var(--text-muted);
		white-space: nowrap;
	}

	.name-input {
		flex: 1;
		padding: 7px 10px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg);
		color: var(--text);
		font-size: 14px;
		min-width: 0;
	}

	.save-as-btn {
		padding: 7px 14px;
		border: 1px solid var(--accent);
		border-radius: 6px;
		background: var(--accent);
		color: white;
		font-size: 13px;
		cursor: pointer;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.save-as-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.inline-error {
		margin: 4px 16px 0;
		font-size: 12px;
		color: #e74c3c;
	}

	.clipboard-hint {
		margin: 8px 16px 0;
		padding: 6px 10px;
		background: var(--bg-cell);
		border-radius: 6px;
		font-size: 12px;
		color: var(--text-muted);
	}

	.tree-scroll {
		flex: 1;
		overflow-y: auto;
		padding: 10px 0;
		min-height: 80px;
	}

	.tree-row {
		display: flex;
		align-items: center;
		gap: 6px;
		padding-top: 5px;
		padding-bottom: 5px;
		padding-right: 12px;
		cursor: pointer;
		border-radius: 4px;
		margin: 0 8px;
		font-size: 14px;
	}

	.tree-row:hover {
		background: var(--bg-cell);
	}

	.tree-row.selected {
		background: var(--bg-cell);
		outline: 1px solid var(--accent);
	}

	.icon {
		font-size: 14px;
		flex-shrink: 0;
		width: 20px;
		text-align: center;
	}

	.row-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.rename-input {
		flex: 1;
		padding: 2px 6px;
		border: 1px solid var(--accent);
		border-radius: 4px;
		background: var(--bg);
		color: var(--text);
		font-size: 14px;
		min-width: 0;
	}

	.new-folder-form {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 5px 8px 5px 24px;
		margin: 0 8px;
	}

	.empty {
		color: var(--text-muted);
		font-size: 13px;
		padding: 12px 16px;
		margin: 0;
	}

	.action-bar {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 10px 16px;
		border-top: 1px solid var(--border);
	}

	.bottom-bar {
		display: flex;
		gap: 6px;
		padding: 8px 16px 12px;
		border-top: 1px solid var(--border);
	}

	button {
		padding: 6px 12px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg-surface);
		color: var(--text);
		cursor: pointer;
		font-size: 13px;
	}

	button:hover:not(:disabled) {
		background: var(--bg-cell);
	}

	button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.destructive-btn {
		color: #e74c3c;
		border-color: #e74c3c;
	}

	.destructive-btn:hover:not(:disabled) {
		background: rgba(231, 76, 60, 0.1);
	}

	.bottom-error {
		margin: 0;
		padding: 6px 16px 10px;
		font-size: 12px;
		color: #e74c3c;
	}
</style>
