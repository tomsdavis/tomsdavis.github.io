import * as opfs from '$lib/storage/opfs';
import type { FileNode } from '$lib/storage/opfs';

class FileSystemState {
	tree: FileNode = $state({ type: 'dir', name: '', path: '/', children: [] });
	selectedPath: string | null = $state(null);
	clipboard: { kind: 'copy'; path: string } | null = $state(null);
	currentPath: string | null = $state(null);
	lastSavedJson: string = $state('');

	async refresh(): Promise<void> {
		this.tree = await opfs.scanTree();
	}

	markSaved(json: string, path: string | null): void {
		this.lastSavedJson = json;
		this.currentPath = path;
	}

	clearCurrent(): void {
		this.currentPath = null;
		this.lastSavedJson = '';
	}
}

export const fileSystemState = new FileSystemState();
