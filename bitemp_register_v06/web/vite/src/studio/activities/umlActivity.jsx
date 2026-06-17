/**
 * umlActivity — de bestaande UML-model-IDE als activiteit in de werkbank.
 *
 * De UML-IDE (IdePage) brengt zijn eigen docking-layout, project-browser en
 * eigenschappen-paneel mee (FlexLayout). Daarom is dit een `fullMain`-activiteit:
 * de shell toont alleen de activity bar en geeft IdePage de volledige ruimte.
 *
 * Hier komt later ook DMN-modellering bij (zie dmnActivity voor de tabellen).
 */
import React, { lazy } from "react";
import { IconUML } from "../icons";

const IdePage = lazy(() => import("../../pages/IdePage"));

function UmlMain() {
  return <IdePage embedded />;
}

export default {
  id: "uml",
  label: "UML-model",
  icon: <IconUML />,
  groep: "modelleren",
  fullMain: true,
  Main: UmlMain,
};
