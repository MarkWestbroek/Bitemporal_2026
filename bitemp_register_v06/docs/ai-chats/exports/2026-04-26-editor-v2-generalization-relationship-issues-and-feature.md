# Chat: Editor-v2 generalization relationship issues and feature request

- **Datum**: 2026-04-26 10:54
- **Sessie-ID**: `fc4db501-bbee-42c7-afe5-042bfdba1f35`
- **Berichten**: 2

---

## 🧑 User

Een bevinding in de editor-v2: als ik een generalisatie relatie aanleg van bron naar doel tussen nieuwsbericht en kennisartikel, tekent hij hem andersom. Als ik dan van werkinstructie naar kennisartikel hetzelfde doe, gebeurt dat ook, en bovendien verdwijnt de eerder getoonde relatie weer...

Dit model is juist geimporteerd vanuit een mermaid (UML.md). De export (KISS v01 json) heeft een hoop tekortkomingen. Als ik deze importeer zijn alle relaties weg. Komt misschien doordat allee Mermaid klassen ENT'n zijn geworden. Wat niet correct is, maar de import heeft geen informatie om dat anders te doen.

Verder een feature request voor de editor (en eigenlijk ook de IDE): zou ik met rechtsklik op een element of selectie van alle geselecteerde elementen het domein kunnen veranderen?

---

## 🤖 Assistant

Let me look at the  function and the ContextMenu:  Now let me look at the context menu handling in MetamodelEditor and how available domains are managed:  Now I have enough context to implement all fixes. Let me look at how the ContextMenu renders in MetamodelEditor's JSX: I now have a full understanding of all three issues. Let me implement the fixes: **Bug 1 & 2 fix**: De root cause is dat bij het slepen van een  handle React Flow source/target omdraait. De fix: detecteer dit in  en swap terug. 
```

```
Now update the rest of  to use  instead of : 
```

```
**Bug 3 fix**:  — generalisatie-pijlen herkennen en juiste richting instellen: 
```

```
**Feature: rechtsklik → domein wijzigen**. Eerst uitbreiden van de ContextMenu component, dan de handler in MetamodelEditor:  
```

```

```

```
Now add the "domein" menu type variant in the JSX render: 
```

```
Now add the domain-change handler and update  /  in MetamodelEditor. First, let me see how  and  are structured:  Now add the `handleDomeinWijzigen` callback after : 
```

```
Now update  to also show the domein menu for model nodes (also for single selected nodes):  
```

```
Now pass the new props to the ContextMenu component in the JSX:   
```

```
Now add some CSS for the new domein menu elements:   
```

```
Now verify there are no obvious errors:  Clean. Drie fixes, samengevat:

---

**Bug 1 & 2 — Generalisatie richting + verdwijnend edge** ()

Root cause: elke entiteit-node heeft  én  handles op dezelfde posities. Als React Flow registreert dat de gebruiker van een  handle sleepte, draait hij intern source/target om. De  functie detecteert dit nu aan het begin () en swapt ze terug. Dit fixte ook het "verdwijnend" bug: beide generalisaties hadden onterecht dezelfde parent-node als , waardoor de filter telkens de vorige weggooit.

**Bug 3 — Mermaid import , waardoor de filter telkens de vorige weggooit.

**Bug 3 — Mermaid import zonder generalisaties** ()

 herkende `<|--`/`--|>` (en `<|..`/`..|>`) niet als generalisatie. Nu worden deze arrows gedetecteerd,  gezet, en de richting gecorrigeerd: `A <|-- B` betekent B erft A, dus source=B (kind), target=A (ouder) — conform de editor-conventie.

**Feature — Rechtsklik → Domein wijzigen** (, , )

Rechtsklik op een entiteit/GE/relatie/etc.-node toont nu een "Domein wijzigen" menu met:
- Alle bestaande domeinen als snelknoppen
- Een tekstveld voor een nieuw domein (Enter of OK)
- Werkt op 1 node of op een volledige multi-selectie

---
