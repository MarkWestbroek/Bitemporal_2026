/**
 * ModelPicker — herbruikbaar paneel dat het canoniek model toont en
 * veld-referenties (FieldRefs) laat kiezen/slepen.
 *
 * Zie process_engine_v01/docs/driehoek-proces-regels-data.md voor de visie
 * (driehoek proces – regels – data) en het FieldRef-contract.
 */
export { default as ModelPicker, FIELDREF_MIME } from "./ModelPicker.jsx";
export { useSchemaModel } from "./useSchemaModel.js";
export { bouwModelTree, filterTree, maakFieldRef, fieldRefKey } from "./modelTree.js";
