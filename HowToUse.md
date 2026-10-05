# Dreamland Timeline: Sheet Guide

The Dreamland Timeline site reads straight from the **timelineread** tab of the Dreamland Brain sheet. Anything you change there shows up on the site the next time someone refreshes the page. No code, no uploads, no waiting on Maurice.

Site: https://moninja92.github.io/dreamland-timeline/

## The basics

- One row is one timeline entry: an event, a character's life, a war, a company, anything with a date.
- Row 1 holds the column headers. Keep the header names exactly as written below (capitals don't matter).
- Column order doesn't matter, and empty cells are fine.
- Don't rename the **timelineread** tab, or the site loses track of it.
- Don't merge cells or put notes in spare cells around the table. Use the `description` column instead.

## Columns you already have

| Header | What goes in it | Example |
|---|---|---|
| `rank` | A number. Only used to decide order when two entries start on the same day. | `41` |
| `title` | Name of the entry. Required. | `Roswell Crash` |
| `category` | The type of entry. Controls its color on the site. | `Alien Event` |
| `date_begin` | Start date, written month/day/year. Required. | `6/4/1947` |
| `date_end` | End date. Leave blank for a one-day event. Write `ongoing` if it never ends within the timeline. | `7/10/1947` |

Current categories: Alien Event, Character, Corporate, Game, Governance, International, Social, Technological, War. You can type a new one and it works right away; it shows in the default gold until Maurice gives it its own color.

## New columns to add

Add these headers to the right of `date_end`. Fill them in whenever you like; the site ignores empty ones.

### `description`
The write-up for the entry. It shows in the file panel when someone clicks the entry, and the search box searches it too.

To link to another entry, wrap its title in double square brackets, the same way Obsidian does:

```
Debris recovered by the 509th was moved under [[Project Omega Revenant Experiments]].
```

To show different text than the title, add a `|` and the text you want:

```
The crash site was later surveyed by [[Kazrik Lancer|Lancer]].
```

Line breaks inside the cell (Ctrl+Enter in Google Sheets) carry over as line breaks on the site.

### `related`
Other entries worth reading alongside this one. They show as clickable tags under "Related entries." Separate them with semicolons.

```
Trinity Test UFO; Ken Eaglesmith Sighting; Cape Girardeau Legend
```

### `bible`
The name of this entry's note in the Obsidian bible, exactly as the note is named. Adds an "Open in Obsidian" button for anyone who has the vault.

```
Roswell Crash
```

### `visibility`
Who gets to see the entry.

| Value | What happens |
|---|---|
| blank or `public` | Everyone sees it. |
| `spoiler` | Shows as a black redaction bar stamped RESTRICTED until the reader turns on "Show spoilers." Search won't reveal it. |
| `gm` | Completely hidden until "Show spoilers" is on. |

This hides things from casual readers only. The sheet itself is viewable by anyone with the link, so keep truly secret GM notes in a separate sheet.

### `id`
A short name used in the entry's web link, like `roswell-crash` in `.../dreamland-timeline/#roswell-crash`. **Leave this blank almost always**; the site makes one from the title. Fill it in only if two entries share a title, or if you want a link to keep working after you rename an entry.

### `branch` and `forks_from`
For parallel or alternate timelines. See the next section.

## Expanding the timeline

### Add an entry
1. Add a new row anywhere in the table. Order doesn't matter; the site sorts by date.
2. Fill in at least `title`, `category` and `date_begin`.
3. Add `date_end` if it spans time, then a `description` and any `related` entries.
4. Refresh the site.

### Add a character
Use category `Character`. `date_begin` is their birth, `date_end` their death. If they're still alive at the end of the timeline, put `ongoing`.

The site then works out on its own which events happened during their life, who their contemporaries were, and how old they were at every event. You never need to enter ages.

### Add a parallel or alternate timeline
1. Pick a short branch name with no spaces, like `cascade-alt`.
2. On every entry that belongs to that branch, put the name in the `branch` column. Main-timeline entries keep `branch` blank.
3. On the first entry of the branch, put the event it splits from in `forks_from`, for example `Y2K Cascade Event`.

Once a second branch exists, branch filter buttons appear under the category buttons. Each branch entry shows a small branch tag and says where it splits from.

### Dates and the Dreamland calendar
- Every month has 28 days, so day 29, 30 or 31 is an error.
- Weeks are 7 days and every month starts on a Sunday, so the site fills in weekdays itself. Day 1 is always Sunday, and day 13 is always Friday.
- Write dates month/day/year: `6/4/1947`. The format `1947-06-04` works too.
- Years outside 1840 to 2000 are fine; the timeline stretches to fit.

## When something looks wrong

Scroll to the bottom of the site. If any row has a problem, a red line reads "rows need attention." Click it for a list with the spreadsheet row number and what to fix. Common ones:

- **Day 30 or month 13**: a date outside the 28-day calendar.
- **date_end is before date_begin**: the dates are swapped.
- **Shares its id with another entry**: two entries have the same title. Give one of them an `id`.
- **Related entry doesn't match**: a typo in `related`, `forks_from` or a `[[link]]`. The name has to match another entry's title or id.

A row with a broken date is skipped until it's fixed. Everything else still loads.

If the bottom of the page says it's showing the bundled snapshot instead of the live sheet, the site couldn't reach Google. Let Maurice know.

## The Personnel page (character creator)

The site's Personnel tab is a character creator. It reads these tabs of the Dreamland Brain sheet live, the same way the timeline reads **timelineRead**:

| Tab | What the creator uses | Columns it needs |
|---|---|---|
| `db.kind` | Kindred choices and their resistances | `name`, `resist`, `type`, `desc` |
| `db.bio` | Bio choices | `name`, `type`, `desc` |
| `db.emp` | Career choices and their skill weights | `name`, `mission`, `combat`, `knowledge`, `social`, `exploration` |
| `db.education` | Education choices | `name`, `type`, `skill`, `tag`, `desc` |

- Adding a row to any of these tabs adds a choice to the creator on the next refresh.
- Don't rename these tabs or those column headers. If the creator can't read a tab, it falls back to a built-in copy and says so at the bottom of the page, so new rows won't show up until it's fixed.
- A new education needs `type` set to `Skill` and `skill` set to one of the 12 skills (Martial, Ballistic, Advanced, Natural, Applied, Mythos, Moxie, Influence, Vigilance, Entry, Intrusion, Transport), or the creator won't offer it.
- A new Bio or Career also needs a matching row in `db.education` (type `Bio` or `Career`) so its description shows on the character sheet.
- Point budgets and stat formulas (28 stat points, 2 Focus skills, HP, Speed and so on) are built into the page, not read from the sheet. If those rules change, tell Maurice. The full list is in `CHARACTER-RULES.md`.

### Adding a player's character to the sheet

Players export with **CSV for the sheet** or **Copy row**. Both give one row in the same column order as the `save` tab. Paste it under the last character in `save` and the character sheets, `control` and encounters pick it up.
