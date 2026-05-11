import { describe, it, expect } from 'vitest';
import { parsePath, joinPath, dirname, basename, OpfsError } from '$lib/storage/opfs';

describe('parsePath', () => {
	it('parses a deep path', () => {
		expect(parsePath('/a/b/c.json')).toEqual(['a', 'b', 'c.json']);
	});

	it('parses a single-segment path', () => {
		expect(parsePath('/foo.solfa.json')).toEqual(['foo.solfa.json']);
	});

	it('parses root as empty array', () => {
		expect(parsePath('/')).toEqual([]);
	});

	it('throws on empty string', () => {
		expect(() => parsePath('')).toThrow(OpfsError);
		expect(() => parsePath('')).toThrow('must start with "/"');
	});

	it('throws on path without leading slash', () => {
		expect(() => parsePath('a/b')).toThrow(OpfsError);
		expect(() => parsePath('a/b')).toThrow('must start with "/"');
	});

	it('throws on double slash', () => {
		expect(() => parsePath('/a//b')).toThrow(OpfsError);
		expect(() => parsePath('/a//b')).toThrow('empty segment');
	});

	it('throws on trailing slash', () => {
		expect(() => parsePath('/a/b/')).toThrow(OpfsError);
		expect(() => parsePath('/a/b/')).toThrow('empty segment');
	});

	it('error code is INVALID_PATH', () => {
		try {
			parsePath('no-slash');
		} catch (e) {
			expect(e).toBeInstanceOf(OpfsError);
			expect((e as OpfsError).code).toBe('INVALID_PATH');
		}
	});
});

describe('joinPath', () => {
	it('joins two segments', () => {
		expect(joinPath('a', 'b.json')).toBe('/a/b.json');
	});

	it('joins multiple segments', () => {
		expect(joinPath('a', 'b', 'c.json')).toBe('/a/b/c.json');
	});

	it('returns root for empty args', () => {
		expect(joinPath()).toBe('/');
	});

	it('joins single segment', () => {
		expect(joinPath('foo.solfa.json')).toBe('/foo.solfa.json');
	});
});

describe('dirname', () => {
	it('returns parent of a deep path', () => {
		expect(dirname('/a/b/c.json')).toBe('/a/b');
	});

	it('returns root for single-segment path', () => {
		expect(dirname('/a')).toBe('/');
	});

	it('returns root for root input', () => {
		expect(dirname('/')).toBe('/');
	});

	it('handles two-segment path', () => {
		expect(dirname('/a/b')).toBe('/a');
	});
});

describe('basename', () => {
	it('returns last segment of a deep path', () => {
		expect(basename('/a/b/c.json')).toBe('c.json');
	});

	it('returns the only segment for single-segment path', () => {
		expect(basename('/foo.solfa.json')).toBe('foo.solfa.json');
	});

	it('returns empty string for root', () => {
		expect(basename('/')).toBe('');
	});
});
