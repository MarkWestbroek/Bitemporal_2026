# Omnium-website → GitHub → Plesk

De marketing-site staat in `bitemp_register_v06/web/omnium-studio/` (onderdeel van de
monorepo). Voor publicatie naar Plesk gebruiken we een **aparte deploy-repo** die alleen
de site-inhoud bevat.

```
monorepo (bron)                          aparte repo                 Plesk
web/omnium-studio/  ──sync-script──▶  D:\Git\omnium-website  ──git──▶  /studio
   (jij bewerkt hier)                 (GitHub Desktop push)         (auto pull)
```

## Eenmalige setup

1. **Maak de GitHub-repo.** In GitHub Desktop: *File → Add local repository* → kies
   `D:\Git\omnium-website` → *Publish repository* → naam **`omnium-website`** → vink
   **Keep this code private** aan → *Publish*.
   (De lokale repo is al aangemaakt en bevat de site met historie.)

2. **Koppel Plesk.** In Plesk → *Git* → *Add Repository*:
   - **Remote repository** → de URL van `omnium-website` (GitHub).
   - **Deployment mode**: Automatic.
   - **Server path**: `/httpdocs/studio` (of `/studio`, afhankelijk van je docroot).
   - Plesk pullt voortaan automatisch bij elke push.

3. **Studio-URL instellen.** Open `sync-omnium-website.ps1` en zet `$StudioUrl` op de
   gepubliceerde Studio-app-URL (bv. `https://common-ground-lab.nl/studio-app/`).
   Zonder dit blijven de "Open de Studio"-links relatief en werken ze niet op Plesk.

## Bij elke wijziging

1. Bewerk + commit de site in de **monorepo** (zoals je nu doet).
2. Draai **`sync-omnium-website.ps1`** (rechtsklik → *Run with PowerShell*).
   Dit spiegelt de site naar `D:\Git\omnium-website` en herschrijft de Studio-links.
3. Open `D:\Git\omnium-website` in **GitHub Desktop** → commit → push.
4. Plesk pullt en deployt automatisch.

## Meerdere sites op één Plesk

Elke Plesk-repository deployt naar één **Server path**. Je kunt dus gerust meerdere
repо's koppelen:

| Repo | Server path |
|------|-------------|
| (root-site) | `/httpdocs` |
| `omnium-website` | `/httpdocs/studio` |
| (andere map) | `/httpdocs/iets-anders` |

Zolang de server-paden elkaar niet overlappen, leven ze naast elkaar.

## Waarom deze opzet?

- **Eén bron van waarheid** (de monorepo); de deploy-repo is een spiegel.
- **GitHub Desktop** blijft je werktuig voor commits/pushes.
- Plesk deployt altijd de **repo-root**, dus de deploy-repo bevat precies de site-inhoud
  (geen submap-gedoe).
- De Studio-URL is **per omgeving** instelbaar in het sync-script — lokaal relatief,
  productie absoluut.
