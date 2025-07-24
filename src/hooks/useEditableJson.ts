import { useState, useCallback } from 'react';

export function useEditableJson<T extends Record<string, any>>(originalJson: T) {
  const [editableJson, setEditableJson] = useState<T>(() => structuredClone(originalJson));

  const updateComputer = useCallback((
    id: string,
    updatedData: Partial<T['computers'][string]>,
    oldId?: string,
  ) => {
    setEditableJson(prev => {
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
  }, []);

  const resetChanges = () => {
    setEditableJson(structuredClone(originalJson));
  };

  const exportChanges = () => {
    const blob = new Blob([JSON.stringify(editableJson, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'updated-model.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return { editableJson, updateComputer, resetChanges, exportChanges };
}
