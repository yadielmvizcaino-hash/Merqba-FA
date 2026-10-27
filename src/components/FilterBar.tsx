import React from 'react';
import { Search, X, ArrowUpDown } from 'lucide-react';
import { StatusFilter, SortOption } from '../types';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (status: StatusFilter) => void;
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
  categories: string[];
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
  totalResults: number;
  totalFiltered: number;
  onResetFilters: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  selectedCategory,
  onCategoryChange,
  categories,
  sortOption,
  onSortChange,
  totalResults,
  totalFiltered,
  onResetFilters,
}) => {
  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'all' || selectedCategory !== 'all';

  return (
    <div className="bg-white border-b border-[#E2E8F0] px-3 sm:px-6 lg:px-8 py-3 sticky top-[102px] z-30 shadow-xs">
      <div className="max-w-[2400px] mx-auto space-y-2.5">
        {/* Row 1: Search input & Sort Dropdown */}
        <div className="flex items-center gap-2">
          {/* Search bar */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7C7482]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar por nombre, ID (#) o SKU..."
              className="w-full pl-9 pr-9 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs sm:text-sm text-[#0F172A] placeholder-[#7C7482] focus:outline-none focus:border-[#5B3294] focus:ring-2 focus:ring-[#5B3294]/15 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#7C7482] hover:text-[#0F172A] cursor-pointer"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort dropdown */}
          <div className="relative shrink-0">
            <div className="flex items-center bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-2.5 py-2 text-xs sm:text-sm">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#5B3294] mr-1.5 shrink-0" />
              <select
                value={sortOption}
                onChange={(e) => onSortChange(e.target.value as SortOption)}
                className="bg-transparent text-[#0F172A] font-medium focus:outline-none cursor-pointer pr-1"
                aria-label="Ordenar productos"
              >
                <option value="name-asc">Nombre (A-Z)</option>
                <option value="name-desc">Nombre (Z-A)</option>
                <option value="price-asc">Precio: menor a mayor</option>
                <option value="price-desc">Precio: mayor a menor</option>
                <option value="stock-asc">Stock: menor a mayor</option>
                <option value="stock-desc">Stock: mayor a menor</option>
                <option value="id-desc">ID: más recientes</option>
                <option value="id-asc">ID: más antiguos</option>
              </select>
            </div>
          </div>
        </div>

        {/* Row 2: Status chips & Categories */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          {/* Status chips */}
          <button
            onClick={() => onStatusFilterChange('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold shrink-0 transition-all cursor-pointer border ${
              statusFilter === 'all'
                ? 'bg-[#5B3294] text-white border-[#5B3294] shadow-xs'
                : 'bg-[#F8FAFC] text-[#475569] border-[#E2E8F0] hover:bg-[#F1F5F9]'
            }`}
          >
            Todos ({totalResults})
          </button>

          <button
            onClick={() => onStatusFilterChange('instock')}
            className={`px-3 py-1.5 rounded-lg font-semibold shrink-0 transition-all cursor-pointer border ${
              statusFilter === 'instock'
                ? 'bg-[#006C49] text-white border-[#006C49] shadow-xs'
                : 'bg-[#F8FAFC] text-[#006C49] border-[#E2E8F0] hover:bg-[#ECFDF5]'
            }`}
          >
            En Stock
          </button>

          <button
            onClick={() => onStatusFilterChange('outofstock')}
            className={`px-3 py-1.5 rounded-lg font-semibold shrink-0 transition-all cursor-pointer border ${
              statusFilter === 'outofstock'
                ? 'bg-[#EF4444] text-white border-[#EF4444] shadow-xs'
                : 'bg-[#F8FAFC] text-[#EF4444] border-[#E2E8F0] hover:bg-[#FEF2F2]'
            }`}
          >
            Agotados
          </button>

          <button
            onClick={() => onStatusFilterChange('lowstock')}
            className={`px-3 py-1.5 rounded-lg font-semibold shrink-0 transition-all cursor-pointer border ${
              statusFilter === 'lowstock'
                ? 'bg-[#F59E0B] text-white border-[#F59E0B] shadow-xs'
                : 'bg-[#F8FAFC] text-[#D97706] border-[#E2E8F0] hover:bg-[#FEF3C7]'
            }`}
          >
            Stock Bajo (≤5)
          </button>

          <button
            onClick={() => onStatusFilterChange('modified')}
            className={`px-3 py-1.5 rounded-lg font-semibold shrink-0 transition-all cursor-pointer border ${
              statusFilter === 'modified'
                ? 'bg-[#43167C] text-white border-[#43167C] shadow-xs'
                : 'bg-[#F8FAFC] text-[#43167C] border-[#E2E8F0] hover:bg-[#F3E8FF]'
            }`}
          >
            Con Cambios
          </button>

          {/* Vertical divider */}
          {categories.length > 0 && <span className="text-[#CBD5E1] mx-1">|</span>}

          {/* Category filter pills */}
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => onCategoryChange(selectedCategory === cat ? 'all' : cat)}
              className={`px-2.5 py-1.5 rounded-lg font-medium shrink-0 transition-all cursor-pointer border ${
                selectedCategory === cat
                  ? 'bg-[#4A4451] text-white border-[#4A4451]'
                  : 'bg-[#F8FAFC] text-[#475569] border-[#E2E8F0] hover:bg-[#F1F5F9]'
              }`}
            >
              {cat}
            </button>
          ))}

          {/* Reset button if active */}
          {hasActiveFilters && (
            <button
              onClick={onResetFilters}
              className="px-2.5 py-1.5 text-xs text-[#EF4444] hover:bg-[#FEF2F2] rounded-lg font-semibold shrink-0 transition-colors ml-auto cursor-pointer"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
