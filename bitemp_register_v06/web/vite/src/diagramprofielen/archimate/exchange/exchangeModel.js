// @ts-check
/**
 * Neutraal bronmodel van een ArchiMate Model Exchange-bestand.
 * Deze typedefs kennen XML en ArchiMate, maar geen diagramcore of Studio-store.
 *
 * @typedef {{lang:string|null,value:string}} LangString
 * @typedef {{severity:"error"|"warning"|"info",code:string,message:string,sourceId:string|null,path:string|null}} Diagnostic
 * @typedef {{definitionId:string,waarden:LangString[]}} ExchangeProperty
 * @typedef {{identifier:string,naam:LangString[],type:string}} PropertyDefinition
 * @typedef {{identifier:string,type:string,names:LangString[],documentation:LangString[],properties:ExchangeProperty[],attributes:Record<string,string>}} ExchangeElement
 * @typedef {ExchangeElement & {source:string,target:string}} ExchangeRelationship
 * @typedef {{x:number,y:number,w?:number,h?:number}} Bounds
 * @typedef {{identifier:string,type:string,elementRef:string|null,names:LangString[],documentation:LangString[],bounds:Bounds|null,style:Object|null,nodes:ExchangeViewNode[],raw:Object}} ExchangeViewNode
 * @typedef {{identifier:string,type:string,relationshipRef:string|null,source:string|null,target:string|null,bendpoints:Bounds[],sourceAttachment:Bounds|null,targetAttachment:Bounds|null,style:Object|null,names:LangString[],raw:Object}} ExchangeConnection
 * @typedef {{identifier:string,names:LangString[],documentation:LangString[],nodes:ExchangeViewNode[],connections:ExchangeConnection[]}} ExchangeView
 * @typedef {{identifier:string|null,identifierRef:string|null,labels:LangString[],items:ExchangeOrganization[]}} ExchangeOrganization
 * @typedef {{formaat:"archimate-model-exchange",namespace:string,model:Object,propertyDefinitions:Record<string,PropertyDefinition>,elements:Record<string,ExchangeElement>,relationships:Record<string,ExchangeRelationship>,views:Record<string,ExchangeView>,organizations:ExchangeOrganization[],diagnostics:Diagnostic[]}} ExchangeModel
 */

export {};