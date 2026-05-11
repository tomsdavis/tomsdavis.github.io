import * as opfs from '$lib/storage/opfs';
import type { FileNode } from '$lib/storage/opfs';

class FileSystemState {
	tree: FileNode = $state({ type: 'dir', name: '', path: '/', children: [] });
	selectedPath: string | null = $state(null);
	clipboard: { kind: 'copy'; path: string } | null = $state(null);

	async refresh(): Promise<void> {
		this.tree = await opfs.scanTree();
	}
}

export const fileSystemState = new FileSystemState();
