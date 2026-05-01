/** 12 distinct colours for the chromatic scale, C through B */
export const NOTE_COLORS: readonly string[] = [
	'#e74c3c', // C  - red
	'#e67e22', // C# - orange
	'#f1c40f', // D  - yellow
	'#2ecc71', // D# - green
	'#1abc9c', // E  - teal
	'#3498db', // F  - blue
	'#2980b9', // F# - dark blue
	'#9b59b6', // G  - purple
	'#8e44ad', // G# - dark purple
	'#e84393', // A  - pink
	'#fd79a8', // A# - light pink
	'#fdcb6e', // B  - gold
] as const;

/** Get the colour for a semitone index (0-11, wraps) */
export function noteColor(semitone: number): string {
	return NOTE_COLORS[((semitone % 12) + 12) % 12];
}
