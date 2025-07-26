/**
 * SessionContext
 *
 * Global React context that enables centralized management of the graph state (nodes and edges)
 * throughout the entire application. It is used to share the graph between multiple components
 * without the need for prop drilling.
 *
 * Combined with the `useGraph` hook, it allows:
 * - Retrieving the current graph
 * - Updating the graph from any component
 * - Using undo/redo functionality (within `useGraph`)
 *
 * This context must wrap all parts of the application that need access to the graph,
 * using the `SessionProvider` component.
 */

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { GraphData, FileItem, Computer } from '../types';
import { useState } from 'react';
import { replacePrefix } from '../utils/common';

// Type describing the structure of the available data in the context
type SessionContextType = {
  graphData: GraphData;
  setGraphData: (data: GraphData) => void;
  outputJson: any;
  setOutputJson: (data: any) => void;
  files: FileItem[];
  setFiles: (files: FileItem[]) => void;
  editableJson: any;
  setEditableJson: (data: any) => void;
  updateComputer: (
    id: string,
    updatedData: Partial<any>,
    oldId?: string,
  ) => void;
  renameComputerInJson: (oldId: string, newId: string) => void;
};

// Initial (empty) graph used on initialization
const defaultGraphData: GraphData = {
  nodes: [],
  edges: [],
};
// Context initialization (no value until wrapped in a Provider)
const SessionContext = createContext<SessionContextType | undefined>(undefined);

/**
 * SessionProvider
 * Wraps the part of the application that needs access to the graph.
 * Used for storing and updating the graph via React state.
 */
export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [graphData, setGraphData] = useState<GraphData>(defaultGraphData);
  const [outputJson, setOutputJson] = useState<any>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [editableJson, setEditableJson] = useState<any>(null);

  const updateComputer = (
    id: string,
    updatedData: Partial<any>,
    oldId?: string,
  ) => {
    setEditableJson((prev: any) => {
      const computers = { ...prev.computers };
      if (oldId && oldId !== id && computers[oldId]) {
        delete computers[oldId];
      }
      return {
        ...prev,
        computers: {
          ...computers,
          [id]: {
            ...(computers[id] || {}),
            ...updatedData,
          },
        },
      };
    });
  };

    const renameComputerInJson = (oldId: string, newId: string) => {
    setEditableJson((prev: any) => {
      if (!prev?.computers?.[oldId]) return prev;

      const updated = { ...prev };

      // ----- update computer entry -----
      const { [oldId]: oldComp, ...otherComps } = prev.computers;
      const renamedComp = { ...oldComp, idn: newId };

      // Rename installed software entries for all computers
      const updateSoftware = (comp: Computer): Computer => {
        if (!comp?.installed_software) return comp;
        const newSw: Record<string, any> = {};
        for (const [swKey, swVal] of Object.entries(comp.installed_software)) {
          let newKey: string = swKey;
          if (swKey.startsWith(oldId)) {
            newKey = newId + swKey.slice(oldId.length);
          }
          const newVal: any = typeof swVal === 'object' && swVal !== null ? { ...swVal } : swVal;
          if (typeof newVal.computer_idn === 'string' && newVal.computer_idn.startsWith(oldId)) {
            newVal.computer_idn = newId + newVal.computer_idn.slice(oldId.length);
          }

          const renameNestedKeys = (obj: any) => {
            if (!obj || typeof obj !== 'object') return obj;
            const renamed: Record<string, any> = {};
            for (const [k, v] of Object.entries(obj)) {
              const nk = replacePrefix(k, oldId, newId);
              renamed[nk] = v;
            }
            return renamed;
          };

          if (Array.isArray(newVal.provides_user_services)) {
            newVal.provides_user_services = newVal.provides_user_services.map((id: string) =>
              replacePrefix(id, oldId, newId),
            );
          } else {
            newVal.provides_user_services = renameNestedKeys(newVal.provides_user_services);
          }

          if (Array.isArray(newVal.provides_network_services)) {
            newVal.provides_network_services = newVal.provides_network_services.map((id: string) =>
              replacePrefix(id, oldId, newId),
            );
          } else {
            newVal.provides_network_services = renameNestedKeys(newVal.provides_network_services);
          }

          const renameArray = (arr: any[]) =>
            arr.map(v => (typeof v === 'string' ? replacePrefix(v, oldId, newId) : v));

          if (Array.isArray(newVal.accepts_credentials)) {
            newVal.accepts_credentials = renameArray(newVal.accepts_credentials);
          }
          if (Array.isArray(newVal.local_dependencies)) {
            newVal.local_dependencies = renameArray(newVal.local_dependencies);
          }
          if (Array.isArray(newVal.network_dependencies)) {
            newVal.network_dependencies = renameArray(newVal.network_dependencies);
          }
          if (Array.isArray(newVal.network_clients)) {
            newVal.network_clients = renameArray(newVal.network_clients);
          }
          if (Array.isArray(newVal.network_servers)) {
            newVal.network_servers = renameArray(newVal.network_servers);
          }
          if (Array.isArray(newVal.installed_combination)) {
            newVal.installed_combination = newVal.installed_combination.map((comb: any) => {
              if (Array.isArray(comb) && typeof comb[0] === 'string') {
                comb[0] = replacePrefix(comb[0], oldId, newId);
              } else if (typeof comb === 'string') {
                comb = replacePrefix(comb, oldId, newId);
              }
              return comb;
            });
          }

          newSw[newKey] = newVal;
        }
        return { ...comp, installed_software: newSw };
      };

      // update renamed computer itself
      const updatedRenamedComp = updateSoftware(renamedComp as Computer);

      // update all other computers for software referencing the old id
      const updatedComputers: Record<string, any> = {
        ...otherComps,
        [newId]: updatedRenamedComp,
      };
      for (const [cid, comp] of Object.entries(otherComps)) {
        updatedComputers[cid] = updateSoftware(comp as Computer);
      }

      updated.computers = updatedComputers;

      const renameServiceObjects = (obj: any) => {
        if (!obj || typeof obj !== 'object') return obj;
        const renamed: Record<string, any> = {};
        for (const [key, value] of Object.entries(obj)) {
          const newKey = replacePrefix(key, oldId, newId);
          const newVal: any = typeof value === 'object' && value !== null ? { ...value } : value;
          if (newVal) {
            if (typeof newVal.software_idn === 'string') {
              newVal.software_idn = replacePrefix(newVal.software_idn, oldId, newId);
            }
            if (typeof newVal.computer_idn === 'string') {
              newVal.computer_idn = replacePrefix(newVal.computer_idn, oldId, newId);
            }
          }
          renamed[newKey] = newVal;
        }
        return renamed;
      };

      if (updated.services) {
        updated.services = renameServiceObjects(updated.services);
      }
      if (updated.user_services) {
        updated.user_services = renameServiceObjects(updated.user_services);
      }

      // ----- update credentials -----
      if (updated.credentials) {
        const renamedCreds: Record<string, any> = {};
        for (const [cKey, cVal] of Object.entries(updated.credentials)) {
          const newKey = replacePrefix(cKey, oldId, newId);
          const cred: any = { ...(cVal as any) };
          if (typeof cred.idn === 'string') {
            cred.idn = replacePrefix(cred.idn, oldId, newId);
          }
          if (Array.isArray(cred.stored_at)) {
            cred.stored_at = cred.stored_at.map((loc: string) =>
              typeof loc === 'string' ? replacePrefix(loc, oldId, newId) : loc,
            );
          }
          if (Array.isArray(cred.linked_software)) {
            cred.linked_software = cred.linked_software.map((sid: string) =>
              typeof sid === 'string' ? replacePrefix(sid, oldId, newId) : sid,
            );
          }
          renamedCreds[newKey] = cred;
        }
        updated.credentials = renamedCreds;
      }

      // ----- update firewall rules -----
      if (updated.firewall_rules) {
        const renamedRules: Record<string, any> = {};
        for (const [rKey, rVal] of Object.entries(updated.firewall_rules)) {
          const newKey = replacePrefix(rKey, oldId, newId);
          const rule: any = { ...(rVal as any) };
          if (typeof rule.idn === 'string') {
            rule.idn = replacePrefix(rule.idn, oldId, newId);
          }
          if (Array.isArray(rule.from_objects)) {
            rule.from_objects = rule.from_objects.map((obj: string) =>
              typeof obj === 'string' ? replacePrefix(obj, oldId, newId) : obj,
            );
          }
          if (Array.isArray(rule.to_objects)) {
            rule.to_objects = rule.to_objects.map((obj: string) =>
              typeof obj === 'string' ? replacePrefix(obj, oldId, newId) : obj,
            );
          }
          renamedRules[newKey] = rule;
        }
        updated.firewall_rules = renamedRules;
      }
      return updated;
    });
  };

  return (
    <SessionContext.Provider value={{
      graphData,
      setGraphData,
      outputJson,
      setOutputJson,
      files,
      setFiles,
      editableJson,
      setEditableJson,
      updateComputer,
      renameComputerInJson,
    }}>
      {children}
    </SessionContext.Provider>
  );
};

/**
 * useSession
 * Custom hook for accessing the graph context.
 * Throws an error if used outside the `SessionProvider` component.
 */
export const useSession = (): SessionContextType => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};