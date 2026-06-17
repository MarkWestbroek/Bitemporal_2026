/**
 * starterDmn.js — Voorbeeld DMN 1.3 XML met een DRD (Decision Requirements Diagram).
 *
 * Bevat twee decisions:
 *   1. "Bepaal categorie" — op basis van leeftijd en inkomen
 *   2. "Bepaal korting" — op basis van de categorie (chained decision)
 *
 * Deze XML wordt gebruikt als initiële inhoud voor de dmn-js Modeler.
 */

export const STARTER_DMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
             xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/"
             xmlns:dc="http://www.omg.org/spec/DMN/20180521/DC/"
             id="Definitions_1"
             name="Voorbeeld DRD"
             namespace="http://camunda.org/schema/1.0/dmn">
  
  <!-- Input data: leeftijd -->
  <inputData id="InputData_leeftijd" name="Leeftijd">
    <variable id="var_leeftijd" name="Leeftijd" typeRef="integer"/>
  </inputData>
  
  <!-- Input data: inkomen -->
  <inputData id="InputData_inkomen" name="Inkomen">
    <variable id="var_inkomen" name="Inkomen" typeRef="double"/>
  </inputData>
  
  <!-- Decision: Bepaal categorie -->
  <decision id="Decision_categorie" name="Bepaal categorie">
    <variable id="var_categorie" name="Categorie" typeRef="string"/>
    <informationRequirement id="ir_leeftijd">
      <requiredInput href="#InputData_leeftijd"/>
    </informationRequirement>
    <informationRequirement id="ir_inkomen">
      <requiredInput href="#InputData_inkomen"/>
    </informationRequirement>
    <decisionTable id="dt_categorie" hitPolicy="UNIQUE">
      <input id="input_leeftijd" label="Leeftijd">
        <inputExpression id="ie_leeftijd" typeRef="integer">
          <text>Leeftijd</text>
        </inputExpression>
      </input>
      <input id="input_inkomen" label="Inkomen">
        <inputExpression id="ie_inkomen" typeRef="double">
          <text>Inkomen</text>
        </inputExpression>
      </input>
      <output id="output_categorie" label="Categorie" typeRef="string"/>
      <rule id="rule_1">
        <inputEntry id="ie_1_1">
          <text>&lt; 18</text>
        </inputEntry>
        <inputEntry id="ie_1_2">
          <text></text>
        </inputEntry>
        <outputEntry id="oe_1">
          <text>"Jeugd"</text>
        </outputEntry>
      </rule>
      <rule id="rule_2">
        <inputEntry id="ie_2_1">
          <text>[18..65]</text>
        </inputEntry>
        <inputEntry id="ie_2_2">
          <text>&lt; 30000</text>
        </inputEntry>
        <outputEntry id="oe_2">
          <text>"Laag inkomen"</text>
        </outputEntry>
      </rule>
      <rule id="rule_3">
        <inputEntry id="ie_3_1">
          <text>[18..65]</text>
        </inputEntry>
        <inputEntry id="ie_3_2">
          <text>&gt;= 30000</text>
        </inputEntry>
        <outputEntry id="oe_3">
          <text>"Standaard"</text>
        </outputEntry>
      </rule>
      <rule id="rule_4">
        <inputEntry id="ie_4_1">
          <text>&gt; 65</text>
        </inputEntry>
        <inputEntry id="ie_4_2">
          <text></text>
        </inputEntry>
        <outputEntry id="oe_4">
          <text>"Senior"</text>
        </outputEntry>
      </rule>
    </decisionTable>
  </decision>
  
  <!-- Decision: Bepaal korting -->
  <decision id="Decision_korting" name="Bepaal korting">
    <variable id="var_korting" name="Korting" typeRef="double"/>
    <informationRequirement id="ir_categorie">
      <requiredDecision href="#Decision_categorie"/>
    </informationRequirement>
    <decisionTable id="dt_korting" hitPolicy="FIRST">
      <input id="input_categorie" label="Categorie">
        <inputExpression id="ie_categorie" typeRef="string">
          <text>Categorie</text>
        </inputExpression>
      </input>
      <output id="output_korting" label="Korting (%)" typeRef="double"/>
      <rule id="rule_k1">
        <inputEntry id="ie_k1_1">
          <text>"Jeugd"</text>
        </inputEntry>
        <outputEntry id="oe_k1">
          <text>20</text>
        </outputEntry>
      </rule>
      <rule id="rule_k2">
        <inputEntry id="ie_k2_1">
          <text>"Laag inkomen"</text>
        </inputEntry>
        <outputEntry id="oe_k2">
          <text>15</text>
        </outputEntry>
      </rule>
      <rule id="rule_k3">
        <inputEntry id="ie_k3_1">
          <text>"Senior"</text>
        </inputEntry>
        <outputEntry id="oe_k3">
          <text>10</text>
        </outputEntry>
      </rule>
      <rule id="rule_k4">
        <inputEntry id="ie_k4_1">
          <text></text>
        </inputEntry>
        <outputEntry id="oe_k4">
          <text>0</text>
        </outputEntry>
      </rule>
    </decisionTable>
  </decision>
  
  <!-- DMN Diagram (DI) -->
  <dmndi:DMNDI>
    <dmndi:DMNDiagram id="DMNDiagram_1">
      <!-- Input: Leeftijd -->
      <dmndi:DMNShape id="DMNShape_leeftijd" dmnElementRef="InputData_leeftijd">
        <dc:Bounds x="160" y="320" width="180" height="80"/>
      </dmndi:DMNShape>
      
      <!-- Input: Inkomen -->
      <dmndi:DMNShape id="DMNShape_inkomen" dmnElementRef="InputData_inkomen">
        <dc:Bounds x="460" y="320" width="180" height="80"/>
      </dmndi:DMNShape>
      
      <!-- Decision: Categorie -->
      <dmndi:DMNShape id="DMNShape_categorie" dmnElementRef="Decision_categorie">
        <dc:Bounds x="310" y="180" width="180" height="80"/>
      </dmndi:DMNShape>
      
      <!-- Decision: Korting -->
      <dmndi:DMNShape id="DMNShape_korting" dmnElementRef="Decision_korting">
        <dc:Bounds x="310" y="40" width="180" height="80"/>
      </dmndi:DMNShape>
      
      <!-- Edge: Leeftijd -> Categorie -->
      <dmndi:DMNEdge id="DMNEdge_ir_leeftijd" dmnElementRef="ir_leeftijd">
        <di:waypoint xmlns:di="http://www.omg.org/spec/DMN/20180521/DI/" x="250" y="320"/>
        <di:waypoint xmlns:di="http://www.omg.org/spec/DMN/20180521/DI/" x="360" y="260"/>
      </dmndi:DMNEdge>
      
      <!-- Edge: Inkomen -> Categorie -->
      <dmndi:DMNEdge id="DMNEdge_ir_inkomen" dmnElementRef="ir_inkomen">
        <di:waypoint xmlns:di="http://www.omg.org/spec/DMN/20180521/DI/" x="550" y="320"/>
        <di:waypoint xmlns:di="http://www.omg.org/spec/DMN/20180521/DI/" x="440" y="260"/>
      </dmndi:DMNEdge>
      
      <!-- Edge: Categorie -> Korting -->
      <dmndi:DMNEdge id="DMNEdge_ir_categorie" dmnElementRef="ir_categorie">
        <di:waypoint xmlns:di="http://www.omg.org/spec/DMN/20180521/DI/" x="400" y="180"/>
        <di:waypoint xmlns:di="http://www.omg.org/spec/DMN/20180521/DI/" x="400" y="120"/>
      </dmndi:DMNEdge>
    </dmndi:DMNDiagram>
  </dmndi:DMNDI>
</definitions>`;
