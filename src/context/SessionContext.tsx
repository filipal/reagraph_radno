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
import type { GraphData, FileItem } from '../types';
import { useState } from 'react';

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
      const { [oldId]: oldComp, ...others } = prev.computers;
      return {
        ...prev,
        computers: {
          ...others,
          [newId]: oldComp,
        },
      };
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