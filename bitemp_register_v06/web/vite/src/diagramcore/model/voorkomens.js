// @ts-check

/** Identiteit van een visueel voorkomen; oude diagrammen blijven elementId gebruiken. */
export function voorkomenId(node) {
  return node?.nodeId || node?.elementId || null;
}

/** Vind exact voorkomen, met elementId als compatibele fallback naar het eerste voorkomen. */
export function vindVoorkomen(nodes, sleutel) {
  const lijst = nodes || [];
  return lijst.find((node) => voorkomenId(node) === sleutel) || lijst.find((node) => node.elementId === sleutel) || null;
}

/** Groepeer diagramnodes per modelelement. */
export function voorkomensPerElement(nodes) {
  const result = new Map();
  for (const node of nodes || []) {
    if (!node?.elementId) continue;
    const lijst = result.get(node.elementId) || [];
    lijst.push(node);
    result.set(node.elementId, lijst);
  }
  return result;
}

function midden(node, maat) {
  return {
    x: node.position.x + (node.size?.width ?? maat?.width ?? 200) / 2,
    y: node.position.y + (node.size?.height ?? maat?.height ?? 80) / 2,
  };
}

/** Kies van twee voorkomenlijsten het paar met de kleinste afstand tussen middelpunten. */
export function kortsteVoorkomenPaar(bronnen, doelen, maten = null) {
  let beste = null;
  let besteAfstand = Number.POSITIVE_INFINITY;
  for (const bron of bronnen || []) {
    for (const doel of doelen || []) {
      const bronId = voorkomenId(bron);
      const doelId = voorkomenId(doel);
      const b = midden(bron, maten?.[bronId]);
      const d = midden(doel, maten?.[doelId]);
      const afstand = (d.x - b.x) ** 2 + (d.y - b.y) ** 2;
      if (afstand < besteAfstand) {
        beste = { bron, doel };
        besteAfstand = afstand;
      }
    }
  }
  return beste;
}

let teller = 0;

/** Unieke voorkomen-id; teller maakt dezelfde milliseconde veilig. */
export function nieuwVoorkomenId(elementId) {
  teller += 1;
  return `${elementId}__voorkomen_${Date.now()}_${teller}`;
}

/** ElementType-override wint van de profieldefault; zonder vlag blijft oud gedrag actief. */
export function staatMeerdereVoorkomensToe(diagramType, elementType) {
  return elementType?.meerdereVoorkomens ?? diagramType?.meerdereVoorkomens ?? false;
}