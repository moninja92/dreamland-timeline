# Dreamland Timeline

A searchable, filterable timeline of the Dreamland world (1840 to 2000) that reads straight from the Google Sheet. Edit the sheet, refresh the page, and everyone sees the change.

## Run it locally

Needs Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the address it prints (usually http://localhost:5173).

## Where the data comes from

Set in `src/config.ts`:

- `sheetCsvUrl` points at the `timelineread` tab. The default link works while the sheet is shared by link. For something sturdier, use File > Share > Publish to web, choose `timelineread` and CSV, and paste that link instead.
- If the sheet can't be reached, the app shows `public/timeline-snapshot.csv` and says so in the footer. Refresh that file now and then by downloading the tab as CSV.
- Anything in the sheet is readable by anyone with the link, including rows marked spoiler or gm. Keep truly secret notes in a separate sheet.

## Sheet columns

The first five columns already exist. The rest are optional; add them to the right of `date_end` in any order. Column names are not case sensitive.

| Column | What to put in it |
|---|---|
| `rank` | Number used to break ties when two entries share a start date. |
| `title` | Name of the event or character. Required. |
| `category` | Character, War, Corporate, Governance, Social, Alien Event, International, Technological, Game, or anything new. |
| `date_begin` | `M/D/YYYY`, like `6/4/1947`. Required. Day must be 1 to 28. |
| `date_end` | `M/D/YYYY`. Leave blank for a single-day event. Write `ongoing` for a character still alive or something still running at the end of the timeline. |
| `id` | Short unique name used in links, like `roswell-crash`. Leave blank to build it from the title. |
| `branch` | Which timeline this belongs to. Blank means `main`. Use a name like `cascade-alt` for a parallel timeline. |
| `forks_from` | For branch entries: the id or title of the event where the branch splits off. |
| `description` | Free text. Write `[[Kazrik Lancer]]` or `[[Kazrik Lancer|Kazrik]]` to link to another entry. |
| `related` | Other entries, separated by semicolons, like `Roswell Crash; MAD Wars`. Titles or ids both work. |
| `bible` | Name of the matching Obsidian note, like `Kazrik Lancer`. Shows "Open in Obsidian", plus "Read in the bible" if `bibleBaseUrl` is set. |
| `visibility` | `public` (default), `spoiler` or `gm`. Spoiler and gm rows stay hidden until a reader ticks "Show spoilers". |

Rows with problems (bad dates, duplicate ids, links that point nowhere) are listed in the footer under "rows need attention", with the spreadsheet row number.

## How the calendar works

Twelve months of 28 days, 7-day weeks, 336-day years. Since 28 is exactly four weeks, every month starts on Sunday, so the weekday depends only on the day of the month. All date math lives in `src/calendar.ts`.

## Personnel page (character creator)

`character.html` is a second page, linked from the Timeline/Personnel tabs at the top of both pages. Players build a character step by step (Identity, Stats, Skills, Educations, Review) and export it:

- **CSV for the sheet** and **Copy row**: one row in the exact column order of the `save` tab. Paste it under the last character in `save`. Only unlocked once the character passes every rule.
- **Image** and **PDF**: the personnel file as shown on the page.
- **Save file**: a .json the player can load back in with "Load save file" to keep editing.

**Random name** rolls a first name and surname from Nat's lists in the `calc` tab (Any, Male or Female first names). **Randomize** builds a whole valid character and also rolls a name if the name field is empty.

The page reads the `db.kind`, `db.bio`, `db.emp`, `db.education` and `calc` tabs live, so new Kindreds, Bios, Careers and Educations added there appear automatically. Bundled copies in `public/data/` are used if the sheet can't be reached. Stat math and point budgets live in `src/character/rules.ts`; if the sheet's formulas change, that file changes too. Full rules: `CharacterGeneration.md`.

Each player's work in progress is kept in their own browser until they start a new file.

## Project layout

```
src/config.ts     settings: sheet URL, Obsidian vault, bible URL, category colors
src/calendar.ts   Dreamland date parsing, weekdays, durations
src/data.ts       loads the CSV, checks rows, builds the event list
src/main.ts       search, filters, list, detail panel
src/style.css     look and feel, light and dark themes
src/character/    Personnel page: rules.ts (math), data.ts (sheet tabs), main.ts (form and sheet), export.ts, character.css
character.html    Personnel page
public/data/      offline copies of db.kind, db.bio, db.emp, db.education, calc (names)
public/timeline-snapshot.csv   offline fallback copy of the sheet
public/favicon.svg             browser tab icon (Scope D on Vault Black)
public/brand/                  Scope D emblem: scope-d.svg (inherits text color), manila, carbon and stamp-red versions
```
