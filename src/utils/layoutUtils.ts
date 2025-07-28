import type { NodeType } from '../types';


// Spacing between nodes within a single group cluster
export const spacingX = 500;
export const spacingY = 500;

// Additional spacing applied between different groups
export const groupSpacingX = 3000;
export const groupSpacingY = 3000;



export function manualLayout(nodes: NodeType[]): NodeType[] {
  // Group nodes by their "group" field (fallback to computer ID or 'default')
  const groups: Record<string, NodeType[]> = {};
  nodes.forEach(node => {
    const g = node.group ?? node.computer_idn ?? 'default';
    if (!groups[g]) {
      groups[g] = [];
    }
    groups[g].push(node);
  });

  const groupKeys = Object.keys(groups);
  const groupsPerRow = Math.ceil(Math.sqrt(groupKeys.length));

  const layouted: NodeType[] = [];
  groupKeys.forEach((groupKey, groupIndex) => {
    const groupNodes = groups[groupKey];
    const offsetX = (groupIndex % groupsPerRow) * groupSpacingX;
    const offsetY = Math.floor(groupIndex / groupsPerRow) * groupSpacingY;

    groupNodes.forEach((node, index) => {
      layouted.push({
        ...node,
        x: offsetX + (index % 5) * spacingX,
        y: offsetY + Math.floor(index / 5) * spacingY,
        z: 0
      });
    });
  });

  return layouted;
}