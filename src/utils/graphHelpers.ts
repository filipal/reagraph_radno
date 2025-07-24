/**
 * graphHelpers.ts
 * -----------------------
 * Sadrži pomoćne funkcije za dohvat informacija o čvorovima i vezama u grafu.
 */


import type { EdgeType, NodeType } from '../types';

/**
 * Dohvati usera koji koristi softver (ako postoji).
 */
export const getSoftwareUser = (
  softwareId: string,
  validEdges: EdgeType[]
): string | null => {
  const compEdge = validEdges.find(e =>
    e.type === 'computer-software' &&
    ((typeof e.target === 'string' && e.target === softwareId) ||
     (typeof e.target === 'object' && e.target.id === softwareId))
  );

  if (!compEdge) return null;

  const computerId = typeof compEdge.source === 'string' ? compEdge.source : compEdge.source.id;

  const userEdge = validEdges.find(e =>
    e.type === 'user-computer' &&
    ((typeof e.target === 'string' && e.target === computerId) ||
     (typeof e.target === 'object' && e.target.id === computerId))
  );

  if (!userEdge) return null;

  return typeof userEdge.source === 'string' ? userEdge.source : userEdge.source.id;
};

/**
 * Parsiraj CPE string u vendor, product, version.
 */
export const parseCpe = (
  cpeString: string
): { vendor: string; product: string; version: string } => {
  const cpe = cpeString.split('>')[1] || cpeString; // ako ima prefix poput None:0:0>
  const parts = cpe.split(':');

  const vendor = parts[2] || 'Unknown';
  const product = parts[3] || 'Unknown';
  const version = parts[4] || 'N/A';

  return { vendor, product, version };
};

/**
 * Dohvati providera za service (može biti softver ili računalo).
 */
export const getServiceProvider = (
  serviceId: string,
  validEdges: EdgeType[]
): { type: 'software' | 'computer'; id: string } | null => {
  const edge = validEdges.find(e =>
    (e.type === 'software-service' || e.type === 'computer-service') &&
    ((typeof e.target === 'string' && e.target === serviceId) ||
     (typeof e.target === 'object' && e.target.id === serviceId))
  );

  if (!edge) return null;

  const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
  const sourceType = edge.type === 'software-service' ? 'software' : 'computer';

  return { type: sourceType, id: sourceId };
};

/**
 * Dohvati računalo na kojem je instaliran softver.
 */
export const getSoftwareComputer = (
  softwareId: string,
  validEdges: EdgeType[]
): string | null => {
  const edge = validEdges.find(e =>
    e.type === 'computer-software' &&
    ((typeof e.target === 'string' && e.target === softwareId) ||
     (typeof e.target === 'object' && e.target.id === softwareId))
  );

  if (!edge) return null;

  return typeof edge.source === 'string' ? edge.source : edge.source.id;
};

/**
 * Parsiraj software ID iz user-service ID-a.
 */
export const parseSoftwareIdFromUserServiceId = (
  userServiceId: string
): string | null => {
  const parts = userServiceId.split('>');
  if (parts.length < 2) return null;
  const swPart = parts[1].split('#')[0];
  return swPart || null;
};


export function cleanDuplicateLabel(label: string | undefined): string {
  if (!label) return '';
  const mid = Math.floor(label.length / 2);
  const firstHalf = label.slice(0, mid);
  const secondHalf = label.slice(mid);
  // Ako je string duplo isti (npr. 'abcabc')
  if (firstHalf === secondHalf) {
    return firstHalf;
  }
  // Ako je string oblika 'xxx xxx' (razdvojeno razmakom)
  const words = label.split(' ');
  const halfWords = Math.floor(words.length / 2);
  if (halfWords > 0 && words.slice(0, halfWords).join(' ') === words.slice(halfWords).join(' ')) {
    return words.slice(0, halfWords).join(' ');
  }
  // Ako je string oblika 'aaa aaa' bez razmaka
  const regex = /^(.+)\1$/;
  const match = label.match(regex);
  if (match) {
    return match[1];
  }
  return label;
}

/**
 * Dohvati verziju softvera iz NodeType.
 */
export const getSoftwareVersion = (softwareNode: NodeType): string => {
  const cpe = softwareNode.meta?.originalSoftware?.cpe_idn || softwareNode.fullName || softwareNode.id;
  const parts = cpe.split(':');

  if (parts.length >= 5) {
    const version = parts[4];
    return version || 'N/A';
  }

  return 'N/A';
};

export function shortenDataserviceLabel(label: string): string {
  if (!label) return '';
  if (label.includes(':')) {
    const parts = label.split(':');
    const last = parts.pop();
    const first = parts.join(':');
    return `${first}:${last}`;
  }
  if (label.includes('#')) {
    return label.split('#')[0];
  }
  return label;
}

export function extractUserIdFromSwId(swId: string): string | null {
  if (swId.startsWith('None')) return null;
  return swId.split('>')[0] || null;
}

export function getNodeOriginalData(node: NodeType) {
  if (!node) return {};

  switch (node.type) {
    case 'software':
      return {
        id: node.meta?.originalSoftware?.idn || node.id,
        name: node.meta?.originalSoftware?.name || node.label || node.id,
        cpe: node.meta?.originalSoftware?.cpe_idn || 'N/A',
        version: node.meta?.originalSoftware?.version || 'N/A',
        computer_idn: node.meta?.computer_idn || 'Unknown',
        raw: node.meta?.originalSoftware || null
      };

    case 'service':
      return {
        id: node.meta?.originalService?.idn || node.id,
        name: node.meta?.originalService?.name || node.label || node.id,
        type: 'service',
        raw: node.meta?.originalService || null
      };

    case 'user-service':
      return {
        id: node.meta?.originalSoftware?.idn || node.id,
        name: node.meta?.originalSoftware?.name || node.label || node.id,
        user_id: node.meta?.originalSoftware?.person_group_id || 'N/A',
        computer_idn: node.meta?.computer_idn || 'Unknown',
        raw: node.meta?.originalSoftware || null
      };

    case 'computer':
      return {
        id: node.id, // koristi čisti ID
        name: node.meta?.originalComputer?.name || node.label || node.id,
        network_ids: node.meta?.originalComputer?.network_idn || [],
        raw: node.meta?.originalComputer || null
      };

    case 'user':
      return {
        id: node.id.replace(/^user-/, ''), // makni "user-" prefix
        name: node.label || node.id.replace(/^user-/, ''),
        raw: node.meta?.originalUser || null
      };

    case 'key':
    case 'lock':
      return {
        id: node.meta?.originalCredential?.idn || node.id,
        name: node.meta?.originalCredential?.name || node.label || node.id,
        raw: node.meta?.originalCredential || null
      };

    default:
      return {
        id: node.id,
        name: node.label || node.id,
        raw: null
      };
  }
}

export function cleanUserId(id: string): string {
  return id.replace(/^user-/, '');
}

export function propagateNetworkChangeLandscape(
  graphData: { nodes: NodeType[]; edges: EdgeType[] },
  computerId: string,
  newGroup: string,
  newNetworkIds: number[],
  newLabel: string
): { nodes: NodeType[]; edges: EdgeType[] } {
  console.log('[Landscape] propagateNetworkChangeLandscape', { computerId, newGroup, newNetworkIds, graphData });
  // Pronađi sve povezane čvorove edge-ovima
  const connectedNodeIds = new Set([computerId]);
  graphData.edges.forEach(edge => {
    const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
    const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;
    if (sourceId === computerId) connectedNodeIds.add(targetId);
    if (targetId === computerId) connectedNodeIds.add(sourceId);
  });
  // Prvo propagiraj na sve povezane čvorove
  graphData.nodes.forEach(node => {
    if (connectedNodeIds.has(node.id)) {
      node.label = newLabel;
      node.group = newGroup;
      if (node.meta) node.meta.network_ids = newNetworkIds;
    }
  });

  // Dodatno: za svaki software čvor u connectedNodeIds, propagiraj na povezane service/user-service čvorove
  graphData.nodes.forEach(node => {
    if (node.type === 'software' && connectedNodeIds.has(node.id)) {
      graphData.edges.forEach(edge => {
        const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
        const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;
        if (sourceId === node.id) {
          const targetNode = graphData.nodes.find(n => n.id === targetId);
          if (targetNode && (targetNode.type === 'service' || targetNode.type === 'user-service')) {
            targetNode.group = newGroup;
            targetNode.label = node.label;
            if (targetNode.meta) targetNode.meta.network_ids = newNetworkIds;
          }
        }
      });
    }
  });
  return { ...graphData };
}

export function renameComputer(
  graphData: { nodes: NodeType[]; edges: EdgeType[] },
  oldId: string,
  newId: string,
): { nodes: NodeType[]; edges: EdgeType[] } {
  const updatedNodes = graphData.nodes.map((n) => {
    let updatedNode = { ...n };

    if (n.id === oldId) {
      updatedNode = { ...n, id: newId };
      if (updatedNode.meta?.originalComputer) {
        updatedNode = {
          ...updatedNode,
          meta: {
            ...updatedNode.meta,
            originalComputer: {
              ...updatedNode.meta.originalComputer,
              idn: newId,
            },
          },
        };
      }
    }

    if (updatedNode.meta?.computer_idn === oldId) {
      updatedNode = {
        ...updatedNode,
        meta: { ...updatedNode.meta, computer_idn: newId },
      };
    }

    return updatedNode;
  });

  const escapedOldId = oldId.replace(/([.*+?^${}()|[\]\\])/g, '\\$1');
  const idRegex = new RegExp(escapedOldId, 'g');

  const updatedEdges = graphData.edges.map((edge) => {
    let source = edge.source;
    let target = edge.target;

    if (typeof source === 'string') {
      if (source === oldId) source = newId;
    } else if (source.id === oldId) {
      source = { ...source, id: newId };
    }

    if (typeof target === 'string') {
      if (target === oldId) target = newId;
    } else if (target.id === oldId) {
      target = { ...target, id: newId };
    }

    const newEdgeId = edge.id.replace(idRegex, newId);

    return { ...edge, id: newEdgeId, source, target };
  });
  return { nodes: updatedNodes, edges: updatedEdges };
}

export function propagateNetworkChangeFirewalls(
  graphData: { nodes: NodeType[]; edges: EdgeType[] },
  computerId: string,
  newGroup: string,
  newNetworkIds: number[],
  newLabel: string
): { nodes: NodeType[]; edges: EdgeType[] } {
  console.log('[Firewalls] propagateNetworkChangeFirewalls', { computerId, newGroup, newNetworkIds, graphData });
  const connectedNodeIds = new Set([computerId]);
  graphData.edges.forEach(edge => {
    const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
    const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;
    if (sourceId === computerId) connectedNodeIds.add(targetId);
    if (targetId === computerId) connectedNodeIds.add(sourceId);
  });
        graphData.nodes.forEach(node => {
            if (connectedNodeIds.has(node.id)) {
                console.log('[Firewalls] Updating node', { nodeId: node.id, prevGroup: node.group, newGroup, prevNetworkIds: node.meta?.network_ids, newNetworkIds });
                if (node.id === computerId) {
                  node.label = newLabel;
                }
                node.group = newGroup;
                if (node.meta) node.meta.network_ids = newNetworkIds;
            }
        });

  // Dodatno: za svaki software čvor u connectedNodeIds, propagiraj na povezane service/user-service čvorove
  graphData.nodes.forEach(node => {
    if (node.type === 'software' && connectedNodeIds.has(node.id)) {
      graphData.edges.forEach(edge => {
        const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
        const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;
        if (sourceId === node.id) {
          const targetNode = graphData.nodes.find(n => n.id === targetId);
          if (targetNode && (targetNode.type === 'service' || targetNode.type === 'user-service')) {
            targetNode.group = newGroup;
            if (targetNode.meta) targetNode.meta.network_ids = newNetworkIds;
          }
        }
      });
    }
  });
  return { ...graphData };
}

export function propagateNetworkChangeDataservices(
  graphData: { nodes: NodeType[]; edges: EdgeType[] },
  computerId: string,
  newGroup: string,
  newNetworkIds: number[],
  newLabel: string
): { nodes: NodeType[]; edges: EdgeType[] } {
  console.log('[Dataservices] propagateNetworkChangeDataservices', { computerId, newGroup, newNetworkIds, graphData });
  const connectedNodeIds = new Set([computerId]);
  graphData.edges.forEach(edge => {
    const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
    const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;
    if (sourceId === computerId) connectedNodeIds.add(targetId);
    if (targetId === computerId) connectedNodeIds.add(sourceId);
  });
        graphData.nodes.forEach(node => {
            if (connectedNodeIds.has(node.id)) {
                console.log('[Dataservices] Updating node', { nodeId: node.id, prevGroup: node.group, newGroup, prevNetworkIds: node.meta?.network_ids, newNetworkIds });
                if (node.id === computerId) {
                    node.label = newLabel;
                }
                node.group = newGroup;
                if (node.meta) node.meta.network_ids = newNetworkIds;
            }
        });

  // Dodatno: za svaki software čvor u connectedNodeIds, propagiraj na povezane service/user-service čvorove
  graphData.nodes.forEach(node => {
    if (node.type === 'software' && connectedNodeIds.has(node.id)) {
      console.log('[Firewalls] Software node for propagation', node.id);
      graphData.edges.forEach(edge => {
        const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
        const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;
        if (sourceId === node.id) {
          const targetNode = graphData.nodes.find(n => n.id === targetId);
          if (targetNode && (targetNode.type === 'service' || targetNode.type === 'user-service')) {
            targetNode.group = newGroup;
            if (targetNode.meta) targetNode.meta.network_ids = newNetworkIds;
          }
        }
      });
    }
  });
  return { ...graphData };
}

export function propagateNetworkChangeCredentials(
  graphData: { nodes: NodeType[]; edges: EdgeType[] },
  computerId: string,
  newGroup: string,
  newLabel: string,
  newNetworkIds: number[]
): { nodes: NodeType[]; edges: EdgeType[] } {
  console.log('[Credentials] propagateNetworkChangeCredentials', { computerId, newGroup, graphData });
  const connectedNodeIds = new Set([computerId]);
  graphData.edges.forEach(edge => {
    const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
    const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;
    if (sourceId === computerId) connectedNodeIds.add(targetId);
    if (targetId === computerId) connectedNodeIds.add(sourceId);
  });
        graphData.nodes.forEach(node => {
            if (connectedNodeIds.has(node.id)) {
                console.log('[Credentials] Updating node', { nodeId: node.id, prevGroup: node.group, newGroup });
                node.group = newGroup;
                if (node.meta) node.meta.network_ids = newNetworkIds;
            }
        });

  // Dodatno: za svaki software čvor u connectedNodeIds, propagiraj na povezane service/user-service čvorove
  graphData.nodes.forEach(node => {
    if (node.type === 'software' && connectedNodeIds.has(node.id)) {
      graphData.edges.forEach(edge => {
        const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
        const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;
        if (sourceId === node.id) {
          const targetNode = graphData.nodes.find(n => n.id === targetId);
          if (targetNode && (targetNode.type === 'service' || targetNode.type === 'user-service')) {
            targetNode.group = newGroup;
            if (targetNode.meta) targetNode.meta.network_ids = newNetworkIds;
          }
        }
      });
    }
  });
  return { ...graphData };
}
