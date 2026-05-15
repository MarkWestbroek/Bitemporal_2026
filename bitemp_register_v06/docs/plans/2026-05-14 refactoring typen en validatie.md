Dank!

Hier moeten we wel nog wat refactoren, denk ik. Deels op code gebied, deels op model-indeling vlak.

# gegevenstypen
we hebben al een paar plumbing domeinen:
- configuratie, voor FormulierDefinitie e.d. (datatype Versie leeft daar)
- register, referentielijst basisklasse waaruit een paar tabellen worden gegenereerd

In register zitten echter ook een boel gegevenstypen. Misschien zitten die daar verkeerd, en zouden ze naar een apart gegevenstypen domein moeten.

De gegevenstypen moeten namelijk ook in de IDE zichtbaar zijn, omdat je de typen kiest. Ook zou het mogelijk moeten zijn dat voor een specifieke register instantie men alleen maar een paar typen nodig heeft, en de rest weggelaten kan worden.

Gegevenstypen zijn dus geen plumbing, maar deel van het model.

De plumbing domeinen moeten wel in de IDE te laden zijn, voor mij als developer van de register-maak-applicatie nu, maar later, voor modelleurs die een register genereren via de IDE, niet meer. Gegevenstypen echter wel.

Dat heeft als implicatie dat we **niets** rondom gegevenstypen hard moeten coderen. Dat is nu wel het geval in de validation_walker en validation go files.
- validatie wordt daarom idealiter zonder reflectie opgebouwd en zeker zonder harde codering
- ik zie dat via reflectie het type wordt verkregen uit de representatie struct en dan de schema:"datatype:BSN" (bijv.) tag
   - is dat niet duur? Bij elke request en elk veld moet dat namelijk worden gedaan.
   - het idee van een metaregistry was, dat dit snel uit een array gevist zou moeten kunnen worden (i.i.g. nu de informatie over REPs)
   - als dat zo is, zouden we dan de struct-tags informatie die nodig is voor validatie niet ook op één of andere manier in de/een metaregistry moeten opnemen? De afgeleide velden zitten er al in. De velden gaan nog via de structs.

## plaats van gegevenstypen
- basistypen (en dat mogen er veel zijn) in gegevenstypen domein
- heel specifieke typen, waarvan de modelleur weet dat ze alleen in 1 domein leven, in het domein zelf
- naam-clashes moeten we op letten, als we er een go-alias van genereren. Binnen 1 domein gemakkelijk in de IDE te checken, maar erbuiten lastiger, zeker omdat we additieve codegen doen, en er dus al typen kunnen bestaan in de code.

### probleem
- er is nu een apart financieel domein, waar eigenlijk alleen IBAN in zit, dat is nutteloos. IBAN is algemeen toepasbaar, dus mag in gegevenstypen

# validatie zelf
- er is al validatie ingebouwd in de FrontEnd: dat is in javascript neem ik aan. Hoe is de BSN validatie daar bijv. gebouwd?
- hier hebben we soms go code nodig om te valideren
- in de IDE en editor is het mogelijk om bij gegevenstypen naast een pattern een validatieregel in te voeren
    - checksum bijv. `(9*d1 + 8*d2 + 7*d3 + 6*d4 + 5*d5 + 4*d6 + 3*d7 + 2*d8 - 1*d9) % 11 == 0` bij BSN
    - formula, ik heb geen voorbeeld
    - function, idem
- ik weet niet of alles daarachter ook geimplementeerd is (in de inhoud editor bijv.)
- in de UML editor (niet de IDE) is wel een test invoer knop (img2) die lijkt te werken
- kan deze definitie van checksum/ formule / functie ook generiek opgesteld worden en dan in go uitvoerbaar gegenereerd worden door de codegen?
- uiterste weg is: in de IDE/editor zowel js als go code in kunnen voeren voor de validatie, en die dan genereren (go) / gebruiken in de frontend (js)
  - maar misschien hoeft dat dus niet als we slim werken

# uitvoering
Wat denk je?
- Kunnen we dit het best in de code refactoren en dan de code terug inlezen in de IDE naar een V3 file, of andersom en genereren?
- wat te doen met de validatie reflectie en code?
- eventueel andere issues
