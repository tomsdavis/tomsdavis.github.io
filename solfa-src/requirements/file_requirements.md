We will be working on improving the current file handling capability of the solfa app.

This should be state-managed component (using Svelte) which will recursively scan the OPFS root creating a tree of folders; render a navigable file list; and support rename/delete/copy/paste within the tree, 
 alongside the save/load. Once a file is saved as, the app sholud indicate whether the current state is saved or not (e.g. the save icon becomes live when there is something to do); this may mean splitting out the save icon from save-as.

It should also allow export/import using a File System Access API if available (desktop) or a webshare API (mobile)

Always use 'are you sure' dialogs for any destructive deletion/over-write.

At the same time:
- add an 'are you sure' dialog on the all-clear of the grid triggered by the trashcan icon
- strip out the code for versioned migration of older files saved - in practice there are non (the app is still in development) so we can start clean with the current fileformat

I would prefer much of the build to be done by Sonnet where possible rather than Opus; please indicate any areas where this would not be a practical choice.

