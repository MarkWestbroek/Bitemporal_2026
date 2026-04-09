# Chat: Document review and comparison analysis request

- **Datum**: 2026-04-09 11:55
- **Sessie-ID**: `6a96139b-05e4-4a99-9d21-c2b62bf76aba`
- **Berichten**: 2

---

## 🧑 User

kun je dt document lezen en afzetten tegen de bitemporele principes en type API in dit project? Wil je vastleggen in een verschilanalyse.md in dezelfde map als het document?

---

## 🤖 Assistant

Now let me get the full beginning of the document and the remaining content: Now I have a thorough understanding of the document. Let me also quickly gather key details about the v06 bitemporal approach to ensure the analysis is accurate: Now I have all the information needed. Let me create the verschilanalyse document. De verschilanalyse staat in docs/extern/verschilanalyse.md, naast het brondocument.

**Kernpunten uit de analyse:**

**Waar v06 sterker is:**
- Consequente bitemporaliteit (altijd twee tijdsdimensies, niet optioneel)
- Formele tijd buiten de datatabellen (onbreekbare audit trail via registratie → wijziging)
- Granulaire correcties (inhoud, aanvang en einde onafhankelijk versioneerbaar)
- Registratie als atomaire eenheid (meerdere samenhangende wijzigingen in één transactie)
- Schema-gedreven architectuur (MetaRegistry drijft alles dynamisch)

**Waar RA-CG breder is:**
- Productie-readiness (RBAC/PBAC, OTEL, Keycloak, Haven+)
- Data-ecosysteem (Open Notificaties, bulk, migratie, datakwaliteitsplatform)
- AVG/archivering (bewaartermijnen, doelbinding, persoonsgegevens)
- Uitgebreide zoek/filterfunctionaliteit
- Interoperabiliteit (StUF, BRP, iWMO)

De analyse bevat ook een terminologie-mapping tussen beide werelden.

---
