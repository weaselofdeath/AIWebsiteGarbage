# Rebuilding the compendium data

The site reads `compendium.json` and three icon atlases (`icons.webp`, `portraits.webp`, `foes.webp`).
All of them are generated from the game's `package.nw` (a zip) by `build.py`.

## Steps

1. Extract the game data into a working folder (not inside this repo):

   ```sh
   python -c "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); [z.extract(n, sys.argv[2]) for n in z.namelist() if (n.endswith('.json') and '/' not in n) or n.startswith('images/') or n.startswith('scripts/')]" "<game folder>/package.nw" work
   ```

2. Build (needs Pillow: `pip install pillow`):

   ```sh
   python -X utf8 build.py work ..
   ```

   This overwrites `../compendium.json` and the `.webp` atlases and prints entry counts.

3. Recompute the recommended builds (Node 18+, about 3 minutes on 16 cores):

   ```sh
   node precompute.js
   ```

   This runs the optimizer in `../calc.js` for every hero, tier and task and writes `../builds.json`.
   `precompute.js` expects `calc.js` and `compendium.json` in `../` (the site folder).

## Stat model

`../calc.js` implements the game's stat, damage and work-output formulas, the build scorer and the optimizer.
`MODEL.md` documents every formula with the game function it comes from.
It was checked against in-game hero panels: every panel stat matched exactly.

## Other scripts

- `decomp2.py work <path-filter>` prints event sheets as an indented tree of conditions, actions and sub-events, with names from the runtime's reference table. Example: `decomp2.py work 公式与数值` dumps all of the game's formulas.
- `fromsave.js <save.json> [row]` rebuilds heroes from a save file (`backup/ea1save.dat` is plain JSON) and prints computed panels, for checking the model against the game.
- `hosted.py` wraps the artifact version of the page into the standalone `index.html` hosted here.

- `decomp.py work` writes `work/decomp.txt`: every event-sheet expression from `data.json`, rendered as readable text (for example `wp.At(id, 16)`). It's how the table columns were decoded.
- `colusage.py work wp,js` lists which game functions read each column of the named tables.

Strings the game never localized are translated by hand in the `MANUAL` table at the top of `build.py`.
