// @ts-check

export const ELEMENT_TYPE_MAPPING = Object.freeze({
  BusinessActor: "business-actor",
  BusinessRole: "business-rol",
  BusinessProcess: "business-proces",
  BusinessFunction: "business-functie",
  BusinessService: "business-service",
  BusinessEvent: "business-event",
  BusinessObject: "business-object",
  ApplicationComponent: "app-component",
  ApplicationService: "app-service",
  ApplicationFunction: "app-functie",
  DataObject: "data-object",
  Node: "node",
  Device: "device",
  SystemSoftware: "systeemsoftware",
  TechnologyService: "tech-service",
  Artifact: "artifact",
  Stakeholder: "stakeholder",
  Driver: "driver",
  Goal: "goal",
  Principle: "principle",
  Requirement: "requirement",
  Constraint: "constraint",
  AndJunction: "junction",
  OrJunction: "junction",
});

export const RELATIONSHIP_TYPE_MAPPING = Object.freeze({
  Composition: "compositie",
  CompositionRelationship: "compositie",
  Aggregation: "aggregatie",
  AggregationRelationship: "aggregatie",
  Assignment: "toewijzing",
  AssignmentRelationship: "toewijzing",
  Realization: "realisatie",
  RealizationRelationship: "realisatie",
  Serving: "bediening",
  ServingRelationship: "bediening",
  Access: "toegang",
  AccessRelationship: "toegang",
  Influence: "beinvloeding",
  InfluenceRelationship: "beinvloeding",
  Triggering: "trigger",
  TriggeringRelationship: "trigger",
  Flow: "stroom",
  FlowRelationship: "stroom",
  Specialization: "specialisatie",
  SpecializationRelationship: "specialisatie",
  Association: "associatie",
  AssociationRelationship: "associatie",
});

export function mapElementType(exchangeType) {
  return ELEMENT_TYPE_MAPPING[exchangeType] || null;
}

export function mapRelationshipType(exchangeType) {
  return RELATIONSHIP_TYPE_MAPPING[exchangeType] || null;
}