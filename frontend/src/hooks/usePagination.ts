import { useState, useCallback, useMemo } from 'react';
import type { PaginationMeta, PaginatedResponse } from '../types/pagination';

// Re-export types for convenience
export type { PaginationMeta, PaginatedResponse };

interface UsePaginationOptions {
  initialPage?: number;
  pageSize?: number;
}

interface UsePaginationReturn {
  page: number;
  pageSize: number;
  meta: PaginationMeta | null;
  setMeta: (meta: PaginationMeta) => void;
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  firstPage: () => void;
  lastPage: () => void;
  getQueryParams: () => { page: number; pageSize: number };
}

/**
 * Hook para manejar paginación
 * Sincroniza con el tamaño de página de las variables de entorno
 */
export function usePagination(
  options: UsePaginationOptions = {}
): UsePaginationReturn {
  const defaultPageSize = parseInt(
    import.meta.env.VITE_PAGINATION_PAGE_SIZE || '20',
    10
  );

  const [page, setPage] = useState(options.initialPage || 1);
  const [pageSize] = useState(options.pageSize || defaultPageSize);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);

  const goToPage = useCallback((newPage: number) => {
    if (newPage >= 1 && (!meta || newPage <= meta.totalPages)) {
      setPage(newPage);
    }
  }, [meta]);

  const nextPage = useCallback(() => {
    if (meta && meta.hasNextPage) {
      setPage((prev) => prev + 1);
    }
  }, [meta]);

  const previousPage = useCallback(() => {
    if (meta && meta.hasPreviousPage) {
      setPage((prev) => prev - 1);
    }
  }, [meta]);

  const firstPage = useCallback(() => {
    setPage(1);
  }, []);

  const lastPage = useCallback(() => {
    if (meta) {
      setPage(meta.totalPages);
    }
  }, [meta]);

  const getQueryParams = useCallback(() => {
    return { page, pageSize };
  }, [page, pageSize]);

  return useMemo(
    () => ({
      page,
      pageSize,
      meta,
      setMeta,
      goToPage,
      nextPage,
      previousPage,
      firstPage,
      lastPage,
      getQueryParams,
    }),
    [page, pageSize, meta, goToPage, nextPage, previousPage, firstPage, lastPage, getQueryParams]
  );
}
