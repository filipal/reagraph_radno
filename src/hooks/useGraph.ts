/**
 * Hook: useGraph
 *
 * Pruža centraliziran način za upravljanje stablom grafa unutar aplikacije.
 * Koristi globalno stanje grafa iz `SessionContext` (putem `useSession` hooka),
 * te nudi funkcije za dodavanje, ažuriranje i vraćanje (undo/redo) promjena na čvorovima i rubovima.
 *
 * Prednosti:
 * - Izmjene su kontrolirane i konzistentne
 * - Omogućena je povijest promjena (undo/redo)
 * - Sprječava izravne manipulacije stablom grafa izvan predviđenih mehanizama
 *
 * Namjena:
 * Koristi se u komponentama koje trebaju čitati ili mijenjati strukturu grafa.
 */

import { useSession } from '../context/SessionContext'; // pristup globalnom stanju grafa
import { useState } from 'react';
import type { NodeType, EdgeType, GraphData } from '../types';

/**
 * Hook koji vraća trenutno stanje grafa i pomoćne funkcije za njegovo ažuriranje.
 */
export const useGraph = () => {
  const { graphData, setGraphData } = useSession(); // dohvat trenutnog grafa iz konteksta

  const [history, setHistory] = useState<GraphData[]>([]);
  const [future, setFuture] = useState<GraphData[]>([]);

  const pushToHistory = () => {
    setHistory((prev) => [...prev, graphData]);
    setFuture([]); // Resetira redo stog nakon nove promjene
  };

  const undo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setFuture((prev) => [graphData, ...prev]);
    setGraphData(previous);
  };

  const redo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((prev) => prev.slice(1));
    setHistory((prev) => [...prev, graphData]);
    setGraphData(next);
  };

  /**
   * Ažurira postojeći čvor prema ID-u.
   */
  const updateNode = (updatedNode: NodeType) => {
    pushToHistory();
    setGraphData({
      ...graphData,
      nodes: graphData.nodes.map((node: NodeType) =>
        node.id === updatedNode.id ? updatedNode : node
      ),
    });
  };

  /**
   * Ažurira postojeći rub prema ID-u.
   */
  const updateEdge = (updatedEdge: EdgeType) => {
    pushToHistory();
    setGraphData({
      ...graphData,
      edges: graphData.edges.map((edge: EdgeType) =>
        edge.id === updatedEdge.id ? updatedEdge : edge
      ),
    });
  };

  /**
   * Dodaje novi čvor u graf.
   */
  const addNode = (node: NodeType) => {
    pushToHistory();
    setGraphData({
      ...graphData,
      nodes: [...graphData.nodes, node],
    });
  };

  /**
   * Dodaje novi rub (edge) u graf.
   */
  const addEdge = (edge: EdgeType) => {
    pushToHistory();
    setGraphData({
      ...graphData,
      edges: [...graphData.edges, edge],
    });
  };

  /**
   * Briše čvor prema ID-u.
   */
  const removeNode = (nodeId: string) => {
    pushToHistory();
    setGraphData({
      ...graphData,
      nodes: graphData.nodes.filter((node: NodeType) => node.id !== nodeId),
      edges: graphData.edges.filter(
        (edge: EdgeType) =>
          (typeof edge.source === 'string' ? edge.source : edge.source.id) !== nodeId &&
          (typeof edge.target === 'string' ? edge.target : edge.target.id) !== nodeId
      ),
    });
  };

  /**
   * Briše rub (edge) prema ID-u.
   */
  const removeEdge = (edgeId: string) => {
    pushToHistory();
    setGraphData({
      ...graphData,
      edges: graphData.edges.filter((edge: EdgeType) => edge.id !== edgeId),
    });
  };

  /**
   * Resetira graf na prazno stanje.
   */
  const resetGraph = () => {
    pushToHistory();
    setGraphData({ nodes: [], edges: [] });
  };

  return {
    graphData,
    addNode,
    addEdge,
    updateNode,
    updateEdge,
    removeNode,
    removeEdge,
    resetGraph,
    undo,
    redo,
    canUndo: history.length > 0,
    canRedo: future.length > 0,
  };
};