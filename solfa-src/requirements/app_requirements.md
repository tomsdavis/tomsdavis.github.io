# music maker game spec

## Summary

I want to create an app which can be used in multiple environments -  iOS, iPadOS, Android, Web


The app is going to be a game which allows you to create music by dragging notes from a palette area, to a grid which contains the notes/pitches.

The user can drag notes to positions in the grid, and then later play them back by touching/clicking them. i.e. the grid inherently contains pitch information, and it is up to the user to provide the rhythm as they play.

There is a notional ordering within the grid, from (row 1 column 1) to (row 1 column N) to (row 2 column 1) etc.


## Pallets

The notes themselves are drawn from a pallet of possible notes shown at the screen edges, and this pallet can be edited. A simple version would be having seven distinct notes one for each note of the major scale, and as well as selecting and writing these notes a user could also specify they be taken up or down an octave. 

Another variant would be to offer all twelve standard chromatic pitches (again, able to be taken up or down an octave).

For more complex, microtonal use, there could be a larger number of items in the palette with note values specified either in terms of cents against a reference note frequency (where each cent is 1/1200 of an octave logarithmically), or alternatively in mille where each mille is 1/1000 of an octave logarithmically. 


## composition mode

The on-screen grid contains possible positions for a note.

Notes can be dragged from the palette to an empty grid position. (This creates a temporary copy of the note until it is released - the palette itself is unaffected).

If the user starts dragging a note but releases it outside the grid area, the current operation is ended.

If the user drags a note on top of an existing note in the grid it replaces it.

If the note is dragged to a position between two grid squares (one left, one right; or at the end of a row) it inserts the note; existing grid contents then are pushed back across the grid left or right with the rightmost note of any row  becoming the first note of the subsequent row (which then also pushes notes right until a space is found)

## playback mode

In play mode, notes can be played by touching them or clicking the mouse. In multi touch environments several notes can be played at the same time.


## other fetaures

The app will allow both pallets and grids to be saved and loaded; the file formats used should be text-based to allow for easier sending/manual editing if desired.