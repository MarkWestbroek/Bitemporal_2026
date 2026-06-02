/**
 * canoniekModdle.js — moddle-extensiedescriptor voor het `canoniek`-namespace.
 *
 * Hiermee kan bpmn-js de binding tussen een BPMN message/signal-event en een
 * Berichttype (projectie over het canoniek model) lezen én schrijven als
 * geldige BPMN `extensionElements`. Analoog aan hoe Camunda/Operaton het
 * `camunda:`-namespace gebruikt.
 *
 * Stap 4 van de "driehoek proces – regels – data".
 * Zie process_engine_v01/docs/driehoek-proces-regels-data.md (§4.3, §5).
 *
 * Resulterende XML op een event:
 *   <bpmn:extensionElements>
 *     <canoniek:berichttype naam="InwonerAanmelding">
 *       <canoniek:fieldRef typenaam="NP_Naam_Data" veldpad="..." t="formeel" .../>
 *     </canoniek:berichttype>
 *   </bpmn:extensionElements>
 */

export const CANONIEK_URI = "https://canoniek-register/bpmn/extensies";
export const CANONIEK_PREFIX = "canoniek";

export const canoniekModdleDescriptor = {
  name: "Canoniek",
  uri: CANONIEK_URI,
  prefix: CANONIEK_PREFIX,
  xml: { tagAlias: "lowerCase" },
  types: [
    {
      name: "Berichttype",
      superClass: ["Element"],
      properties: [
        { name: "naam", isAttr: true, type: "String" },
        { name: "beschrijving", isAttr: true, type: "String" },
        { name: "velden", type: "FieldRef", isMany: true },
      ],
    },
    {
      name: "FieldRef",
      superClass: ["Element"],
      properties: [
        { name: "typenaam", isAttr: true, type: "String" },
        { name: "veldpad", isAttr: true, type: "String" },
        { name: "veldnaam", isAttr: true, type: "String" },
        { name: "type", isAttr: true, type: "String" },
        { name: "format", isAttr: true, type: "String" },
        { name: "datatype", isAttr: true, type: "String" },
        { name: "t", isAttr: true, type: "String" },
        { name: "afgeleid", isAttr: true, type: "Boolean" },
        { name: "verplicht", isAttr: true, type: "Boolean" },
      ],
    },
    {
      // Procescontract: input- en output-berichttype van een proces of
      // CallActivity. Geneste berichttypen hangen onder rolnaam-attributen
      // "kant" = "input" | "output", zodat ze in één extensionElements passen.
      name: "Procescontract",
      superClass: ["Element"],
      properties: [
        { name: "berichten", type: "ContractBericht", isMany: true },
      ],
    },
    {
      name: "ContractBericht",
      superClass: ["Berichttype"],
      properties: [
        { name: "kant", isAttr: true, type: "String" },
      ],
    },
  ],
};
