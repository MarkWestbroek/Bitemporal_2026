/**
 * useOvergeerfdeVelden — Hook die de overgeërfde velden ophaalt voor een node
 * via generalisatie-edges. Gebruikt de React Flow store voor reactive updates.
 */
import { useMemo } from "react";
import { useStore } from "@xyflow/react";

export function useOvergeerfdeVelden(nodeId) {
  const selector = useMemo(
    () => (state) => {
      const genEdge = state.edges.find(
        (e) => e.source === nodeId && e.data?.isGeneralization
      );
      if (!genEdge) return null;
      const supertypeNode = state.nodes.find((n) => n.id === genEdge.target);
      if (!supertypeNode) return null;
      return {
        supertypeNaam: supertypeNode.data?.typenaam || supertypeNode.id,
        velden: supertypeNode.data?.velden || [],
      };
    },
    [nodeId]
  );
  return useStore(selector);
}
