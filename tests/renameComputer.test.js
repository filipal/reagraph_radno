import assert from 'assert';
import { test } from 'node:test';
import { renameComputer } from '../tmp/graphHelpers.js';

test('renameComputer updates installed software keys across computers', () => {
  const graph = {
    nodes: [
      {
        id: 'compA',
        type: 'computer',
        label: 'A',
        meta: {
          originalComputer: {
            idn: 'compA',
            installed_software: {
              'compA>sw1': {
                idn: 'compA>sw1',
                computer_idn: 'compA',
                provides_user_services: ['compA>us1'],
                provides_network_services: { 'compA>ns1': {} },
                local_dependencies: ['compA>dep1'],
              },
            },
          },
        },
      },
      {
        id: 'compB',
        type: 'computer',
        label: 'B',
        meta: {
          originalComputer: {
            idn: 'compB',
            installed_software: {
              'compA>swRef': {
                idn: 'compA>swRef',
                computer_idn: 'compA',
                provides_user_services: ['compA>usRef'],
              },
            },
          },
        },
      },
      {
        id: 'cred1',
        type: 'key',
        label: 'cred1',
        meta: { originalCredential: { idn: 'cred1', stored_at: ['compA'] } },
      },
      {
        id: 'compA>swNode',
        type: 'software',
        label: 'swNode',
        meta: {
          computer_idn: 'compA',
          originalSoftware: { idn: 'compA>swNode', computer_idn: 'compA' },
        },
      },
    ],
    edges: [],
  };

  const result = renameComputer(graph, 'compA', 'compX');
  const swNode = result.nodes.find(n => n.id === 'compX>swNode');

  assert(swNode, 'Renamed software node not found');
  assert.strictEqual(swNode.meta.originalSoftware.idn, 'compX>swNode');
  assert.strictEqual(swNode.meta.originalSoftware.computer_idn, 'compX');
  assert.strictEqual(swNode.meta.originalSoftware.idn_variant, 'compX>swNode#0');
});

test('renameComputer updates software node with # prefix', () => {
  const graph = {
    nodes: [
      {
        id: 'compA',
        type: 'computer',
        label: 'A',
      },
      {
        id: 'compA#swNode',
        type: 'software',
        label: 'swNode',
        meta: {
          computer_idn: 'compA',
          originalSoftware: {
            idn: 'compA#swNode',
            computer_idn: 'compA',
          },
        },
      },
    ],
    edges: [],
  };

  const result = renameComputer(graph, 'compA', 'compX');
  const swNode = result.nodes.find(n => n.id === 'compX#swNode');

  assert(swNode, 'Renamed software node not found');
  assert.strictEqual(swNode.meta.originalSoftware.idn, 'compX#swNode');
  assert.strictEqual(swNode.meta.originalSoftware.computer_idn, 'compX');
});