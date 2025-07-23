/**
 * Priprema grafa za prikaz u Reagraph komponenti.
 *
 * Ova datoteka sadrži funkcije koje obogaćuju (enrich) čvorove u grafu tako da:
 * - Dodjeljuju tip (`type`) čvorovima ako nije unaprijed definiran
 * - Dodaju odgovarajuću ikonu (`icon`) na temelju tipa ili prepoznatljivih obrazaca u ID-ju/ikoni
 *
 * Cilj je osigurati da svi čvorovi imaju konzistentne atribute za ispravno i jasno vizualno prikazivanje u sučelju.
 */

import type { EdgeType, NodeType } from '../types';
import { iconMap } from './graphUtils';

/**
 * Pomoćna funkcija za određivanje tipa čvora na temelju id-a ili ikone.
 */
const inferNodeType = (node: any): string => {
  if (node.icon?.includes('user.png') || node.id?.startsWith('user-')) return 'user';
  if (node.icon?.includes('binary.png')) return 'software';
  if (node.icon?.includes('service.png')) return 'service';
  if (node.icon?.includes('customer.png')) return 'user-service';
  return 'computer'; // fallback
};

/**
 * Funkcija za pripremu grafa prije prikaza u komponenti.
 * - Dodaje nedostajući `type` na temelju `icon`/`id`
 * - Dodaje odgovarajuću `icon` vrijednost ako nije definirana
 */
export function prepareGraph(rawData: { nodes: NodeType[]; edges: EdgeType[] }) {
  const enrichedNodes = rawData.nodes.map((node) => {
    const type = node.type || inferNodeType(node);
    return {
      ...node,
      type,
      icon: node.icon || iconMap[type.toLowerCase()] || '/icons/computer.png',
    };
  });

  return {
    nodes: enrichedNodes,
    edges: rawData.edges,
  };
}
