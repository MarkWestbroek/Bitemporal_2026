import { createContext, useContext } from "react";

/**
 * AiContext — mag AI op deze pagina? Standaard ja (inhoud, Studio, ingelogde formulieren).
 * Het openbare aanmeldformulier zet hem uit: ingevulde tekst van een onbekende invuller naar
 * een AI-dienst sturen is een gegevensverwerking (AVG) die daar niet thuishoort.
 */
export const AiToegestaan = createContext(true);
export const useAiToegestaan = () => useContext(AiToegestaan);
