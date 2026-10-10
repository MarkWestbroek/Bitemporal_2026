# Voorziening Common Ground

De Collectieve Gegevensvoorziening (CGV) is een systeem dat functionaliteiten biedt voor het opslaan, beheren en ontsluiten van gegevens. In dit document beschrijven we de functionaliteiten van de CGV met een use case model. Een use case model beschrijft actoren en de use cases waar de actoren gebruik van kunnen maken.

Het bijzondere aan de CGV is dat deze zich beperkt tot componenten (en dus functionaliteiten) op de lagen één t/m drie, d.w.z. gegevens, services en integratie. Daardoor is het niet triviaal om functionaliteiten voor eindgebruikers te beschrijven. Toch willen we eindgebruikers als actoren beschouwen, om zo de verbinding met dienstverlening te behouden.

Belangrijke actoren zijn klanten en medewerkers. Deze maken gebruik van applicaties. Die applicaties leven op lagen vier en vijf en vallen buiten de scope van de CGV; die tonen we grijs. De applicaties sluiten aan op de integratielaag om gebruik te maken van API's en componenten die gegevens ontsluiten. De genoemde componenten zijn slechts voorbeelden.

## Context Diagram

<svg xmlns="http://www.w3.org/2000/svg" viewBox="-30 17.5 808 531.1" width="808" height="531.1" font-family="system-ui, Segoe UI, sans-serif" role="img"><defs><marker id="d1-pijl-open-start" markerWidth="12" markerHeight="10" refX="10" refY="5" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M 1 1 L 10 5 L 1 9" fill="none" stroke="#475569" stroke-width="1.2"/></marker></defs><rect x="-5" y="41.5" width="759" height="109" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/><text x="5" y="55.5" text-anchor="start" font-size="11" font-weight="700" fill="#475569" dominant-baseline="middle">Actoren</text><rect x="-6" y="166.2" width="759" height="109" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/><text x="4" y="180.2" text-anchor="start" font-size="11" font-weight="700" fill="#475569" dominant-baseline="middle">Applicaties (buiten scope)</text><rect x="-6" y="290.9" width="759" height="109" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/><text x="4" y="304.9" text-anchor="start" font-size="11" font-weight="700" fill="#475569" dominant-baseline="middle">Integratievoorzieningen</text><rect x="-6" y="415.6" width="759" height="109" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/><text x="4" y="429.6" text-anchor="start" font-size="11" font-weight="700" fill="#475569" dominant-baseline="middle">Gegevens</text><rect x="180.8" y="74" width="140" height="44" rx="14" fill="#eef2ff" stroke="#475569" stroke-width="1.2"/><text x="250.8" y="96" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Klant</text><rect x="408.4" y="74" width="140" height="44" rx="14" fill="#eef2ff" stroke="#475569" stroke-width="1.2"/><text x="478.4" y="96" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Medewerker</text><rect x="9.8" y="203.2" width="170" height="44" rx="14" fill="#e5e7eb" stroke="#475569" stroke-width="1.2"/><text x="94.8" y="225.2" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">OpenFormulieren</text><rect x="194.8" y="203.2" width="170" height="44" rx="14" fill="#e5e7eb" stroke="#475569" stroke-width="1.2"/><text x="279.8" y="225.2" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">NLPortal</text><rect x="379.8" y="203.2" width="170" height="44" rx="14" fill="#e5e7eb" stroke="#475569" stroke-width="1.2"/><text x="464.8" y="225.2" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">KISS</text><rect x="564.8" y="203.2" width="170" height="44" rx="14" fill="#e5e7eb" stroke="#475569" stroke-width="1.2"/><text x="649.8" y="225.2" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">GZAC</text><rect x="150" y="321.7" width="200" height="44" rx="14" fill="#eef2ff" stroke="#475569" stroke-width="1.2"/><text x="250" y="343.7" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">OpenFSC</text><rect x="402.9" y="321.7" width="200" height="44" rx="14" fill="#eef2ff" stroke="#475569" stroke-width="1.2"/><text x="502.9" y="343.7" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">OpenFTV</text><rect x="60" y="448.1" width="190" height="44" rx="14" fill="#eef2ff" stroke="#475569" stroke-width="1.2"/><text x="155" y="470.1" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">OpenZaak</text><rect x="285" y="448.1" width="190" height="44" rx="14" fill="#eef2ff" stroke="#475569" stroke-width="1.2"/><text x="380" y="470.1" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">OpenKlant</text><rect x="510" y="448.1" width="190" height="44" rx="14" fill="#eef2ff" stroke="#475569" stroke-width="1.2"/><text x="605" y="470.1" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">OpenObject</text><line x1="372.4" y1="448.1" x2="258.4" y2="118" stroke="#475569" stroke-width="1.3" marker-start="url(#d1-pijl-open-start)"/><line x1="174" y1="448.1" x2="459.4" y2="118" stroke="#475569" stroke-width="1.3" marker-start="url(#d1-pijl-open-start)"/><line x1="385.8" y1="448.1" x2="472.6" y2="118" stroke="#475569" stroke-width="1.3" marker-start="url(#d1-pijl-open-start)"/><line x1="597.6" y1="448.1" x2="485.8" y2="118" stroke="#475569" stroke-width="1.3" marker-start="url(#d1-pijl-open-start)"/></svg>

*Lagen van de CGV (import)*

### Archimate elementen

## Actoren

<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1669.6 -895.8 1256.6 541" width="1256.6" height="541" font-family="system-ui, Segoe UI, sans-serif" role="img"><defs><marker id="d2-driehoek" markerWidth="14" markerHeight="14" refX="13" refY="7" orient="auto" markerUnits="userSpaceOnUse"><path d="M 1 1 L 13 7 L 1 13 Z" fill="#ffffff" stroke="#475569" stroke-width="1.2"/></marker></defs><rect x="-1645.6" y="-871.8" width="376" height="493" rx="8" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="6 4"/><text x="-1635.6" y="-857.8" text-anchor="start" font-size="11" font-weight="700" fill="#475569" dominant-baseline="middle">Klanten</text><rect x="-1229.3" y="-871.8" width="376" height="493" rx="8" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="6 4"/><text x="-1219.3" y="-857.8" text-anchor="start" font-size="11" font-weight="700" fill="#475569" dominant-baseline="middle">Gemeente</text><rect x="-813" y="-871.8" width="376" height="493" rx="8" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="6 4"/><text x="-803" y="-857.8" text-anchor="start" font-size="11" font-weight="700" fill="#475569" dominant-baseline="middle">Serviceorganisatie</text><circle cx="-1558.6" cy="-796.5" r="10" fill="none" stroke="#475569" stroke-width="1.4"/><path d="M -1558.6 -786.5 V -758.9 M -1579.6 -778.5 H -1537.6 M -1558.6 -758.9 L -1578.2 -731.3 M -1558.6 -758.9 L -1539 -731.3" fill="none" stroke="#475569" stroke-width="1.4" stroke-linecap="round"/><text x="-1558.6" y="-708.5" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">Inwoner</text><circle cx="-1140.7" cy="-791.4" r="10" fill="none" stroke="#475569" stroke-width="1.4"/><path d="M -1140.7 -781.4 V -753.8 M -1161.7 -773.4 H -1119.7 M -1140.7 -753.8 L -1160.3 -726.2 M -1140.7 -753.8 L -1121.1 -726.2" fill="none" stroke="#475569" stroke-width="1.4" stroke-linecap="round"/><text x="-1140.7" y="-703.4" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">Zaakbehandelaar</text><circle cx="-728.5" cy="-786.5" r="10" fill="none" stroke="#475569" stroke-width="1.4"/><path d="M -728.5 -776.5 V -748.9 M -749.5 -768.5 H -707.5 M -728.5 -748.9 L -748.1 -721.3 M -728.5 -748.9 L -708.9 -721.3" fill="none" stroke="#475569" stroke-width="1.4" stroke-linecap="round"/><text x="-728.5" y="-705.4" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">Supportmedewerker</text><text x="-728.5" y="-691.6" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">serviceorganisatie</text><circle cx="-917.7" cy="-653.3" r="10" fill="none" stroke="#475569" stroke-width="1.4"/><path d="M -917.7 -643.3 V -615.7 M -938.7 -635.3 H -896.7 M -917.7 -615.7 L -937.3 -588.1 M -917.7 -615.7 L -898.1 -588.1" fill="none" stroke="#475569" stroke-width="1.4" stroke-linecap="round"/><text x="-917.7" y="-572.2" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">Medewerker</text><text x="-917.7" y="-558.4" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">Gemeente</text><circle cx="-728.5" cy="-653.3" r="10" fill="none" stroke="#475569" stroke-width="1.4"/><path d="M -728.5 -643.3 V -615.7 M -749.5 -635.3 H -707.5 M -728.5 -615.7 L -748.1 -588.1 M -728.5 -615.7 L -708.9 -588.1" fill="none" stroke="#475569" stroke-width="1.4" stroke-linecap="round"/><text x="-728.5" y="-572.2" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">Beheerder</text><text x="-728.5" y="-558.4" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">Service-organisatie</text><circle cx="-535.5" cy="-653.3" r="10" fill="none" stroke="#475569" stroke-width="1.4"/><path d="M -535.5 -643.3 V -615.7 M -556.5 -635.3 H -514.5 M -535.5 -615.7 L -555.1 -588.1 M -535.5 -615.7 L -515.9 -588.1" fill="none" stroke="#475569" stroke-width="1.4" stroke-linecap="round"/><text x="-535.5" y="-572.2" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">Medewerker</text><text x="-535.5" y="-558.4" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">Service-organisatie</text><circle cx="-1558.6" cy="-645.8" r="10" fill="none" stroke="#475569" stroke-width="1.4"/><path d="M -1558.6 -635.8 V -608.2 M -1579.6 -627.8 H -1537.6 M -1558.6 -608.2 L -1578.2 -580.6 M -1558.6 -608.2 L -1539 -580.6" fill="none" stroke="#475569" stroke-width="1.4" stroke-linecap="round"/><text x="-1558.6" y="-557.8" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">Onderneming</text><circle cx="-1358.9" cy="-645.8" r="10" fill="none" stroke="#475569" stroke-width="1.4"/><path d="M -1358.9 -635.8 V -608.2 M -1379.9 -627.8 H -1337.9 M -1358.9 -608.2 L -1378.5 -580.6 M -1358.9 -608.2 L -1339.3 -580.6" fill="none" stroke="#475569" stroke-width="1.4" stroke-linecap="round"/><text x="-1358.9" y="-557.8" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">Klant</text><circle cx="-1140.7" cy="-645.8" r="10" fill="none" stroke="#475569" stroke-width="1.4"/><path d="M -1140.7 -635.8 V -608.2 M -1161.7 -627.8 H -1119.7 M -1140.7 -608.2 L -1160.3 -580.6 M -1140.7 -608.2 L -1121.1 -580.6" fill="none" stroke="#475569" stroke-width="1.4" stroke-linecap="round"/><text x="-1140.7" y="-557.8" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">KCC-medewerker</text><circle cx="-1140.7" cy="-584.7" r="10" fill="none" stroke="#475569" stroke-width="1.4"/><path d="M -1140.7 -574.7 V -547.1 M -1161.7 -566.7 H -1119.7 M -1140.7 -547.1 L -1160.3 -519.5 M -1140.7 -547.1 L -1121.1 -519.5" fill="none" stroke="#475569" stroke-width="1.4" stroke-linecap="round"/><text x="-1140.7" y="-496.7" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">Informatiebeheerder</text><circle cx="-728.5" cy="-511.2" r="10" fill="none" stroke="#475569" stroke-width="1.4"/><path d="M -728.5 -501.2 V -473.6 M -749.5 -493.2 H -707.5 M -728.5 -473.6 L -748.1 -446 M -728.5 -473.6 L -708.9 -446" fill="none" stroke="#475569" stroke-width="1.4" stroke-linecap="round"/><text x="-728.5" y="-436.9" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">Technisch</text><text x="-728.5" y="-423.2" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">beheerder</text><text x="-728.5" y="-409.4" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">service-organisatie</text><circle cx="-1558.6" cy="-497.5" r="10" fill="none" stroke="#475569" stroke-width="1.4"/><path d="M -1558.6 -487.5 V -459.9 M -1579.6 -479.5 H -1537.6 M -1558.6 -459.9 L -1578.2 -432.3 M -1558.6 -459.9 L -1539 -432.3" fill="none" stroke="#475569" stroke-width="1.4" stroke-linecap="round"/><text x="-1558.6" y="-409.5" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">Vertegenwoordiger</text><circle cx="-1140.7" cy="-481.4" r="10" fill="none" stroke="#475569" stroke-width="1.4"/><path d="M -1140.7 -471.4 V -443.8 M -1161.7 -463.4 H -1119.7 M -1140.7 -443.8 L -1160.3 -416.2 M -1140.7 -443.8 L -1121.1 -416.2" fill="none" stroke="#475569" stroke-width="1.4" stroke-linecap="round"/><text x="-1140.7" y="-400.3" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">Geautomatiseerde</text><text x="-1140.7" y="-386.5" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">medewerker</text><line x1="-693.5" y1="-718.4" x2="-570.5" y2="-633.5" stroke="#475569" stroke-width="1.3" marker-end="url(#d2-driehoek)"/><line x1="-693.5" y1="-492.9" x2="-570.5" y2="-583.5" stroke="#475569" stroke-width="1.3" marker-end="url(#d2-driehoek)"/><line x1="-1105.7" y1="-603" x2="-952.7" y2="-608.1" stroke="#475569" stroke-width="1.3" marker-end="url(#d2-driehoek)"/><line x1="-1105.7" y1="-725.7" x2="-952.7" y2="-631" stroke="#475569" stroke-width="1.3" marker-end="url(#d2-driehoek)"/><line x1="-693.5" y1="-609.3" x2="-570.5" y2="-609.3" stroke="#475569" stroke-width="1.3" marker-end="url(#d2-driehoek)"/><line x1="-1523.6" y1="-726.1" x2="-1393.9" y2="-628.2" stroke="#475569" stroke-width="1.3" marker-end="url(#d2-driehoek)"/><line x1="-1523.6" y1="-601.8" x2="-1393.9" y2="-601.8" stroke="#475569" stroke-width="1.3" marker-end="url(#d2-driehoek)"/><line x1="-1523.6" y1="-479.5" x2="-1393.9" y2="-575.8" stroke="#475569" stroke-width="1.3" marker-end="url(#d2-driehoek)"/><line x1="-1105.7" y1="-551.5" x2="-952.7" y2="-598.5" stroke="#475569" stroke-width="1.3" marker-end="url(#d2-driehoek)"/><line x1="-1105.7" y1="-464.4" x2="-952.7" y2="-582.3" stroke="#475569" stroke-width="1.3" marker-end="url(#d2-driehoek)"/></svg>

*actor model*

## Use Cases

### Klant

<svg xmlns="http://www.w3.org/2000/svg" viewBox="534 297 1366 1568" width="1366" height="1568" font-family="system-ui, Segoe UI, sans-serif" role="img"><defs><marker id="d3-driehoek" markerWidth="14" markerHeight="14" refX="13" refY="7" orient="auto" markerUnits="userSpaceOnUse"><path d="M 1 1 L 13 7 L 1 13 Z" fill="#ffffff" stroke="#475569" stroke-width="1.2"/></marker><marker id="d3-pijl-open" markerWidth="12" markerHeight="10" refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M 1 1 L 10 5 L 1 9" fill="none" stroke="#475569" stroke-width="1.2"/></marker></defs><rect x="908" y="321" width="856" height="1520" rx="8" fill="none" stroke="#94a3b8" stroke-width="1.5"/><text x="918" y="335" text-anchor="start" font-size="11" font-weight="700" fill="#475569" dominant-baseline="middle">Gemeentelijke dienstverlening</text><rect x="934" y="348" width="770" height="513" rx="8" fill="none" stroke="#94a3b8" stroke-width="1.5"/><text x="944" y="362" text-anchor="start" font-size="11" font-weight="700" fill="#475569" dominant-baseline="middle">Vragen en informatie</text><rect x="933.8" y="894.3" width="683" height="397" rx="8" fill="none" stroke="#94a3b8" stroke-width="1.5"/><text x="943.8" y="908.3" text-anchor="start" font-size="11" font-weight="700" fill="#475569" dominant-baseline="middle">Verzoeken en meldingen</text><rect x="933.8" y="1318.8" width="516" height="314" rx="8" fill="none" stroke="#94a3b8" stroke-width="1.5"/><text x="943.8" y="1332.8" text-anchor="start" font-size="11" font-weight="700" fill="#475569" dominant-baseline="middle">Taken uitvoeren</text><rect x="933.8" y="1671.5" width="516" height="160" rx="8" fill="none" stroke="#94a3b8" stroke-width="1.5"/><text x="943.8" y="1685.5" text-anchor="start" font-size="11" font-weight="700" fill="#475569" dominant-baseline="middle">Persoonsgegevens</text><ellipse cx="1065.2" cy="429.8" rx="95" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="1065.2" y="422.3" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Zoek informatie over</text><text x="1065.2" y="437.3" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">producten en diensten</text><ellipse cx="1217.2" cy="548.6" rx="95" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="1217.2" y="548.6" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Stel een vraag</text><circle cx="1841" cy="583.2" r="10" fill="none" stroke="#475569" stroke-width="1.4"/><path d="M 1841 593.2 V 620.8 M 1820 601.2 H 1862 M 1841 620.8 L 1821.4 648.4 M 1841 620.8 L 1860.6 648.4" fill="none" stroke="#475569" stroke-width="1.4" stroke-linecap="round"/><text x="1841" y="664.3" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">Geautomatiseerde</text><text x="1841" y="678.1" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">medewerker</text><ellipse cx="1537.4" cy="607.8" rx="95" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="1537.4" y="607.8" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Voer chatgesprek</text><ellipse cx="1540.9" cy="689.9" rx="80" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="1540.9" y="689.9" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Voer telefoongesprek</text><ellipse cx="1273.7" cy="707.2" rx="95" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="1273.7" y="707.2" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Voer gesprek</text><circle cx="1841" cy="707.4" r="10" fill="none" stroke="#475569" stroke-width="1.4"/><path d="M 1841 717.4 V 745 M 1820 725.4 H 1862 M 1841 745 L 1821.4 772.6 M 1841 745 L 1860.6 772.6" fill="none" stroke="#475569" stroke-width="1.4" stroke-linecap="round"/><text x="1841" y="788.6" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">Medewerker</text><text x="1841" y="802.3" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">Gemeente</text><ellipse cx="1537.4" cy="777.3" rx="95" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="1537.4" y="777.3" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Wissel e-mail uit</text><circle cx="593" cy="916.4" r="10" fill="none" stroke="#475569" stroke-width="1.4"/><path d="M 593 926.4 V 954 M 572 934.4 H 614 M 593 954 L 573.4 981.6 M 593 954 L 612.6 981.6" fill="none" stroke="#475569" stroke-width="1.4" stroke-linecap="round"/><text x="593" y="1004.4" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">Inwoner</text><ellipse cx="1100.7" cy="960" rx="95" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="1100.7" y="960" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Maak een afspraak</text><ellipse cx="1494.7" cy="962.6" rx="95" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="1494.7" y="962.6" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Vul contactformulier in</text><circle cx="799.5" cy="1000.6" r="10" fill="none" stroke="#475569" stroke-width="1.4"/><path d="M 799.5 1010.6 V 1038.2 M 778.5 1018.6 H 820.5 M 799.5 1038.2 L 779.9 1065.8 M 799.5 1038.2 L 819.1 1065.8" fill="none" stroke="#475569" stroke-width="1.4" stroke-linecap="round"/><text x="799.5" y="1088.6" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">Klant</text><ellipse cx="1255.8" cy="1030.9" rx="80" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="1255.8" y="1030.9" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Vraag gesprek aan</text><circle cx="593" cy="1014.4" r="10" fill="none" stroke="#475569" stroke-width="1.4"/><path d="M 593 1024.4 V 1052 M 572 1032.4 H 614 M 593 1052 L 573.4 1079.6 M 593 1052 L 612.6 1079.6" fill="none" stroke="#475569" stroke-width="1.4" stroke-linecap="round"/><text x="593" y="1102.4" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">Onderneming</text><circle cx="1841" cy="1033.9" r="10" fill="none" stroke="#475569" stroke-width="1.4"/><path d="M 1841 1043.9 V 1071.5 M 1820 1051.9 H 1862 M 1841 1071.5 L 1821.4 1099.1 M 1841 1071.5 L 1860.6 1099.1" fill="none" stroke="#475569" stroke-width="1.4" stroke-linecap="round"/><text x="1841" y="1121.9" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">KCC-medewerker</text><ellipse cx="1491.2" cy="1055.1" rx="95" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="1491.2" y="1055.1" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Bel op</text><circle cx="593" cy="1112.4" r="10" fill="none" stroke="#475569" stroke-width="1.4"/><path d="M 593 1122.4 V 1150 M 572 1130.4 H 614 M 593 1150 L 573.4 1177.6 M 593 1150 L 612.6 1177.6" fill="none" stroke="#475569" stroke-width="1.4" stroke-linecap="round"/><text x="593" y="1200.4" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">Vertegenwoordiger</text><ellipse cx="1098.7" cy="1141.9" rx="95" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="1098.7" y="1134.4" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Vraag product/dienst</text><text x="1098.7" y="1149.4" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">aan</text><circle cx="1841" cy="1127" r="10" fill="none" stroke="#475569" stroke-width="1.4"/><path d="M 1841 1137 V 1164.6 M 1820 1145 H 1862 M 1841 1164.6 L 1821.4 1192.2 M 1841 1164.6 L 1860.6 1192.2" fill="none" stroke="#475569" stroke-width="1.4" stroke-linecap="round"/><text x="1841" y="1215" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">Zaakbehandelaar</text><ellipse cx="1476" cy="1202.9" rx="95" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="1476" y="1202.9" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Bekijk voortgang</text><ellipse cx="1094.7" cy="1231.7" rx="95" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="1094.7" y="1231.7" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Dien melding in</text><ellipse cx="1335.9" cy="1396.8" rx="95" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="1335.9" y="1396.8" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Voer betaling uit</text><ellipse cx="1065.9" cy="1484.8" rx="95" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="1065.9" y="1484.8" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Voer taak uit</text><ellipse cx="1335.9" cy="1484.8" rx="95" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="1335.9" y="1484.8" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Vul formulier in</text><ellipse cx="1335.9" cy="1572.8" rx="95" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="1335.9" y="1572.8" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Lever informatie aan</text><ellipse cx="1058.7" cy="1749.5" rx="95" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="1058.7" y="1742" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Bekijk gegevensgebruik</text><text x="1058.7" y="1757" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">in het kader van de AVG</text><line x1="1460.9" y1="695" x2="1368.7" y2="701" stroke="#475569" stroke-width="1.3" marker-end="url(#d3-driehoek)"/><line x1="1399.7" y1="989.8" x2="1335.8" y2="1008.1" stroke="#475569" stroke-width="1.3" marker-end="url(#d3-driehoek)"/><line x1="1396.2" y1="1045.3" x2="1335.8" y2="1039.2" stroke="#475569" stroke-width="1.3" marker-end="url(#d3-driehoek)"/><line x1="834.5" y1="1043.6" x2="1175.8" y2="1033.3" stroke="#475569" stroke-width="1.3"/><line x1="1841" y1="1019.9" x2="1841" y2="809.4" stroke="#475569" stroke-width="1.3" marker-end="url(#d3-driehoek)"/><line x1="1841" y1="1113" x2="1841" y2="809.4" stroke="#475569" stroke-width="1.3" marker-end="url(#d3-driehoek)"/><line x1="1632.4" y1="613.9" x2="1806" y2="624.9" stroke="#475569" stroke-width="1.3"/><line x1="1620.9" y1="706.3" x2="1806" y2="744.3" stroke="#475569" stroke-width="1.3"/><line x1="1632.4" y1="769.2" x2="1806" y2="754.4" stroke="#475569" stroke-width="1.3"/><line x1="1193.7" y1="1145.6" x2="1806" y2="1169.6" stroke="#475569" stroke-width="1.3"/><line x1="1586.2" y1="1061.3" x2="1806" y2="1075.6" stroke="#475569" stroke-width="1.3"/><line x1="628" y1="974.7" x2="764.5" y2="1030.3" stroke="#475569" stroke-width="1.3" marker-end="url(#d3-driehoek)"/><line x1="834.5" y1="1019.7" x2="1228.8" y2="739.2" stroke="#475569" stroke-width="1.3"/><line x1="834.5" y1="1102.4" x2="1046.6" y2="1452.8" stroke="#475569" stroke-width="1.3"/><line x1="834.5" y1="1003.1" x2="1190.3" y2="580.6" stroke="#475569" stroke-width="1.3"/><line x1="628" y1="1056.1" x2="764.5" y2="1046.9" stroke="#475569" stroke-width="1.3" marker-end="url(#d3-driehoek)"/><line x1="834.5" y1="1066.8" x2="1044.3" y2="1199.7" stroke="#475569" stroke-width="1.3"/><line x1="834.5" y1="1056" x2="1003.7" y2="1111" stroke="#475569" stroke-width="1.3"/><line x1="1262.3" y1="675.2" x2="1228.6" y2="580.6" stroke="#475569" stroke-width="1.3" stroke-dasharray="4 3" marker-end="url(#d3-pijl-open)"/><text x="1245.5" y="621.9" text-anchor="middle" font-size="10" font-weight="normal" fill="#475569" dominant-baseline="middle">«include»</text><line x1="628" y1="1137.5" x2="764.5" y2="1063.6" stroke="#475569" stroke-width="1.3" marker-end="url(#d3-driehoek)"/><line x1="1381" y1="1210.1" x2="1189.7" y2="1224.6" stroke="#475569" stroke-width="1.3" stroke-dasharray="4 3" marker-end="url(#d3-pijl-open)"/><text x="1285.4" y="1211.3" text-anchor="middle" font-size="10" font-weight="normal" fill="#475569" dominant-baseline="middle">«extend»</text><line x1="1381" y1="1187.6" x2="1193.7" y2="1157.3" stroke="#475569" stroke-width="1.3" stroke-dasharray="4 3" marker-end="url(#d3-pijl-open)"/><text x="1287.4" y="1166.4" text-anchor="middle" font-size="10" font-weight="normal" fill="#475569" dominant-baseline="middle">«extend»</text><line x1="1100.4" y1="992" x2="1099.1" y2="1109.9" stroke="#475569" stroke-width="1.3" stroke-dasharray="4 3" marker-end="url(#d3-pijl-open)"/><text x="1099.7" y="1045" text-anchor="middle" font-size="10" font-weight="normal" fill="#475569" dominant-baseline="middle">«extend»</text><line x1="1442.4" y1="752" x2="1368.7" y2="732.4" stroke="#475569" stroke-width="1.3" marker-end="url(#d3-driehoek)"/><text x="1405.6" y="736.2" text-anchor="middle" font-size="10" font-weight="normal" fill="#475569" dominant-baseline="middle">gespreksvorm</text><line x1="1452.5" y1="639.8" x2="1358.7" y2="675.2" stroke="#475569" stroke-width="1.3" marker-end="url(#d3-driehoek)"/><text x="1405.6" y="651.5" text-anchor="middle" font-size="10" font-weight="normal" fill="#475569" dominant-baseline="middle">gespreksvorm</text><line x1="1240.9" y1="1484.8" x2="1160.9" y2="1484.8" stroke="#475569" stroke-width="1.3" marker-end="url(#d3-driehoek)"/><line x1="1240.9" y1="1427.7" x2="1160.9" y2="1453.8" stroke="#475569" stroke-width="1.3" marker-end="url(#d3-driehoek)"/><line x1="1240.9" y1="1541.8" x2="1160.9" y2="1515.7" stroke="#475569" stroke-width="1.3" marker-end="url(#d3-driehoek)"/><line x1="1841" y1="685.2" x2="1841" y2="693.4" stroke="#475569" stroke-width="1.3" marker-end="url(#d3-driehoek)"/><line x1="820.8" y1="1102.6" x2="1046.9" y2="1717.5" stroke="#475569" stroke-width="1.3"/><line x1="824.6" y1="986.6" x2="1051.3" y2="461.8" stroke="#475569" stroke-width="1.3"/><line x1="1098.6" y1="928" x2="1067.3" y2="461.8" stroke="#475569" stroke-width="1.3" stroke-dasharray="4 3" marker-end="url(#d3-pijl-open)"/><text x="1083" y="688.9" text-anchor="middle" font-size="10" font-weight="normal" fill="#475569" dominant-baseline="middle">«extend»</text></svg>

*UC Klant*

#### Bekijk gegevensgebruik in het kader van de AVG

De klant bekijkt welke persoonsgegevens worden gebruikt, voor welk doel en op welke grondslag.

| | |
|---|---|
| Actoren | Klant |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

#### Bekijk voortgang

Optionele functionaliteit voor een bestaand verzoek of een bestaande melding.

| | |
|---|---|
| Actoren |  |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

#### Bel op

| | |
|---|---|
| Actoren | KCC-medewerker |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

#### Dien melding in

De klant meldt een probleem, gebeurtenis of situatie.

| | |
|---|---|
| Actoren | Klant |
| Bevat (include) |  |
| Uitgebreid door (extend) | Bekijk voortgang |

#### Lever informatie aan

| | |
|---|---|
| Actoren |  |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

#### Maak een afspraak

De klant plant een afspraak wanneer dit nodig of gewenst is.

| | |
|---|---|
| Actoren |  |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

#### Stel een vraag

| | |
|---|---|
| Actoren | Klant |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

#### Voer betaling uit

| | |
|---|---|
| Actoren |  |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

#### Voer chatgesprek

| | |
|---|---|
| Actoren | Geautomatiseerde medewerker |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

#### Voer gesprek

Een gesprek kan plaatsvinden via chat, contactformulier, telefoon of e-mail.

| | |
|---|---|
| Actoren | Klant |
| Bevat (include) | Stel een vraag |
| Uitgebreid door (extend) |  |

#### Voer taak uit

Algemene use case voor taken die de klant in het kader van een dienst uitvoert.

| | |
|---|---|
| Actoren | Klant |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

#### Voer telefoongesprek

| | |
|---|---|
| Actoren | Medewerker Gemeente |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

#### Vraag gesprek aan

| | |
|---|---|
| Actoren | Klant |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

#### Vraag product/dienst aan

De klant dient een verzoek in voor een product, dienst of handeling van de gemeente.

De verdere behandeling gebeurt door een medewerker.

| | |
|---|---|
| Actoren | Zaakbehandelaar, Klant |
| Bevat (include) |  |
| Uitgebreid door (extend) | Bekijk voortgang, Maak een afspraak |

#### Vul contactformulier in

| | |
|---|---|
| Actoren |  |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

#### Vul formulier in

| | |
|---|---|
| Actoren |  |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

#### Wissel e-mail uit

| | |
|---|---|
| Actoren | Medewerker Gemeente |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

#### Zoek informatie over producten en diensten

| | |
|---|---|
| Actoren | Klant |
| Bevat (include) |  |
| Uitgebreid door (extend) | Maak een afspraak |

#### UC0100 Vraag product/dienst aan

<svg xmlns="http://www.w3.org/2000/svg" viewBox="317.5 399.3 735.4 236.2" width="735.4" height="236.2" font-family="system-ui, Segoe UI, sans-serif" role="img"><defs><marker id="d4-pijl-open" markerWidth="12" markerHeight="10" refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M 1 1 L 10 5 L 1 9" fill="none" stroke="#475569" stroke-width="1.2"/></marker></defs><rect x="788.9" y="423.3" width="240" height="160" rx="8" fill="none" stroke="#94a3b8" stroke-width="1.5"/><text x="798.9" y="437.3" text-anchor="start" font-size="11" font-weight="700" fill="#475569" dominant-baseline="middle">Zaakbehandelaar</text><rect x="341.5" y="423.8" width="240" height="160" rx="8" fill="none" stroke="#94a3b8" stroke-width="1.5"/><text x="351.5" y="437.8" text-anchor="start" font-size="11" font-weight="700" fill="#475569" dominant-baseline="middle">Klant</text><rect x="564.2" y="426.3" width="240" height="160" rx="8" fill="none" stroke="#94a3b8" stroke-width="1.5"/><text x="574.2" y="440.3" text-anchor="start" font-size="11" font-weight="700" fill="#475569" dominant-baseline="middle">Gegevensvoorziening</text><circle cx="443.3" cy="486.5" r="16" fill="none" stroke="#0f172a" stroke-width="2"/><rect x="372.3" y="555.6" width="100" height="56" rx="14" fill="#dbeafe" stroke="#475569" stroke-width="1.2"/><text x="422.3" y="568.6" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Vul</text><text x="422.3" y="583.6" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">formuliertje</text><text x="422.3" y="598.6" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">in</text><line x1="436.4" y1="526.5" x2="429.2" y2="555.6" stroke="#475569" stroke-width="1.3" marker-end="url(#d4-pijl-open)"/></svg>

*AD Vraag product/dienst aan*

##### Vraag product/dienst aan

De klant dient een verzoek in voor een product, dienst of handeling van de gemeente.

De verdere behandeling gebeurt door een medewerker.

### Dienstverlening gemeente

<svg xmlns="http://www.w3.org/2000/svg" viewBox="251 286 673 378" width="673" height="378" font-family="system-ui, Segoe UI, sans-serif" role="img"><defs><marker id="d5-driehoek" markerWidth="14" markerHeight="14" refX="13" refY="7" orient="auto" markerUnits="userSpaceOnUse"><path d="M 1 1 L 13 7 L 1 13 Z" fill="#ffffff" stroke="#475569" stroke-width="1.2"/></marker></defs><rect x="376" y="310" width="524" height="330" rx="8" fill="none" stroke="#94a3b8" stroke-width="1.5"/><text x="386" y="324" text-anchor="start" font-size="11" font-weight="700" fill="#475569" dominant-baseline="middle">Dienstverlening gemeente</text><ellipse cx="511" cy="386.2" rx="80" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="511" y="378.7" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Voer ambtshalve</text><text x="511" y="393.7" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">activiteit uit</text><ellipse cx="786.6" cy="388" rx="80" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="786.6" y="388" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Voer handhaving uit</text><circle cx="310" cy="449.5" r="10" fill="none" stroke="#475569" stroke-width="1.4"/><path d="M 310 459.5 V 487.1 M 289 467.5 H 331 M 310 487.1 L 290.4 514.7 M 310 487.1 L 329.6 514.7" fill="none" stroke="#475569" stroke-width="1.4" stroke-linecap="round"/><text x="310" y="530.6" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">Medewerker</text><text x="310" y="544.4" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">Gemeente</text><ellipse cx="512.5" cy="481" rx="80" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="512.5" y="473.5" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Verleen pro-actieve</text><text x="512.5" y="488.5" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">dienst</text><ellipse cx="524.5" cy="583" rx="80" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="524.5" y="583" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Beheer content</text><line x1="706.6" y1="387.5" x2="591" y2="386.7" stroke="#475569" stroke-width="1.3" marker-end="url(#d5-driehoek)"/><line x1="451.1" y1="418.2" x2="345" y2="474.8" stroke="#475569" stroke-width="1.3"/><line x1="345" y1="491.3" x2="432.5" y2="485.9" stroke="#475569" stroke-width="1.3"/><line x1="345" y1="508.1" x2="447.8" y2="551" stroke="#475569" stroke-width="1.3"/></svg>

*UC gemeente*

#### Beheer content

| | |
|---|---|
| Actoren | Medewerker Gemeente |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

#### Verleen pro-actieve dienst

| | |
|---|---|
| Actoren | Medewerker Gemeente |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

#### Voer ambtshalve activiteit uit

| | |
|---|---|
| Actoren | Medewerker Gemeente |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

#### Voer handhaving uit

| | |
|---|---|
| Actoren |  |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

### Beheer gemeente

<svg xmlns="http://www.w3.org/2000/svg" viewBox="280.2 245 684.8 400" width="684.8" height="400" font-family="system-ui, Segoe UI, sans-serif" role="img"><defs><marker id="d6-pijl-open" markerWidth="12" markerHeight="10" refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M 1 1 L 10 5 L 1 9" fill="none" stroke="#475569" stroke-width="1.2"/></marker></defs><rect x="408" y="269" width="533" height="352" rx="8" fill="none" stroke="#94a3b8" stroke-width="1.5"/><text x="418" y="283" text-anchor="start" font-size="11" font-weight="700" fill="#475569" dominant-baseline="middle">Beheer gemeente</text><ellipse cx="555.3" cy="359.5" rx="80" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="555.3" y="359.5" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Beheer koppelingen</text><ellipse cx="788.3" cy="359.5" rx="80" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="788.3" y="359.5" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Vernieuw certificaat</text><circle cx="339.2" cy="424.7" r="10" fill="none" stroke="#475569" stroke-width="1.4"/><path d="M 339.2 434.7 V 462.3 M 318.2 442.7 H 360.2 M 339.2 462.3 L 319.6 489.9 M 339.2 462.3 L 358.8 489.9" fill="none" stroke="#475569" stroke-width="1.4" stroke-linecap="round"/><text x="339.2" y="505.9" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">Beheerder</text><text x="339.2" y="519.6" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">Gemeente</text><ellipse cx="788.3" cy="453" rx="80" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="788.3" y="453" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Test koppeling</text><ellipse cx="555.3" cy="455" rx="80" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="555.3" y="455" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Beheer registers</text><ellipse cx="555.3" cy="550.5" rx="80" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="555.3" y="550.5" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Maak issue aan</text><line x1="635.3" y1="359.5" x2="708.3" y2="359.5" stroke="#475569" stroke-width="1.3" stroke-dasharray="4 3" marker-end="url(#d6-pijl-open)"/><text x="671.8" y="353.5" text-anchor="middle" font-size="10" font-weight="normal" fill="#475569" dominant-baseline="middle">«include»</text><line x1="635" y1="391.5" x2="708.5" y2="421" stroke="#475569" stroke-width="1.3" stroke-dasharray="4 3" marker-end="url(#d6-pijl-open)"/><text x="671.8" y="400.3" text-anchor="middle" font-size="10" font-weight="normal" fill="#475569" dominant-baseline="middle">«include»</text><line x1="492" y1="391.5" x2="374.2" y2="451.1" stroke="#475569" stroke-width="1.3"/><line x1="475.3" y1="460.1" x2="374.2" y2="466.5" stroke="#475569" stroke-width="1.3"/><line x1="475.3" y1="520.3" x2="374.2" y2="482" stroke="#475569" stroke-width="1.3"/></svg>

*UC beheer gemeente*

#### Beheer koppelingen

| | |
|---|---|
| Actoren | Beheerder Gemeente |
| Bevat (include) | Vernieuw certificaat, Test koppeling |
| Uitgebreid door (extend) |  |

#### Beheer registers

| | |
|---|---|
| Actoren | Beheerder Gemeente |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

#### Maak issue aan

| | |
|---|---|
| Actoren | Beheerder Gemeente |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

#### Test koppeling

| | |
|---|---|
| Actoren |  |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

#### Vernieuw certificaat

| | |
|---|---|
| Actoren |  |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

### Service organisatie

<svg xmlns="http://www.w3.org/2000/svg" viewBox="140.4 209 724.6 457" width="724.6" height="457" font-family="system-ui, Segoe UI, sans-serif" role="img"><defs><marker id="d7-driehoek" markerWidth="14" markerHeight="14" refX="13" refY="7" orient="auto" markerUnits="userSpaceOnUse"><path d="M 1 1 L 13 7 L 1 13 Z" fill="#ffffff" stroke="#475569" stroke-width="1.2"/></marker></defs><rect x="290" y="233" width="551" height="409" rx="8" fill="none" stroke="#94a3b8" stroke-width="1.5"/><text x="300" y="247" text-anchor="start" font-size="11" font-weight="700" fill="#475569" dominant-baseline="middle">Beheer (serviceorganisatie)</text><ellipse cx="586.1" cy="309.1" rx="80" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="586.1" y="309.1" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Behandel issue</text><circle cx="199.4" cy="389.3" r="10" fill="none" stroke="#475569" stroke-width="1.4"/><path d="M 199.4 399.3 V 426.9 M 178.4 407.3 H 220.4 M 199.4 426.9 L 179.8 454.5 M 199.4 426.9 L 219 454.5" fill="none" stroke="#475569" stroke-width="1.4" stroke-linecap="round"/><text x="199.4" y="470.4" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">Medewerker</text><text x="199.4" y="484.2" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">Service-organisatie</text><ellipse cx="576.6" cy="417.2" rx="80" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="576.6" y="409.7" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Zet issue door (na</text><text x="576.6" y="424.7" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">triage)</text><ellipse cx="398" cy="568.2" rx="80" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="398" y="553.2" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Zet issue door naar</text><text x="398" y="568.2" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">ketenpartner (bijv.</text><text x="398" y="583.2" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">leverancier)</text><ellipse cx="700.7" cy="572.7" rx="80" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="700.7" y="565.2" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Zet issue door naar</text><text x="700.7" y="580.2" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">collega</text><line x1="675.2" y1="540.7" x2="602.1" y2="449.2" stroke="#475569" stroke-width="1.3" marker-end="url(#d7-driehoek)"/><line x1="435.9" y1="536.2" x2="538.7" y2="449.2" stroke="#475569" stroke-width="1.3" marker-end="url(#d7-driehoek)"/><line x1="506.1" y1="334.8" x2="234.4" y2="422.1" stroke="#475569" stroke-width="1.3"/><line x1="496.6" y1="420.7" x2="234.4" y2="431.8" stroke="#475569" stroke-width="1.3"/></svg>

*UC service-organisatie*

#### Behandel issue

| | |
|---|---|
| Actoren | Medewerker Service-organisatie |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

#### Zet issue door (na triage)

| | |
|---|---|
| Actoren | Medewerker Service-organisatie |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

#### Zet issue door naar collega

| | |
|---|---|
| Actoren |  |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

#### Zet issue door naar ketenpartner (bijv. leverancier)

| | |
|---|---|
| Actoren |  |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

### Informatiebeheer

<svg xmlns="http://www.w3.org/2000/svg" viewBox="249.1 224 569.4 474.5" width="569.4" height="474.5" font-family="system-ui, Segoe UI, sans-serif" role="img"><rect x="371" y="248" width="312" height="408" rx="8" fill="none" stroke="#94a3b8" stroke-width="1.5"/><text x="381" y="262" text-anchor="start" font-size="11" font-weight="700" fill="#475569" dominant-baseline="middle">Informatiebeheer</text><ellipse cx="537.9" cy="323" rx="80" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="537.9" y="315.5" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Beheer</text><text x="537.9" y="330.5" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">informatietype</text><ellipse cx="541.9" cy="415.7" rx="80" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="541.9" y="415.7" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Beheer informatie</text><circle cx="308.1" cy="440.9" r="10" fill="none" stroke="#475569" stroke-width="1.4"/><path d="M 308.1 450.9 V 478.5 M 287.1 458.9 H 329.1 M 308.1 478.5 L 288.5 506.1 M 308.1 478.5 L 327.7 506.1" fill="none" stroke="#475569" stroke-width="1.4" stroke-linecap="round"/><text x="308.1" y="528.9" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">Informatiebeheerder</text><circle cx="759.5" cy="487.5" r="10" fill="none" stroke="#475569" stroke-width="1.4"/><path d="M 759.5 497.5 V 525.1 M 738.5 505.5 H 780.5 M 759.5 525.1 L 739.9 552.7 M 759.5 525.1 L 779.1 552.7" fill="none" stroke="#475569" stroke-width="1.4" stroke-linecap="round"/><text x="759.5" y="575.5" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">VNG</text><ellipse cx="541.9" cy="508.3" rx="80" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="541.9" y="508.3" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Vernietig informatie</text><circle cx="758.1" cy="578.5" r="10" fill="none" stroke="#475569" stroke-width="1.4"/><path d="M 758.1 588.5 V 616.1 M 737.1 596.5 H 779.1 M 758.1 616.1 L 738.5 643.7 M 758.1 616.1 L 777.7 643.7" fill="none" stroke="#475569" stroke-width="1.4" stroke-linecap="round"/><text x="758.1" y="666.5" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">E-depot</text><ellipse cx="538.9" cy="601" rx="80" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="538.9" y="593.5" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Draag informatie</text><text x="538.9" y="608.5" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">over</text><line x1="343.1" y1="460.2" x2="492.5" y2="355" stroke="#475569" stroke-width="1.3"/><line x1="343.1" y1="474.5" x2="461.9" y2="439.3" stroke="#475569" stroke-width="1.3"/><line x1="343.1" y1="488.4" x2="461.9" y2="500.3" stroke="#475569" stroke-width="1.3"/><line x1="621.9" y1="516.8" x2="724.5" y2="527.8" stroke="#475569" stroke-width="1.3"/><text x="673.2" y="516.3" text-anchor="middle" font-size="10" font-weight="normal" fill="#475569" dominant-baseline="middle">selectielijsten</text><line x1="618.9" y1="608.8" x2="723.1" y2="619" stroke="#475569" stroke-width="1.3"/><line x1="343.1" y1="502.5" x2="475.3" y2="569" stroke="#475569" stroke-width="1.3"/></svg>

*UC Informatiebeheer*

#### Beheer informatie

| | |
|---|---|
| Actoren | Informatiebeheerder |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

#### Beheer informatietype

| | |
|---|---|
| Actoren | Informatiebeheerder |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

#### Draag informatie over

| | |
|---|---|
| Actoren | E-depot, Informatiebeheerder |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

#### Vernietig informatie

| | |
|---|---|
| Actoren | Informatiebeheerder, VNG |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

### Gegevensvoorziening

<svg xmlns="http://www.w3.org/2000/svg" viewBox="107 215 585.4 381" width="585.4" height="381" font-family="system-ui, Segoe UI, sans-serif" role="img"><rect x="266.4" y="239" width="402" height="333" rx="8" fill="none" stroke="#94a3b8" stroke-width="1.5"/><text x="276.4" y="253" text-anchor="start" font-size="11" font-weight="700" fill="#475569" dominant-baseline="middle">Gegevensvoorziening</text><ellipse cx="439.4" cy="317.2" rx="80" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="439.4" y="309.7" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Sluit gemeente aan</text><text x="439.4" y="324.7" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">(onboarding)</text><circle cx="166" cy="374.6" r="10" fill="none" stroke="#475569" stroke-width="1.4"/><path d="M 166 384.6 V 412.2 M 145 392.6 H 187 M 166 412.2 L 146.4 439.8 M 166 412.2 L 185.6 439.8" fill="none" stroke="#475569" stroke-width="1.4" stroke-linecap="round"/><text x="166" y="455.7" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">Beheerder</text><text x="166" y="469.5" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a" dominant-baseline="middle">Service-organisatie</text><ellipse cx="450.9" cy="412.4" rx="80" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="450.9" y="404.9" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Beheer</text><text x="450.9" y="419.9" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">gegevensvoorziening</text><ellipse cx="472.4" cy="505.1" rx="80" ry="32" fill="#e0f2fe" stroke="#475569" stroke-width="1.2"/><text x="472.4" y="505.1" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a" dominant-baseline="middle">Richt koppeling in</text><line x1="359.4" y1="346.9" x2="201" y2="405.6" stroke="#475569" stroke-width="1.3"/><line x1="370.9" y1="414.2" x2="201" y2="417.9" stroke="#475569" stroke-width="1.3"/><line x1="392.4" y1="482.5" x2="201" y2="428.5" stroke="#475569" stroke-width="1.3"/></svg>

*UC Beheer Service-organisatie*

#### Beheer gegevensvoorziening

| | |
|---|---|
| Actoren | Beheerder Service-organisatie |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

#### Richt koppeling in

| | |
|---|---|
| Actoren | Beheerder Service-organisatie |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

#### Sluit gemeente aan (onboarding)

| | |
|---|---|
| Actoren | Beheerder Service-organisatie |
| Bevat (include) |  |
| Uitgebreid door (extend) |  |

## Systeemcontexten en kaders

## Relaties

