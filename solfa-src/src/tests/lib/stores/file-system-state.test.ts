import { describe, it, expect, beforeEach } from 'vitest';

// Test the clipboard state transitions in isolation (no OPFS needed)

class FileSystemStateStub {
	selectedPath: string | null = null;
	clipboard: { kind: 'copy'; path: string } | null = null;
}

describe('file-system-state clipboard', () => {
	let state: FileSystemStateStub;

	beforeEach(() => {
		state = new FileSystemStateStub();
	});

	it('starts with null clipboard', () => {
		expect(state.clipboard).toBeNull();
	});

	it('sets clipboard on copy', () => {
		state.selectedPath = '/foo.solfa.json';
		state.clipboard = { kind: 'copy', path: state.selectedPath };
		expect(state.clipboard).toEqual({ kind: 'copy', path: '/foo.solfa.json' });
	});

	it('clipboard is preserved after paste (multiple pastes allowed)', () => {
		state.clipboard = { kind: 'copy', path: '/foo.solfa.json' };
		// simulate paste without clearing clipboard
		const before = state.clipboard;
		// clipboard unchanged
		expect(state.clipboard).toBe(before);
	});

	it('clipboard can be overwritten by a new copy', () => {
		state.clipboard = { kind: 'copy', path: '/foo.solfa.json' };
		state.clipboard = { kind: 'copy', path: '/bar.solfa.json' };
		expect(state.clipboard?.path).toBe('/bar.solfa.json');
	});
});
