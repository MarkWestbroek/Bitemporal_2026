/**
 * StudioGebruiker — ingelogde gebruiker en "Uitloggen", rechts in de menubalk van de Studio.
 * Klik op de naam opent de activiteit Gebruikers (eigen wachtwoord wijzigen). Na het uitloggen
 * toont AuthBeschermd (App.jsx) vanzelf het inlogscherm. Toont niets als auth uit staat.
 * Zelfde gegevens als GebruikerBadge (inhoud-editor, publicatie), in de stijl van de Studio.
 */
import React from "react";
import { useAuth } from "../context/AuthContext";
import useStudioStore from "./useStudioStore";

export default function StudioGebruiker() {
  const { authEnabled, ingelogd, gebruiker, logout } = useAuth();
  const setActief = useStudioStore((s) => s.setActief);
  if (!authEnabled || !ingelogd || !gebruiker) return null;
  return (
    <span className="studio-menubar__gebruiker">
      <button type="button" onClick={() => setActief("gebruikers")} title="Mijn account — wachtwoord wijzigen">
        {gebruiker.gebruikersnaam}
        <span className="studio-menubar__gebruiker-rol">{gebruiker.rol}</span>
      </button>
      <button type="button" onClick={logout} title="Uitloggen">Uitloggen</button>
    </span>
  );
}
