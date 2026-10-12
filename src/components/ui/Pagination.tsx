import React from 'react';
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react';
import Select from './Select';
import { useIsCompactMode } from '../../store/windowModeStore';

export interface PaginationProps {
  currentPage: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100, 200],
  className = '',
}) => {
  // 小窗：条数单独一行 + 页码用「当前/总数」代替页码按钮，控件完整可见、不横向滚动
  const isCompact = useIsCompactMode();
  const totalPages = Math.ceil(total / pageSize);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 7;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  if (total === 0) return null;

  const navButtonClass = `rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-surface-secondary text-content-primary hover:bg-menu-hover flex-shrink-0 ${
    isCompact ? 'p-1.5 text-xs' : 'p-2 text-sm'
  }`;

  return (
    <div className={`mt-2 ${isCompact ? 'flex flex-col items-center gap-1' : 'flex overflow-x-auto scrollbar-hide'} ${className}`}>
      {isCompact && (
        <span className="text-xs text-content-secondary">{`共${total}条`}</span>
      )}

      <div className={`flex items-center ${isCompact ? 'gap-1' : 'gap-2 mx-auto'}`}>
        {!isCompact && (
          <span className="text-content-secondary text-sm whitespace-nowrap flex-shrink-0">
            {`共${total}条`}
          </span>
        )}

        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          title="首页"
          className={navButtonClass}
        >
          <ChevronsLeft size={16} />
        </button>

        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          title="上一页"
          className={navButtonClass}
        >
          <ChevronLeft size={16} />
        </button>

        {isCompact ? (
          <span className="px-1 text-xs text-content-secondary whitespace-nowrap">
            {`${currentPage} / ${totalPages}`}
          </span>
        ) : (
          <div className="flex items-center gap-1 flex-shrink-0">
            {getPageNumbers().map((page, index) => (
              <React.Fragment key={index}>
                {typeof page === 'number' ? (
                  <button
                    onClick={() => onPageChange(page)}
                    className={`w-8 h-8 text-sm rounded-md transition-colors flex-shrink-0 ${
                      currentPage === page 
                        ? 'bg-gray-800 dark:bg-yellow-500 text-white' 
                        : 'bg-surface-secondary text-content-primary hover:bg-menu-hover'
                    }`}
                  >
                    {page}
                  </button>
                ) : (
                  <span className="px-2 text-content-secondary text-sm">...</span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          title="下一页"
          className={navButtonClass}
        >
          <ChevronRight size={16} />
        </button>

        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          title="尾页"
          className={navButtonClass}
        >
          <ChevronsRight size={16} />
        </button>

        <Select
          value={String(pageSize)}
          onChange={(v) => onPageSizeChange(Number(v))}
          options={pageSizeOptions.map((size) => ({ value: String(size), label: String(size) }))}
          className="px-2 py-1 text-sm border-content rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 bg-surface-secondary text-content-primary"
          size="sm"
        />
      </div>
    </div>
  );
};

export default Pagination;
