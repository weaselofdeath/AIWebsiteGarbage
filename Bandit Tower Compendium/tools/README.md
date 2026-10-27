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

## Other scripts

- `decomp.py work` writes `work/decomp.txt`: every event-sheet expression from `data.json`, rendered as readable text (for example `wp.At(id, 16)`). It's how the table columns were decoded.
- `colusage.py work wp,js` lists which game functions read each column of the named tables.

Strings the game never localized are translated by hand in the `MANUAL` table at the top of `build.py`.
