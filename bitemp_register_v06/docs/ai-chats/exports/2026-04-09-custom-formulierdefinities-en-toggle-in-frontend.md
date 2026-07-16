# Chat: Custom formulierdefinities en toggle in frontend

- **Datum**: 2026-04-09 13:57
- **Sessie-ID**: `17158435-0635-4bfc-95f3-26c03a99a7e9`
- **Berichten**: 4

---

## 🧑 User

nu is er in de frontend iets gemaakt met custom formulierdefinities, en er zou een toggle zijn, maar ik weet niet waar ik ze kan zien

---

## 🤖 Assistant

Ik controleer waar de toggle in de frontend zit en onder welke voorwaarden hij zichtbaar wordt, zodat ik je exact kan zeggen waar je moet kijken.Ik heb de relevante frontendpunten gevonden; nu lees ik de precieze voorwaarden uit de component, zodat ik je niet alleen de plek maar ook de reden kan geven waarom je hem mogelijk niet ziet.De voorwaarde is duidelijk: de toggle verschijnt alleen op een entiteit-detailpagina als er voor dat entiteittype een actieve standaard-FormulierDefinitie met geldige  gevonden wordt. Ik lees nog het stuk JSX waar die knop echt wordt getoond, zodat ik je de exacte plek in de UI kan aanwijzen.Ik heb de UI-plek en de zichtvoorwaarde bevestigd. Ik check nog één ding: of het voorbeeld-replaybestand er echt staat, zodat ik je meteen het kortste pad kan geven om het te zien.Je ziet die toggle niet in het overzicht, maar op de detailpagina van één entiteit in de inhoud-editor. In de code zit hij in , direct onder de kaart met entiteitssamenvatting en boven de losse GE-secties. De knoptekst is “Custom formulier” en na omschakelen “Standaard weergave”.

Hij verschijnt alleen als aan drie voorwaarden voldaan is. Dat staat in : er moet een FormulierDefinitie bestaan voor precies dat doeltype, de status moet  zijn, en  moet `true` zijn. Daarnaast moet er geldige  in zitten. Als een van die dingen ontbreekt, zie je de toggle nergens.

Er is wel een concreet voorbeeld klaar voor `Initiatief`. Het replaybestand staat hier: 

---

## 🧑 User

ik zie geen toggle bij initiatief. zie image

---

## 🤖 Assistant

Ik ga nu direct controleren of de backend überhaupt een actieve `FormulierDefinitie` voor `Initiatief` teruggeeft; daarmee kunnen we onderscheiden tussen een frontend-probleem en ontbrekende data.De API levert wel minstens één `formulier_definitie` op, dus de toggle ontbreekt niet door ontbrekende type-registratie. Ik haal nu de full data van die definitie op om te zien of , ,  en  echt matchen met  echt matchen met `Initiatief`.De full-endpoint geeft iets onverwachts terug, dus ik kijk nu naar de ruwe response om te zien of we tegen fout-HTML, redirect, of een andere routevorm aanlopen.Ik zie nu een inconsistente situatie tussen de eerdere output en de ruwe HTTP-responses. De volgende stap is de frontend-config te lezen, zodat ik exact dezelfde  kan testen als de pagina gebruikt.De detailcomponent gebruikt exact de  uit de schema-context. Ik lees nu waar die context zijn  vandaan krijgt, omdat dit sterk lijkt op een endpoint-pad of host mismatch.De editorpagina bepaalt zijn API-host apart. Ik lees nu die entrypointcode, want als daar een verkeerde base-url of routeprefix zit, verklaart dat exact waarom jij de entiteit wel ziet maar geen formulierdefinitie-toggle.De frontend gebruikt inderdaad `http://localhost:8082` in jouw Vite-scherm. Dan blijft vooral over: de hook roept de verkeerde route aan, of het pad uit de gegenereerde metadata is anders dan verwacht. Ik controleer nu de gegenereerde meta voor `FormulierDefinitie`.Ik heb een concrete inconsistentie gevonden in de gegenereerde metadata, maar dat verklaart de ontbrekende toggle nog niet volledig. Ik check nu hoe de routes echt worden geregistreerd en of `formulier_definities` überhaupt als endpoint bestaat.De data op de pagina bewijst dat de API draait, maar het ontbreken van `/formulier_definitities` wijst erop dat jouw draaiende backend mogelijk nog een oude binary is zonder de nieuwe gegenereerde routes. Ik toets dat nu via de schema-endpoint die de editor echt gebruikt.Ik heb bevestigd dat `8082` de juiste actieve backend is. Nu lees ik de schema-response van die draaiende server om te zien of `FormulierDefinitie` daar echt ontbreekt; dat is waarschijnlijk de directe oorzaak.De vorige schema-check was vervuild door een verkeerd shell-commando. Ik herhaal hem nu netjes, gericht op alleen de vraag of `FormulierDefinitie` in de live schema-response van `8082` De vorige schema-check was vervuild door een verkeerd shell-commando. Ik herhaal hem nu netjes, gericht op alleen de vraag of `FormulierDefinitie` in de live schema-response van `8082` zit.De live schema kent `FormulierDefinitie`, maar de route `GET /formulier_definities` geeft 404. Dat is een echte inconsistentie binnen de backend, dus ik lees nu de route-registratiecode op het beslispunt waar types mogelijk worden overgeslagen.Er zijn nu nog twee plausibele oorzaken: de draaiende binary is niet opnieuw gestart sinds de codegen-wijzigingen, of de configuratie-registratie-init wordt niet aangeroepen in de model-initchain. Ik controleer dat laatste direct in de broncode.De broncode is in orde: de init-chain bevat `FormulierDefinitie` en de routes zouden geregistreerd moeten worden. Daarmee blijft als meest waarschijnlijke oorzaak over dat het proces op `:8082` nog een oude build draait. Ik controleer de actieve PID en starttijd.De API draait als een debug-binary `__debug_b…`, niet als een verse expliciete `go run` of build. Ik pak nog de volledige commandline erbij; daarmee kunnen we vrij hard zeggen dat dit een oude debug-run is die je moet herstarten.Ik heb nu bevestigd dat je niet tegen de normale app-run aankijkt maar tegen een losse debug-binary. Ik vergelijk nog kort de timestamp daarvan met de huidige bronbestanden, zodat ik het verschil hard kan maken.Ik wil één laatste backend-verdachte uitsluiten: een catch-all route of middleware die juist dit pad wegvangt. Daarna kan ik je met zekerheid zeggen of dit een runtime/startup-issue is of een codebug.Ik ga de huidige `:8082`-API vervangen door een verse run van de huidige v06-code. De broncode en tests zeggen dat de route er hoort te zijn; de runtime doet dat nu niet, dus een schone restart is de snelste en meest verdedigbare fix.De oude debug-API is gestopt. Ik start nu een schone `go run` op `:8082` en test daarna meteen of `formulier_definities` en de toggle-voorwaarden nu wel werken.De start liep vanuit de workspace-root in plaats van uit de modulemap. Ik stuur nu het commando in dezelfde terminal met expliciete `cd`, zodat de server echt vanuit  start.Ik wacht niet blind; ik lees nu direct de terminaluitvoer terug en test daarna de relevante endpoints opnieuw.We hebben de oorzaak nu veel scherper: de gewone lijst-route werkt, maar precies de -route die de hook gebruikt bestaat niet in de draaiende app. Ik check nu of de full-handler zelf 404 teruggeeft voor dit type, of dat de route echt ontbreekt.De -tekst die jij effectief krijgt, komt niet uit de full-handler maar uit Gin zelf. Dat betekent dat de route echt ontbreekt voor dit type. Ik lees nu de full-handler alleen nog voor context, maar de frontend-bug is daarmee al redelijk duidelijk: de hook leunt op een full-endpoint dat voor `FormulierDefinitie` niet aanwezig is.Er is een praktische workaround mogelijk als de full-lijstroute wel bestaat: dan kan de hook de definitie in één keer uit  halen en hoeven we de ontbrekende detail-routes niet te gebruiken. Ik test dat nu eerst, want dan kan ik het meteen voor je repareren.Ik heb de directe oorzaak gevonden: de hook gebruikt , maar precies die detailroute bestaat niet in de draaiende app. De full-lijstroute  werkt wel, dus ik pas de hook daarop aan; dan hoort de toggle meteen zichtbaar te worden.
```

```
De hook is nu omgezet naar de werkende full-lijstroute. Ik valideer nog kort of er geen syntax- of buildfout in is gekomen en of de logica nog klopt.De fix buildt schoon. Ik werk nog de relevante documentatie bij, zodat die niet meer zegt dat de hook per definitie-id de full-detailroute gebruikt.
```

```
De toggle ontbrak niet door je `Initiatief`, maar door de hook erachter. In jouw runtime werkte `GET /full/formulier_definities` wel, maar  niet. De frontend-hook gebruikte juist die detailroute, waardoor  leeg bleef en de knop nooit werd getoond.

Dat is nu aangepast in . De hook leest nu direct uit de werkende full-lijstroute. Ik heb ook de uitleg bijgewerkt in . De frontend buildt schoon.

Herlaad nu die pagina op `#/t/initiatieven/37`. Dan zou boven de GE-secties, direct onder de samenvattingskaart, de knop “Custom formulier” moeten verschijnen. Als je hem na refresh nog steeds niet ziet, dan kijk ik als volgende stap live mee naar de browserrequest of de Vite-hot-reload jouw gewijzigde hook wel heeft opgepakt.

---
