import { useState, useMemo } from 'react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ScrollArea, ScrollBar } from './ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Skeleton } from './ui/skeleton';
import { AlertTriangle, CheckCircle, Package, Search, X } from 'lucide-react';
import { Medication } from '../types/medication';

interface FormularyViewProps {
  medications: Medication[];
  onMedicationSelect: (medication: Medication) => void;
}

export function FormularyView({ medications, onMedicationSelect }: FormularyViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const med of medications) {
      const cats = Array.isArray(med.category)
        ? med.category
        : med.category
        ? [med.category as unknown as string]
        : [];
      for (const c of cats) {
        const v = (c ?? '').trim();
        if (v) set.add(v);
      }
    }
    return Array.from(set).sort();
  }, [medications]);

  const filteredMedications = useMemo(() => {
    const filtered = medications.filter((med) => {
      const matchesSearch =
        searchTerm === '' ||
        med.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        med.genericName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        med.commonUses.some((use) => use.toLowerCase().includes(searchTerm.toLowerCase()));

      const medCats = Array.isArray(med.category)
        ? med.category
        : med.category
        ? [med.category as unknown as string]
        : [];
      const matchesCategory = categoryFilter === 'all' || medCats.includes(categoryFilter);

      const matchesAvailability =
        availabilityFilter === 'all' ||
        (availabilityFilter === 'available' && med.isAvailable) ||
        (availabilityFilter === 'low' && med.isAvailable && med.currentStock <= med.minStock) ||
        (availabilityFilter === 'out' && !med.isAvailable);

      return matchesSearch && matchesCategory && matchesAvailability;
    });

    // Sort by name, then by dosage form, then by strength (numerically)
    return filtered.sort((a, b) => {
      // First sort by name
      const nameCompare = a.name.localeCompare(b.name);
      if (nameCompare !== 0) return nameCompare;

      // Then sort by dosage form
      const formCompare = a.dosageForm.localeCompare(b.dosageForm);
      if (formCompare !== 0) return formCompare;

      // Finally sort by strength (extract numeric value)
      const extractNumeric = (strength: string) => {
        const match = strength.match(/(\d+\.?\d*)/);
        return match ? parseFloat(match[1]) : 0;
      };

      const strengthA = extractNumeric(a.strength);
      const strengthB = extractNumeric(b.strength);

      return strengthA - strengthB;
    });
  }, [medications, searchTerm, categoryFilter, availabilityFilter]);

  // Pre-filter list for category counts (do not apply category filter yet)
  const medsForCounts = useMemo(() => {
    return medications.filter((med) => {
      const matchesSearch =
        searchTerm === '' ||
        med.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        med.genericName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        med.commonUses.some((use) => use.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesAvailability =
        availabilityFilter === 'all' ||
        (availabilityFilter === 'available' && med.isAvailable) ||
        (availabilityFilter === 'low' && med.isAvailable && med.currentStock <= med.minStock) ||
        (availabilityFilter === 'out' && !med.isAvailable);
      return matchesSearch && matchesAvailability;
    });
  }, [medications, searchTerm, availabilityFilter]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of medsForCounts) {
      const cats = Array.isArray(m.category)
        ? m.category
        : m.category
        ? [m.category as unknown as string]
        : [];
      for (const c of cats) {
        const v = (c ?? '').trim();
        if (!v) continue;
        counts.set(v, (counts.get(v) || 0) + 1);
      }
    }
    return counts;
  }, [medsForCounts]);

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const ca = categoryCounts.get(a) || 0;
      const cb = categoryCounts.get(b) || 0;
      if (cb !== ca) return cb - ca;
      return a.localeCompare(b);
    });
  }, [categories, categoryCounts]);

  const INLINE_LIMIT = 10;
  const topCategories = useMemo(
    () => sortedCategories.slice(0, INLINE_LIMIT),
    [sortedCategories],
  );
  const overflowCategories = useMemo(
    () => sortedCategories.slice(INLINE_LIMIT),
    [sortedCategories],
  );
  const ensureSelectedChip =
    categoryFilter !== 'all' && !topCategories.includes(categoryFilter);

  const getStockStatus = (medication: Medication) => {
    if (!medication.isAvailable) {
      return { status: 'out', color: 'destructive', icon: AlertTriangle };
    }
    if (medication.currentStock <= medication.minStock) {
      return { status: 'low', color: 'secondary', icon: AlertTriangle };
    }
    return { status: 'good', color: 'default', icon: CheckCircle };
  };

  const getStockColor = (medication: Medication) => {
    if (!medication.isAvailable) return 'text-destructive';
    if (medication.currentStock <= medication.minStock) return 'text-orange-600';
    return 'text-green-600';
  };

  const clearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setAvailabilityFilter('all');
  };

  const hasActiveFilters =
    searchTerm !== '' || categoryFilter !== 'all' || availabilityFilter !== 'all';

  // Quick stats
  const stats = useMemo(() => {
    const available = medications.filter((med) => med.isAvailable).length;
    const lowStock = medications.filter(
      (med) => med.isAvailable && med.currentStock <= med.minStock,
    ).length;
    const outOfStock = medications.filter((med) => !med.isAvailable).length;

    return { available, lowStock, outOfStock, total: medications.length };
  }, [medications]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-28" />
          </div>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Skeleton className="h-6 w-12" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <div className="text-center p-3 bg-card border rounded-lg">
          <div className="text-xl sm:text-2xl font-bold text-green-600">{stats.available}</div>
          <div className="text-xs sm:text-sm text-muted-foreground">Available</div>
        </div>
        <div className="text-center p-3 bg-card border rounded-lg">
          <div className="text-xl sm:text-2xl font-bold text-orange-600">{stats.lowStock}</div>
          <div className="text-xs sm:text-sm text-muted-foreground">Low Stock</div>
        </div>
        <div className="text-center p-3 bg-card border rounded-lg">
          <div className="text-xl sm:text-2xl font-bold text-red-600">{stats.outOfStock}</div>
          <div className="text-xs sm:text-sm text-muted-foreground">Out of Stock</div>
        </div>
        <div className="text-center p-3 bg-card border rounded-lg">
          <div className="text-xl sm:text-2xl font-bold text-blue-600">{stats.total}</div>
          <div className="text-xs sm:text-sm text-muted-foreground">Total Items</div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search medications, conditions, or uses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 size-8"
              onClick={() => setSearchTerm('')}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {/* Category chips with overflow "More" */}
          <div className="w-full flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex items-center gap-1 pr-24 sm:pr-28">
                  <Button
                    variant={categoryFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCategoryFilter('all')}
                  >
                    All Categories
                  </Button>
                  {topCategories.map((cat) => (
                    <Button
                      key={cat}
                      variant={categoryFilter === cat ? 'default' : 'outline'}
                      size="sm"
                      title={cat}
                      onClick={() => setCategoryFilter(cat)}
                    >
                      {cat}
                      {categoryCounts.get(cat) ? (
                        <span className="ml-1 text-[10px] opacity-70">{categoryCounts.get(cat)}</span>
                      ) : null}
                    </Button>
                  ))}
                  {ensureSelectedChip && categoryFilter !== 'all' && (
                    <Button
                      key={`sel-${categoryFilter}`}
                      variant={'default'}
                      size="sm"
                      title={categoryFilter}
                      onClick={() => setCategoryFilter(categoryFilter)}
                    >
                      {categoryFilter}
                      {categoryCounts.get(categoryFilter) ? (
                        <span className="ml-1 text-[10px] opacity-70">{categoryCounts.get(categoryFilter)}</span>
                      ) : null}
                    </Button>
                  )}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
            {overflowCategories.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="ml-1 h-8 whitespace-nowrap">
                    More +{overflowCategories.length}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-80 overflow-auto">
                  {overflowCategories.map((cat) => (
                    <DropdownMenuItem key={cat} onClick={() => setCategoryFilter(cat)}>
                      <span className="mr-2">{cat}</span>
                      {categoryCounts.get(cat) ? (
                        <span className="ml-auto text-xs opacity-70">{categoryCounts.get(cat)}</span>
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Status filter + clear */}
          <div className="flex items-center gap-2">
          <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
            <SelectTrigger className="w-full sm:w-[120px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="low">Low Stock</SelectItem>
              <SelectItem value="out">Out of Stock</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="outline" size="icon" onClick={clearFilters} className="flex-shrink-0">
              <X className="size-4" />
            </Button>
          )}
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Package className="size-4" />
          <span>
            {filteredMedications.length} of {medications.length} medications
          </span>
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
            Clear filters
          </Button>
        )}
      </div>

      {/* Medication List */}
      <div className="space-y-2">
        {filteredMedications.map((medication) => {
          const stockStatus = getStockStatus(medication);
          const StockIcon = stockStatus.icon;

          return (
            <Card
              key={medication.id}
              className="cursor-pointer hover:shadow-md transition-all duration-200 active:scale-[0.98]"
              onClick={() => onMedicationSelect(medication)}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium truncate text-sm sm:text-base">
                        {medication.name}
                      </h3>
                      <Badge variant="secondary" className="text-xs flex-shrink-0">
                        {medication.strength}
                      </Badge>
                    </div>

                    <p className="text-xs sm:text-sm text-muted-foreground mb-2 truncate">
                      {medication.genericName} • {medication.dosageForm}
                    </p>

                    <div className="flex flex-wrap items-center gap-1 mb-2">
                      {(Array.isArray(medication.category)
                        ? medication.category
                        : medication.category
                        ? [medication.category as unknown as string]
                        : []
                      ).map((cat) => (
                        <Badge key={cat} variant="outline" className="text-xs">
                          {cat}
                        </Badge>
                      ))}
                      {medication.commonUses.slice(0, 1).map((use) => (
                        <Badge
                          key={use}
                          variant="outline"
                          className="text-xs bg-blue-50 hidden sm:inline-flex"
                        >
                          {use}
                        </Badge>
                      ))}
                      {medication.commonUses.length > 1 && (
                        <span className="text-xs text-muted-foreground">
                          +{medication.commonUses.length - 1} uses
                        </span>
                      )}
                      {!medication.isAvailable && medication.alternatives.length > 0 && (
                        <Badge variant="outline" className="text-xs text-blue-600">
                          {medication.alternatives.length} alternatives
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <div className="flex items-center gap-1">
                      <StockIcon className="size-3 sm:size-4" />
                      <span
                        className={`font-bold text-sm sm:text-base ${getStockColor(medication)}`}
                      >
                        {medication.currentStock}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {medication.isAvailable ? 'Available' : 'Out'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredMedications.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="size-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg mb-2">No medications found</p>
          <p className="text-sm">Try adjusting your search or filters</p>
          {hasActiveFilters && (
            <Button variant="outline" className="mt-4" onClick={clearFilters}>
              Clear all filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
