import type { PaginationMeta } from '../types/pagination';

interface PaginationControlsProps {
  meta: PaginationMeta | null;
  onPageChange: (page: number) => void;
  onNext: () => void;
  onPrevious: () => void;
  onFirst?: () => void;
  onLast?: () => void;
  showFirstLast?: boolean;
}

export default function PaginationControls({
  meta,
  onPageChange,
  onNext,
  onPrevious,
  onFirst,
  onLast,
  showFirstLast = true,
}: PaginationControlsProps) {
  if (!meta || meta.totalItems === 0) {
    return null;
  }

  const { currentPage, totalPages, totalItems, pageSize, hasNextPage, hasPreviousPage } = meta;

  // Calculate item range for current page
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5; // Max page buttons to show

    if (totalPages <= maxVisible + 2) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first, last, and pages around current
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="pagination-container">
      {/* Info text */}
      <div className="pagination-info">
        Mostrando {startItem}-{endItem} de {totalItems} resultados
      </div>

      {/* Controls */}
      <div className="pagination-controls">
        {/* First page button */}
        {showFirstLast && onFirst && (
          <button
            onClick={onFirst}
            disabled={!hasPreviousPage}
            className="pagination-btn pagination-btn-edge"
            aria-label="Primera página"
            title="Primera página"
          >
            ««
          </button>
        )}

        {/* Previous button */}
        <button
          onClick={onPrevious}
          disabled={!hasPreviousPage}
          className="pagination-btn"
          aria-label="Página anterior"
          title="Página anterior"
        >
          ‹
        </button>

        {/* Page numbers */}
        {pageNumbers.map((pageNum, index) => {
          if (pageNum === '...') {
            return (
              <span key={`ellipsis-${index}`} className="pagination-ellipsis">
                ...
              </span>
            );
          }

          const isActive = pageNum === currentPage;
          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum as number)}
              className={`pagination-btn pagination-btn-number ${isActive ? 'active' : ''}`}
              aria-label={`Página ${pageNum}`}
              aria-current={isActive ? 'page' : undefined}
              disabled={isActive}
            >
              {pageNum}
            </button>
          );
        })}

        {/* Next button */}
        <button
          onClick={onNext}
          disabled={!hasNextPage}
          className="pagination-btn"
          aria-label="Página siguiente"
          title="Página siguiente"
        >
          ›
        </button>

        {/* Last page button */}
        {showFirstLast && onLast && (
          <button
            onClick={onLast}
            disabled={!hasNextPage}
            className="pagination-btn pagination-btn-edge"
            aria-label="Última página"
            title="Última página"
          >
            »»
          </button>
        )}
      </div>

      <style>{`
        .pagination-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          margin-top: 2rem;
          padding: 1rem 0;
        }

        .pagination-info {
          font-size: 0.875rem;
          color: var(--text-muted, #64748b);
          font-weight: 500;
        }

        .pagination-controls {
          display: flex;
          gap: 0.5rem;
          align-items: center;
          flex-wrap: wrap;
          justify-content: center;
        }

        .pagination-btn {
          min-width: 44px;
          min-height: 44px;
          padding: 0.5rem 0.75rem;
          border: 1px solid var(--border-color, #e2e8f0);
          background: white;
          color: var(--text-primary, #1e293b);
          border-radius: 0.5rem;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .pagination-btn:hover:not(:disabled) {
          background: var(--brand-blue, #3b82f6);
          color: white;
          border-color: var(--brand-blue, #3b82f6);
        }

        .pagination-btn:focus-visible {
          outline: 2px solid var(--brand-blue, #3b82f6);
          outline-offset: 2px;
        }

        .pagination-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .pagination-btn.active {
          background: var(--brand-blue, #3b82f6);
          color: white;
          border-color: var(--brand-blue, #3b82f6);
          font-weight: 600;
        }

        .pagination-btn-number {
          min-width: 44px;
        }

        .pagination-btn-edge {
          font-weight: 600;
        }

        .pagination-ellipsis {
          padding: 0 0.5rem;
          color: var(--text-muted, #64748b);
          user-select: none;
        }

        @media (max-width: 640px) {
          .pagination-container {
            gap: 0.75rem;
          }

          .pagination-controls {
            gap: 0.25rem;
          }

          .pagination-btn {
            min-width: 40px;
            min-height: 40px;
            padding: 0.5rem;
            font-size: 0.8125rem;
          }

          .pagination-info {
            font-size: 0.8125rem;
            text-align: center;
          }

          .pagination-btn-edge {
            display: none;
          }
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          .pagination-btn {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}
