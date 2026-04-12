# Conceptueel Ontwerp: 3D Data Universum voor Model-gebaseerde Registers

Dit document bevat de volledige samenvatting en technische blauwdruk voor de visualisatie van een model-gebaseerd register als een interactief 3D universum, inclusief navigatie door tijd en relaties.

---

## 1\. Het Concept: Reizen door de Data

Het hoofddoel is om de gebruiker het gevoel te geven dat hij door een **"Data Universum"** reist. In plaats van statische grafieken, navigeert de gebruiker door een VR-achtige omgeving waar objecten (entities) de hoofdrol spelen.

### Kernaspecten van de ervaring:

* **Warp-snelheid navigatie:** Bij het selecteren van een object beweegt de camera vloeiend naar dat punt (camera tweening).  
* **Focus-centric:** De wereld draait om het actieve object; niet-relevante context vervaagt om de interface "licht" te houden.  
* **Tijdreizen:** Gebruikers kunnen langs een tijdlijn navigeren om te zien hoe entiteiten en hun relaties door de tijd heen veranderen (playback).  
* **Bidirectionele navigatie:** Door het toevoegen van 'backward' relaties in de API kan de gebruiker in alle richtingen door het netwerk springen.

---

## 2\. Technische Architectuur (Web-based)

Voor een lichtgewicht maar krachtige web-ervaring is de volgende stack gekozen:

* **Frontend Framework:** React \+ Vite (voor snelheid en moderne development workflow).  
* **3D Engine:** `react-force-graph-3d` (gebaseerd op Three.js).  
* **State Management:** Zustand (voor coördinatie tussen 3D positie en de 2D HUD).  
* **API:** GraphQL of REST (met ondersteuning voor tijdstempels en afgeleide velden).

---

## 3\. Visualisatie Strategieën

### Het gebruik van Lagen

* **Metamodel Laag:** Visualiseert de regels en typen (bijv. Persoon, Rol, Besluit).  
* **Instance Laag:** De daadwerkelijke data (bijv. 'Jan de Vries' als instantie van 'Persoon').  
* **Inheritance (Overerving):** Verticale positionering om hiërarchie binnen types aan te duiden.

### Navigatie & Performance

* **Ghost Loading:** Objecten worden eerst geladen als ID's (ghost nodes) om direct een skelet te tonen. De 'huid' (namen, afgeleide velden) wordt opgehaald zodra de gebruiker nadert.  
* **Semantic Zoom:** Details verschijnen pas als de camera dichtbij genoeg is.  
* **HUD (Heads-Up Display):** Een 2D overlay die breadcrumbs, gedetailleerde metadata en tijdlijn-bediening toont zonder de 3D view te blokkeren.

---

## 4\. Implementatie Voorbeeld (React)

Onderstaand script vormt de basis voor de 3D component met camera-focus en HTML-labels voor namen.

import React, { useRef, useCallback } from 'react';

import { ForceGraph3D } from 'react-force-graph';

import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer';

const DataUniverse \= ({ graphData }) \=\> {

  const fgRef \= useRef();

  const handleNodeClick \= useCallback((node) \=\> {

    const distance \= 100;

    const distRatio \= 1 \+ distance / Math.hypot(node.x, node.y, node.z);

    fgRef.current.cameraPosition(

      { x: node.x \* distRatio, y: node.y \* distRatio, z: node.z \* distRatio },

      node,

      2000

    );

  }, \[\]);

  return (

    \<ForceGraph3D

      ref={fgRef}

      graphData={graphData}

      nodeThreeObject={(node) \=\> {

        const nodeEl \= document.createElement('div');

        nodeEl.textContent \= node.name || 'ID: ' \+ node.id;

        nodeEl.className \= 'node-label'; // CSS: pointer-events: none

        return new CSS2DObject(nodeEl);

      }}

      nodeThreeObjectExtend={true}

      extraRenderers={\[new CSS2DRenderer()\]}

      onNodeClick={handleNodeClick}

    /\>

  );

};

---

## 5\. Volgende Stappen voor VS Code & API

1. **API Uitbreiding:** Zorg dat de API 'backward' relaties ondersteunt voor bidirectioneel reizen.  
2. **Caching:** Cache afgeleide velden voor de huidige staat, gebruik 'headlight queries' voor tijdlijn-derivaties.  
3. **Gemini Code Assist:** Gebruik deze blauwdruk als context in VS Code om de specifieke data-mapping en GraphQL hooks te genereren.

