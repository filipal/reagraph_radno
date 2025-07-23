import type { NodeType, EdgeType, GraphData } from '../types';
import { getBinaryLabel, formatServerId } from '../services/JSONParser';
import { extractUserIdFromSwId } from '../utils/graphHelpers';

const INTERNET_NODE_ID = 'Internet';

export function filterFirewallsGraph(
  landscapeGraph: GraphData,
  outputJson: any,
  selectedGroup: string = '',
  selectedTypes: Set<string> = new Set()
): { nodes: NodeType[]; edges: EdgeType[] } {

  if (!outputJson?.computers) return { nodes: [], edges: [] };
  if (!landscapeGraph?.nodes) return { nodes: [], edges: [] };

  const nodes: NodeType[] = [];
  const edges: EdgeType[] = [];

  const nodeIndex: Record<string, NodeType> = {};
  const edgeIndex: Set<string> = new Set();

  function addNode(node: NodeType) {
    if (!nodeIndex[node.id]) {
      nodes.push(node);
      nodeIndex[node.id] = node;
    }
  }

  function addEdge(edge: EdgeType) {
    const edgeKey = `${edge.source}->${edge.target}`;
    if (!edgeIndex.has(edgeKey)) {
      edges.push(edge);
      edgeIndex.add(edgeKey);
    }
  }

  addNode({
    id: INTERNET_NODE_ID,
    label: 'Internet',
    fullName: 'Internet',
    type: 'internet',
    icon: '/icons/internet.png',
    group: 'internet'
  });

  const firewallRules = outputJson.firewall_rules || {};

  for (const rule of Object.values(firewallRules) as any[]) {
    const fromObjects: string[] = rule.from_objects || [];
    const toObjects: string[] = rule.to_objects || [];

    for (const from of fromObjects) {
      const isInternetFrom = from === 'INTERNET';

      for (const to of toObjects) {
        const [toCompId, toSwId] = to.split('>');
        const toComp = outputJson.computers?.[toCompId];
        const toSw = toComp?.installed_software?.[to];

        if (!toComp) continue;

        const toGroup = toComp.network_idn?.length
          ? `network.internal.${toComp.network_idn.join('_')}`
          : 'no-network';

        addNode({
          id: toCompId,
          label: formatServerId(toCompId),
          fullName: toCompId,
          type: 'computer',
          icon: '/icons/computer.png',
          group: toGroup,
          meta: {
            originalComputer: toComp,
            network_ids: toComp.network_idn || []
          }
        });

        const toLabel = toSw ? getBinaryLabel(toSw) : toSwId.split(':').pop()?.split('#')[0] || toSwId;

        addNode({
          id: toSwId,
          label: formatServerId(toLabel),
          fullName: toSw?.name || toSwId,
          type: 'software',
          icon: '/icons/binary.png',
          group: toGroup,
          meta: { computer_idn: toCompId, originalSoftware: toSw || null }
        });

        addEdge({
          id: `edge-${toCompId}-${toSwId}`,
          source: toCompId,
          target: toSwId,
          type: 'computer-software'
        });

        if (isInternetFrom) {
          addEdge({
            id: `edge-${INTERNET_NODE_ID}-${toSwId}`,
            source: INTERNET_NODE_ID,
            target: toSwId,
            type: 'internet'
          });
        }
      }

      if (!isInternetFrom && from.includes('>')) {
        const [fromCompId, fromSwId] = from.split('>');
        const fromComp = outputJson.computers?.[fromCompId];
        const fromSw = fromComp?.installed_software?.[from];

        if (!fromComp || !fromSw || fromSw.person_index !== 0) continue;

        const fromGroup = fromComp.network_idn?.length
          ? `network.internal.${fromComp.network_idn.join('_')}`
          : 'no-network';

        addNode({
          id: fromCompId,
          label: formatServerId(fromCompId),
          fullName: fromCompId,
          type: 'computer',
          icon: '/icons/computer.png',
          group: fromGroup,
          meta: {
            originalComputer: fromComp,
            network_ids: fromComp.network_idn || []
          }
        });

        const fromLabel = fromSw ? getBinaryLabel(fromSw) : fromSwId.split(':').pop()?.split('#')[0] || fromSwId;

        addNode({
          id: fromSwId,
          label: formatServerId(fromLabel),
          fullName: fromSw?.name || fromSwId,
          type: 'software',
          icon: '/icons/binary.png',
          group: fromGroup,
          meta: { computer_idn: fromCompId, user_id: extractUserIdFromSwId(fromSwId), originalSoftware: fromSw || null }
        });

        addEdge({
          id: `edge-${fromCompId}-${fromSwId}`,
          source: fromCompId,
          target: fromSwId,
          type: 'computer-software'
        });

        for (const to of toObjects) {
          if (to === 'INTERNET') {
            addEdge({
              id: `edge-${fromSwId}-${INTERNET_NODE_ID}`,
              source: fromSwId,
              target: INTERNET_NODE_ID,
              type: 'internet'
            });
            continue;
          }

          const [toCompId, toSwId] = to.split('>');
          const toComp = outputJson.computers?.[toCompId];
          const toSw = toComp?.installed_software?.[to];

          if (!toComp || !toSw) continue;

          const toGroup = toComp.network_idn?.length
            ? `network.internal.${toComp.network_idn.join('_')}`
            : 'no-network';

          addNode({
            id: toCompId,
            label: formatServerId(toCompId),
            fullName: toCompId,
            type: 'computer',
            icon: '/icons/computer.png',
            group: toGroup,
            meta: {
              originalComputer: toComp,
              network_ids: toComp.network_idn || []
            }
          });

          const toLabel = getBinaryLabel(toSw);

          addNode({
            id: toSwId,
            label: formatServerId(toLabel),
            fullName: toSw.name || toSwId,
            type: 'software',
            icon: '/icons/binary.png',
            group: toGroup,
            meta: { computer_idn: toCompId, originalSoftware: toSw || null }
          });

          addEdge({
            id: `edge-${toCompId}-${toSwId}`,
            source: toCompId,
            target: toSwId,
            type: 'computer-software'
          });

          addEdge({
            id: `edge-${fromSwId}-${toSwId}`,
            source: fromSwId,
            target: toSwId,
            type: 'software-software'
          });
        }
      }
    }
  }

  // ➡️ Filtriranje prema grupi
  let finalNodes = [...nodes];
  if (selectedGroup && selectedGroup !== 'internet') {
    const groupComputerIds = finalNodes
      .filter(n => n.type === 'computer' && n.group === selectedGroup)
      .map(n => n.id);

    finalNodes = finalNodes.filter(n =>
      (n.type === 'computer' && n.group === selectedGroup) ||
      (n.type === 'software' && groupComputerIds.includes(n.meta?.computer_idn || ''))
    );
  }

  if (selectedTypes.size > 0) {
    finalNodes = finalNodes.filter(n =>
      (n.id === INTERNET_NODE_ID && (selectedGroup === 'internet' || !selectedGroup)) ||
      selectedTypes.has(n.type)
    );
  }

  const finalNodeIds = new Set(finalNodes.map(n => n.id));
  const finalEdges = edges.filter(e =>
    finalNodeIds.has(e.source as string) && finalNodeIds.has(e.target as string)
  );

  return { nodes: finalNodes, edges: finalEdges };
}
