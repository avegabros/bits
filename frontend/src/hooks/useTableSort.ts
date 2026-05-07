import { useState, useMemo } from 'react';

type SortOrder = 'asc' | 'desc' | null;

interface UseTableSortProps<T> {
  initialData?: T[];
}

export function useTableSort<T>({ initialData = [] }: UseTableSortProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);

  const handleSort = (key: string) => {
    let newOrder: SortOrder = 'asc';
    
    // Toggle logic: asc -> desc -> null (reset)
    if (sortKey === key) {
      if (sortOrder === 'asc') newOrder = 'desc';
      else if (sortOrder === 'desc') newOrder = null;
    }

    setSortKey(newOrder ? key : null);
    setSortOrder(newOrder);
  };

  const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  };

  const sortedData = useMemo(() => {
    if (!sortKey || !sortOrder) return initialData;

    return [...initialData].sort((a, b) => {
      let aVal = getNestedValue(a, sortKey);
      let bVal = getNestedValue(b, sortKey);

      // Handle nulls/undefined early
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      // Handle strings for case-insensitive comparison
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      const comparison = aVal > bVal ? 1 : -1;
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [initialData, sortKey, sortOrder]);

  return { sortedData, sortKey, sortOrder, handleSort };
}
