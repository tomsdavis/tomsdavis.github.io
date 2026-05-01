import type { PaletteMode, PitchSystem } from '$lib/types/palette.js';

/**
 * Determines whether switching from one palette configuration to another
 * is destructive (requires grid clear + user confirmation).
 *
 * Safe transitions (no prompt): chromatic <-> diatonic within the same pitch system
 * Destructive transitions (prompt + clear): system change, any <-> microtonal
 */
export function isDestructiveTransition(
	currentSystem: PitchSystem,
	currentMode: PaletteMode,
	newSystem: PitchSystem,
	newMode: PaletteMode
): boolean {
	// No change
	if (currentSystem === newSystem && currentMode === newMode) return false;

	// System change is always destructive
	if (currentSystem !== newSystem) return true;

	// Within the same system: microtonal involvement is destructive
	if (currentMode === 'microtonal' || newMode === 'microtonal') return true;

	// chromatic <-> diatonic within same system is safe
	return false;
}
