# Dreamland Character Creation Rules

The Personnel page (`character.html`) implements these rules. The math lives in `src/character/rules.ts`; the Kindred, Bio, Career and Education lists are read live from the sheet.

Extracted from the Dreamland Brain workbook (`gen`, `save`, `save.handler`, `control`, `db.*` tabs), 2026-10-04. This is what the web character creator will implement. Anything marked **Check** needs a decision from Nat.

## Creation steps (mirrors the `gen` tab)

1. **Name and Level.** Level starts at 1.
2. **Kindred**, from `db.kind`: Human, Revenant, Oni, Fish. Each sets resistances and a type.
3. **Bio**, from `db.bio` (12 options). It also becomes Education 1.
4. **Career**, from `db.emp` (24 options). It also becomes Education 2 and sets the skill point pool for each category.
5. **Stats.** Spend 28 points across 7 stats.
6. **Skills.** Spend career-based points per category and mark Focus skills.
7. **Educations.** Pick extra educations based on Curiosity.

## Stats

| Rule | Value |
|---|---|
| Stats | Power, Energy, Reflex, Fortune, Ego, Curiosity, Tact |
| Points to spend | 28 |
| Points per stat | 0 to 8 |
| Stat total | 2 + points spent |
| Level bonuses | Mark one stat at level 5 and one at level 10 for +1 each |
| Modifier | floor(total / 3) |

What each stat feeds, from the `gen` descriptions:

| Stat | Feeds |
|---|---|
| Power | Carry, Leap |
| Energy | HP, Regen, edible potency, mutation bonus |
| Reflex | Speed, Defense |
| Fortune | Luck, crit damage, loot |
| Ego | Media and Occult range, Influence points, Sanity |
| Curiosity | Hack points, medical potency, Crafting and Robotics durability, Sanity, education slots |
| Tact | Sight, Hearing, Observation range, Pilot, Mechanic, Lockpick, Sanity |

## Skills

There are four categories with three skills each:

| Category | Skills |
|---|---|
| Combat | Martial, Ballistic, Advanced |
| Knowledge | Natural, Applied, Mythos |
| Social | Moxie, Influence, Vigilance |
| Exploration | Entry, Intrusion, Transport |

- **Points per category** = floor(career weight × level). Career weights are 1.0, 0.75, 0.5 and 0.25, one per category (the stars in `db.emp`). At level 1, only the career's 1.0 category gets a point.
- **Max per skill** = the current level, so 1 at level 1.
- **Focus** adds +2 to a skill, and either points or Focus unlock that skill's educations.
- Skill total = points + 2 if focused.

**Decided 2026-10-04:** exactly 2 Focus skills per character.

## Educations

- **Education 1** is the Bio. **Education 2** is the Career.
- **Extra slots:** floor(Curiosity total / 3) + 1, up to 4 extra (Edu 3 to Edu 6).
- Extra educations come from `db.education` rows of type Skill whose skill has points or a Focus. No duplicates.
- Each extra education adds +1 to its sub-skill tag. For example, Rifle Handling gives Rifle +1, and two Media educations give Media +2.

There are 84 skill educations: 3 per sub-skill, written as Models, Handling and Tactics for weapons, and with themed names for the rest.

## Derived stats (from `control`)

| Stat | Formula |
|---|---|
| HP | 20 + Level × Energy total |
| Limb HP | HP × head 0.25, torso 0.50, each arm 0.35, each leg 0.45, feet 0.25, rounded down to 0.25 |
| Regen | HP / 10, +5 if Kindred is Fish |
| Sanity | 1 + Ego mod + Curiosity mod + Tact mod |
| Speed | 4 + Reflex mod |
| Defense | 4 + Reflex mod + Level |
| Sight | 6 + Tact mod |
| Hearing | 6 + Tact mod × 2 |
| Carry | 50 + Power mod × 10 + Level × 10 |
| Luck | Fortune mod |
| Rads | 100 |
| Resists | From Kindred: Revenant has 2 radiation, Oni 10% physical and 10% explosion, Fish 10% elemental |

Checked against Thagrand Daedalyn (Energy 5, Reflex 8, Tact 8, Fortune 4, Ego 4, Curiosity 5): HP 25, Speed 6, Defense 7, Sight 8, Hearing 10, Luck 1 and Sanity 5 all match the sheet.

## Issues found in the workbook

- **Feet HP.** `save.handler` uses a 0.25 multiplier for feet, but `sheet.1` shows 13.5/25 (0.54) and `control` shows 37.5/80 (0.47). **Decided 2026-10-04:** use 0.25 for now.
- **Carry shows #N/A** on `sheet.1`. A character with no loot makes the `booty` lookup in column O fail, and Carry sums column O. Wrapping column O in `IFERROR(..., 0)` fixes it.
- **Naming mismatches:**
  - `db.education` uses **Science** where `sheet.1` lists **Robotics**.
  - `tag` and `perks` use **Throw** in places, while educations use **Thrown**.
  - `tag` lists Marksman, Technical, Media, Observation and Pilot as group names, but the sheet uses Ballistic, Applied, Mythos, Vigilance and Transport.
  - The creator follows `gen` and `db.education`.
- **Two career tables.** `db.career` (hidden, older weights) and `db.emp` (current, 24 careers). The creator uses `db.emp`, as `gen` does.

## Not part of creation yet

- **Equipment** comes from loot (`booty`). **Decided 2026-10-04:** new characters start with Fist in both hands and every other slot empty.
- **Perks** (`perks` tab) look like level-up rewards, so they're left out of creation for now.

## Exports

| Format | Contents |
|---|---|
| CSV | One row in the exact column order of the `save` tab: Name, Level, Kindred, Bio, Career, 7 stats, 12 skills, edu_1 to edu_6. Paste it under the last row of `save` and the whole workbook (control, sheets, encounters) picks the character up. |
| PNG | Dossier-styled character sheet image, for Discord. |
| PDF | Printable character sheet. |
| JSON | Full save file that can be loaded back into the creator to keep editing. |
