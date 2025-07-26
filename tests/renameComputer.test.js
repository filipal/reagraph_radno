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
    ],
    edges: [],
  };

  const result = renameComputer(graph, 'compA', 'compX');
  const compX = result.nodes.find(n => n.id === 'compX');
  const compB = result.nodes.find(n => n.id === 'compB');
  const cred = result.nodes.find(n => n.id === 'cred1');

  assert(compX, 'Renamed computer not found');
  assert(compX.meta.originalComputer.installed_software['compX>sw1']);
  assert.strictEqual(
    compX.meta.originalComputer.installed_software['compX>sw1'].computer_idn,
    'compX'
  );
  assert.strictEqual(
    compX.meta.originalComputer.installed_software['compX>sw1'].provides_user_services[0],
    'compX>us1'
  );
  assert(
    compX.meta.originalComputer.installed_software['compX>sw1'].provides_network_services['compX>ns1'] !== undefined
  );
  assert.strictEqual(
    compX.meta.originalComputer.installed_software['compX>sw1'].local_dependencies[0],
    'compX>dep1'
  );

  assert(compB.meta.originalComputer.installed_software['compX>swRef']);
  assert.strictEqual(
    compB.meta.originalComputer.installed_software['compX>swRef'].computer_idn,
    'compX'
  );
  assert.strictEqual(
    compB.meta.originalComputer.installed_software['compX>swRef'].provides_user_services[0],
    'compX>usRef'
  );

  assert.deepStrictEqual(cred.meta.originalCredential.stored_at, ['compX']);
});