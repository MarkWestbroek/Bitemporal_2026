# Versionering — conventie

> Datum: 2026-07-13
> Doel: één afspraak voor versienummers, tags en de branch→PR→merge-werkwijze,
> zodat we betekenisvolle labels hebben zonder rommelige branch-/tag-lijsten.

## 1. Twee lagen: generatie vs. release

We onderscheiden bewust twee dingen die allebei "versie" heten:

| Laag | Wat | Waar | Bumpt wanneer |
|------|-----|------|---------------|
| **Generatie** | de architectuur-generatie van het register | de map: `bitemp_register_v06/` (v04, v05 = archief) | alleen bij een volledige herarchitectuur (zeldzaam) |
| **Release** | de semver van de actieve app | `bitemp_register_v06/web/vite/package.json` → `"version"` | bij elke betekenisvolle mijlpaal |

De **single source of truth** voor het release-nummer is `package.json` van de actieve app.
Op dit moment: **generatie v06, release `0.2.1`**.

## 2. Semver (pre-1.0)

Formaat: **`vMAJOR.MINOR.PATCH`**. Zolang we vóór 1.0 zitten gebruiken we `0.MINOR.PATCH`:

- **PATCH** (`0.2.x`): bugfixes en kleine, niet-brekende dingetjes. Bv. `0.2.0 → 0.2.1` (de Prism-fix).
- **MINOR** (`0.x.0`): nieuwe features. Vóór 1.0 mogen hier ook **breaking changes** in.
- **`1.0.0`**: de eerste stabiele/productiewaardige mijlpaal. Vanaf dan gelden strikte semver-regels
  (breaking → MAJOR).

## 3. Werkwijze

1. **Werk op een branch** met een sprekende naam (`feat/…`, `fix/…`, `docs/…`, `refactor/…`).
2. **PR naar `main`** → reviewen (desnoods jezelf) → **merge** → **branch opruimen**
   (lokaal `git branch -d <naam>`; op GitHub *Delete branch*). De historie blijft in `main` +
   de PR blijft als permanent archief bestaan.
3. **Bij een betekenisvolle mijlpaal op `main`:**
   - werk `"version"` in `package.json` bij;
   - zet een **annotated tag** die daaraan gelijk is:
     ```sh
     git tag -a v0.2.2 -m "Korte omschrijving van de mijlpaal"
     git push origin v0.2.2
     ```
   - GitHub maakt van de tag automatisch een **Release**-pagina (optioneel met changelog-notities).

De `package.json`-versie en de git-tag horen **altijd gelijk** te zijn.

## 4. Tags

- Gebruik **annotated tags** (`-a`, met boodschap/datum/auteur), geen lightweight tags.
- `git tag -l` geeft in één oogopslag alle versies; `git checkout v0.2.1` brengt je naar die
  exacte toestand.
- **Historische tags van vóór deze conventie** (bv. `v0.5-fase-4` uit de v05-generatie) volgen dit
  schema niet — laat ze staan, maar hergebruik het fase-schema niet.

## 5. Branches weggooien kost geen historie

Een branch is slechts een verplaatsbaar naamlabel. Na een merge zitten de commits permanent in
`main`; `git log --graph` toont nog steeds welke commits bij die lijn hoorden, en de PR bewaart de
volledige diff en discussie. Merged branches opruimen is dus veilig en houdt de lijst overzichtelijk.
Alleen een **niet-gemergede** branch verwijderen verweest commits — daarom weigert `git branch -d`
dat, en forceert `git branch -D` het (met opzet).

## 6. Huidige stand & eerstvolgende actie

- Generatie **v06**, release **`0.2.1`** — nog **niet getagd** op `main`.
- Eerstvolgende actie: `main` taggen als **`v0.2.1`** zodat de huidige stand een vast ankerpunt heeft.
