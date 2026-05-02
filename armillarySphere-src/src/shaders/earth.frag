// Spec §4.1: Earth fragment shader. Blends day and night textures by the dot
// product of the surface normal with the Sun direction, with a soft transition
// of ~6° around the terminator. Terminator can be disabled (day-side only).
