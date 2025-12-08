import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { ScrollArea, ScrollBar } from './ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  AlertTriangle,
  CheckCircle,
  Edit,
  Package,
  Plus,
  Search,
  TrendingDown,
  Trash2,
  Upload,
} from 'lucide-react';
import { Medication, User, InventoryItem } from '../types/medication';
import { formatDateEST } from '../utils/timezone';
import { BulkImportDialog, ImportedMedicationRow } from './BulkImportDialog';
import { AddLotDialog } from './AddLotDialog';
import { MedicationService } from '../services/medicationService';
// Temporarily disabled problematic sonner import
// import { toast } from 'sonner@2.0.3';

interface StockManagementProps {
  medications: Medication[];
  inventory: InventoryItem[];
  currentUser: User;
  onUpdateLot: (lotId: string, newQuantity: number, reason: string) => Promise<void>;
  onAddLot: (lot: Omit<InventoryItem, 'id' | 'isExpired'>) => Promise<void>;
  onDeleteMedication?: (medicationId: string) => Promise<void>;
}

export function StockManagement({
  medications,
  inventory,
  currentUser,
  onUpdateLot,
  onAddLot,
  onDeleteMedication,
}: StockManagementProps) {
  const [medicationList, setMedicationList] = useState<Medication[]>(medications);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>(inventory);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [categorySearch, setCategorySearch] = useState<string>('');
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);
  const [newQuantity, setNewQuantity] = useState('');
  const [updateReason, setUpdateReason] = useState('');
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isAddLotDialogOpen, setIsAddLotDialogOpen] = useState(false);
  const [selectedMedicationForLot, setSelectedMedicationForLot] = useState<Medication | null>(null);
  const [isUpdatingStock, setIsUpdatingStock] = useState(false);
  const [selectedLotId, setSelectedLotId] = useState<string>('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [medicationToDelete, setMedicationToDelete] = useState<Medication | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setMedicationList(medications);
  }, [medications]);

  useEffect(() => {
    setInventoryList(inventory);
  }, [inventory]);

  const refreshMedicationAndInventory = useCallback(async () => {
    try {
      const [latestMeds, latestInventory] = await Promise.all([
        MedicationService.getAllMedications(),
        MedicationService.getAllInventory(),
      ]);
      setMedicationList(latestMeds);
      setInventoryList(latestInventory);
    } catch (error) {
      console.error('Failed to refresh medication or inventory data:', error);
    }
  }, []);

  const statusOptions = [
    { value: 'all', label: 'All Items' },
    { value: 'low', label: 'Low Stock' },
    { value: 'out', label: 'Out of Stock' },
    { value: 'good', label: 'Good Stock' },
  ];

  const reasonOptions = [
    'Received new shipment',
    'Dispensed to patient',
    'Expired medications removed',
    'Damaged items removed',
    'Inventory count correction',
    'Other',
  ];

  const filteredMedications = useMemo(() => {
    let filtered = medicationList;

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter((med) => {
        const cats = Array.isArray(med.category) ? med.category : [];
        const catsText = cats.join(' ').toLowerCase();
        return (
          med.name.toLowerCase().includes(q) ||
          med.genericName.toLowerCase().includes(q) ||
          catsText.includes(q)
        );
      });
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((med) => {
        switch (statusFilter) {
          case 'low':
            return med.isAvailable && med.currentStock <= med.minStock;
          case 'out':
            return !med.isAvailable;
          case 'good':
            return med.isAvailable && med.currentStock > med.minStock;
          default:
            return true;
        }
      });
    }

    return filtered.sort((a, b) => {
      // Sort by urgency: out of stock first, then low stock, then by name
      if (!a.isAvailable && b.isAvailable) return -1;
      if (a.isAvailable && !b.isAvailable) return 1;

      const aLow = a.currentStock <= a.minStock;
      const bLow = b.currentStock <= b.minStock;
      if (aLow && !bLow) return -1;
      if (!aLow && bLow) return 1;

      return a.name.localeCompare(b.name);
    });
  }, [medicationList, searchTerm, statusFilter]);

  // Derive category lists from medications
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const med of medicationList) {
      const cats = Array.isArray(med.category) ? med.category : [];
      for (const c of cats) {
        const v = (c ?? '').trim();
        if (v) set.add(v);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [medicationList]);

  const visibleCategories = useMemo(() => {
    if (!categorySearch) return allCategories;
    const q = categorySearch.toLowerCase();
    return allCategories.filter((c) => c.toLowerCase().includes(q));
  }, [allCategories, categorySearch]);

  // Category counts based on filteredMedications (before category filter)
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of filteredMedications) {
      const cats = Array.isArray(m.category) ? m.category : [];
      for (const c of cats) {
        const v = (c ?? '').trim();
        if (!v) continue;
        counts.set(v, (counts.get(v) || 0) + 1);
      }
    }
    return counts;
  }, [filteredMedications]);

  const sortedVisibleCategories = useMemo(() => {
    return [...visibleCategories].sort((a, b) => {
      const ca = categoryCounts.get(a) || 0;
      const cb = categoryCounts.get(b) || 0;
      if (cb !== ca) return cb - ca;
      return a.localeCompare(b);
    });
  }, [visibleCategories, categoryCounts]);

  const INLINE_LIMIT = 10;
  const topCategories = useMemo(
    () => sortedVisibleCategories.slice(0, INLINE_LIMIT),
    [sortedVisibleCategories],
  );
  const overflowCategories = useMemo(
    () => sortedVisibleCategories.slice(INLINE_LIMIT),
    [sortedVisibleCategories],
  );
  const ensureSelectedChip = activeCategory !== 'All' && !topCategories.includes(activeCategory);

  useEffect(() => {
    if (activeCategory !== 'All' && !visibleCategories.includes(activeCategory)) {
      setActiveCategory('All');
    }
  }, [visibleCategories, activeCategory]);

  const visibleMedications = useMemo(() => {
    if (activeCategory === 'All') return filteredMedications;
    return filteredMedications.filter((m) =>
      (Array.isArray(m.category) ? m.category : [])
        .map((c) => (c ?? '').trim())
        .includes(activeCategory),
    );
  }, [filteredMedications, activeCategory]);

  const medicationLots = useMemo(() => {
    if (!selectedMedication) return [] as InventoryItem[];
    return inventoryList
      .filter((lot) => lot.medicationId === selectedMedication.id)
      .sort((a, b) => a.expirationDate.getTime() - b.expirationDate.getTime());
  }, [inventoryList, selectedMedication]);

  const selectedLot = useMemo(() => {
    if (!selectedLotId) return null;
    return medicationLots.find((lot) => lot.id === selectedLotId) || null;
  }, [medicationLots, selectedLotId]);

  const getStockStatus = (medication: Medication) => {
    if (!medication.isAvailable) {
      return { status: 'Out', color: 'destructive', icon: AlertTriangle };
    }
    if (medication.currentStock <= medication.minStock) {
      return { status: 'Low', color: 'secondary', icon: AlertTriangle };
    }
    return { status: 'Good', color: 'default', icon: CheckCircle };
  };

  const handleUpdateStock = async () => {
    if (!selectedMedication || !newQuantity || !updateReason) {
      console.log('Please fill in all required fields');
      return;
    }

    const quantity = parseInt(newQuantity);
    if (isNaN(quantity) || quantity < 0) {
      console.log('Please enter a valid quantity');
      return;
    }

    if (!selectedLotId) {
      console.log('Please select an inventory lot to update');
      return;
    }

    const lotExists = inventoryList.some((item) => item.id === selectedLotId);
    if (!lotExists) {
      console.log('Selected inventory lot not found');
      return;
    }

    setIsUpdatingStock(true);
    try {
      await onUpdateLot(selectedLotId, quantity, updateReason);
      setIsUpdateDialogOpen(false);
      setSelectedMedication(null);
      setNewQuantity('');
      setUpdateReason('');
      setSelectedLotId('');
    } catch (error) {
      console.error('Failed to update stock:', error);
    } finally {
      setIsUpdatingStock(false);
    }
  };

  const openUpdateDialog = (medication: Medication) => {
    setSelectedMedication(medication);
    setSelectedMedicationForLot(medication);
    const medLots = inventoryList
      .filter((lot) => lot.medicationId === medication.id)
      .sort((a, b) => a.expirationDate.getTime() - b.expirationDate.getTime());
    const defaultLot = medLots[0];
    setSelectedLotId(defaultLot ? defaultLot.id : '');
    setNewQuantity(defaultLot ? defaultLot.quantity.toString() : '');
    setUpdateReason('');
    setIsUpdateDialogOpen(true);
  };

  const handleBulkImport = async (items: ImportedMedicationRow[]) => {
    try {
      // Call the database service to bulk import inventory
      const result = await MedicationService.bulkImportInventory(
        items.map((item) => ({
          name: item.name,
          strength: item.strength,
          quantity: item.quantity,
          lotNumber: item.lotNumber,
          expirationDate: item.expirationDate,
          dosageForm: item.dosageForm || 'tablet', // Use extracted dosage form, default to tablet
        })),
      );

      if (result.success > 0) {
        alert(
          `Successfully imported ${result.success} items!\n${result.failed > 0 ? `Failed: ${result.failed} items` : ''}`,
        );
        await refreshMedicationAndInventory();
        setIsImportDialogOpen(false);
      } else {
        alert(`Import failed. ${result.errors.join('\n')}`);
      }
    } catch (error) {
      console.error('Bulk import error:', error);
      alert(`Import failed: ${error}`);
    }
  };

  const handleDeleteMedication = async () => {
    if (!medicationToDelete || !onDeleteMedication) return;

    setIsDeleting(true);
    try {
      await onDeleteMedication(medicationToDelete.id);
      setIsDeleteDialogOpen(false);
      setMedicationToDelete(null);
      setMedicationList((prev) => prev.filter((med) => med.id !== medicationToDelete.id));
      setInventoryList((prev) => prev.filter((lot) => lot.medicationId !== medicationToDelete.id));
      if (selectedMedication?.id === medicationToDelete.id) {
        setSelectedMedication(null);
      }
      if (selectedMedicationForLot?.id === medicationToDelete.id) {
        setSelectedMedicationForLot(null);
      }
    } catch (error) {
      console.error('Failed to delete medication:', error);
      alert('Failed to delete medication. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const openDeleteDialog = (medication: Medication) => {
    setMedicationToDelete(medication);
    setIsDeleteDialogOpen(true);
  };

  const lowStockCount = medicationList.filter(
    (med) => med.isAvailable && med.currentStock <= med.minStock,
  ).length;
  const outOfStockCount = medicationList.filter((med) => !med.isAvailable).length;
  const totalMedications = medicationList.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <Button
          variant="default"
          onClick={() => {
            setSelectedMedicationForLot(null);
            setIsAddLotDialogOpen(true);
          }}
          className="gap-2 w-full"
        >
          <Plus className="size-4 flex-shrink-0" />
          <span className="truncate">Add New Lot</span>
        </Button>
        <Button
          variant="default"
          onClick={() => setIsImportDialogOpen(true)}
          className="gap-2 w-full"
        >
          <Upload className="size-4 flex-shrink-0" />
          <span className="truncate">Bulk Import</span>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="size-8 text-red-600" />
              <div>
                <p className="text-2xl font-bold">{outOfStockCount}</p>
                <p className="text-sm text-muted-foreground">Out of Stock</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingDown className="size-8 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">{lowStockCount}</p>
                <p className="text-sm text-muted-foreground">Low Stock</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Package className="size-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{totalMedications}</p>
                <p className="text-sm text-muted-foreground">Total Items</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search medications..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              backgroundColor: '#86efac', // Tailwind's green-300 hex
              borderColor: '#22c55e', // Tailwind's green-500
              color: '#064e3b', // Tailwind's green-900 (text)
            }}
            className="pl-10 border-2 focus:ring-2 focus:ring-green-600 focus:border-green-600"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Category Search + Chips */}
      <div className="space-y-3">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search categories..."
            value={categorySearch}
            onChange={(e) => setCategorySearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="w-full flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="w-full overflow-x-auto whitespace-nowrap">
              <div className="inline-flex items-center gap-1 pr-24 sm:pr-28">
                <Button
                  variant={activeCategory === 'All' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveCategory('All')}
                >
                  All
                </Button>
                {topCategories.map((cat) => (
                  <Button
                    key={cat}
                    variant={activeCategory === cat ? 'default' : 'outline'}
                    size="sm"
                    title={cat}
                    onClick={() => setActiveCategory(cat)}
                  >
                    {cat}
                    {categoryCounts.get(cat) ? (
                      <span className="ml-1 text-[10px] opacity-70">{categoryCounts.get(cat)}</span>
                    ) : null}
                  </Button>
                ))}
                {ensureSelectedChip && activeCategory !== 'All' && (
                  <Button
                    key={`sel-${activeCategory}`}
                    variant={'default'}
                    size="sm"
                    title={activeCategory}
                    onClick={() => setActiveCategory(activeCategory)}
                  >
                    {activeCategory}
                    {categoryCounts.get(activeCategory) ? (
                      <span className="ml-1 text-[10px] opacity-70">
                        {categoryCounts.get(activeCategory)}
                      </span>
                    ) : null}
                  </Button>
                )}
              </div>
            </div>
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
                  <DropdownMenuItem key={cat} onClick={() => setActiveCategory(cat)}>
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
      </div>

      {/* Stock Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medication</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Current Stock</TableHead>
                  <TableHead>Min/Max</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleMedications.map((medication) => {
                  const stockStatus = getStockStatus(medication);
                  const StatusIcon = stockStatus.icon;

                  return (
                    <TableRow key={medication.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{medication.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {medication.strength} • {medication.dosageForm}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(Array.isArray(medication.category) ? medication.category : []).map(
                            (cat) => (
                              <Badge key={cat} variant="outline" className="text-xs">
                                {cat}
                              </Badge>
                            ),
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold">{medication.currentStock}</span>
                          {medication.currentStock <= medication.minStock && (
                            <TrendingDown className="size-4 text-orange-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          <span>Min: {medication.minStock}</span>
                          <br />
                          <span>Max: {medication.maxStock}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StatusIcon className="size-4" />
                          <Badge variant={stockStatus.color as any}>{stockStatus.status}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {medication.lastUpdated.toLocaleDateString()}
                          <br />
                          {medication.lastUpdated.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openUpdateDialog(medication)}
                          >
                            <Edit className="size-4 mr-1" />
                            Update
                          </Button>
                          {onDeleteMedication && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDeleteDialog(medication)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {filteredMedications.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="size-12 mx-auto mb-2 opacity-50" />
              <p>No medications found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Update Stock Dialog */}
      <Dialog
        open={isUpdateDialogOpen}
        onOpenChange={(open) => {
          setIsUpdateDialogOpen(open);
          if (!open) {
            setSelectedMedication(null);
            setSelectedLotId('');
            setNewQuantity('');
            setUpdateReason('');
            setIsUpdatingStock(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Stock - {selectedMedication?.name}</DialogTitle>
          </DialogHeader>
          {selectedMedication && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm font-medium">Current Information</p>
                <p className="text-sm text-muted-foreground">
                  Current Stock: {selectedMedication.currentStock} • Min:{' '}
                  {selectedMedication.minStock} • Max: {selectedMedication.maxStock}
                </p>
                {selectedLot && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Selected Lot: {selectedLot.lotNumber} • Expires{' '}
                    {formatDateEST(selectedLot.expirationDate)} • Current Quantity:{' '}
                    {selectedLot.quantity}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lot-select">Inventory lot *</Label>
                {medicationLots.length > 0 ? (
                  <Select
                    value={selectedLotId}
                    onValueChange={(value: string) => {
                      setSelectedLotId(value);
                      const lot = medicationLots.find((item) => item.id === value);
                      setNewQuantity(lot ? lot.quantity.toString() : '');
                    }}
                    disabled={isUpdatingStock}
                  >
                    <SelectTrigger className="h-auto py-3">
                      <SelectValue placeholder="Choose a lot" />
                    </SelectTrigger>
                    <SelectContent>
                      {medicationLots.map((lot) => (
                        <SelectItem key={lot.id} value={lot.id}>
                          <div className="flex flex-col text-left">
                            <span className="font-medium text-sm">Lot {lot.lotNumber}</span>
                            <span className="text-xs text-muted-foreground">
                              Expires {formatDateEST(lot.expirationDate)} • Quantity {lot.quantity}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground space-y-2">
                    <p>
                      No inventory lots available for this medication. Add a lot before updating its
                      quantity.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        if (selectedMedication) {
                          setSelectedMedicationForLot(selectedMedication);
                        }
                        setIsUpdateDialogOpen(false);
                        setIsAddLotDialogOpen(true);
                      }}
                    >
                      Add New Lot
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-quantity">Set quantity for selected lot *</Label>
                <Input
                  id="new-quantity"
                  type="number"
                  min="0"
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(e.target.value)}
                  disabled={!selectedLot || isUpdatingStock}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Update *</Label>
                <Select
                  value={updateReason}
                  onValueChange={setUpdateReason}
                  disabled={!selectedLot}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {reasonOptions.map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {reason}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleUpdateStock}
                  className="flex-1"
                  disabled={isUpdatingStock || !selectedLot || !newQuantity || !updateReason}
                >
                  {isUpdatingStock ? 'Updating...' : 'Update Stock'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsUpdateDialogOpen(false)}
                  disabled={isUpdatingStock}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <BulkImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onImport={handleBulkImport}
      />

      {/* Add Lot Dialog */}
      <AddLotDialog
        open={isAddLotDialogOpen}
        onOpenChange={setIsAddLotDialogOpen}
        medication={selectedMedicationForLot}
        medications={medicationList}
        onAddLot={onAddLot}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) {
            setMedicationToDelete(null);
            setIsDeleting(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Medication</DialogTitle>
          </DialogHeader>
          {medicationToDelete && (
            <div className="space-y-4">
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm font-medium mb-2">
                  Are you sure you want to delete this medication?
                </p>
                <p className="text-sm font-medium">
                  {medicationToDelete.name} - {medicationToDelete.strength} (
                  {medicationToDelete.dosageForm})
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  This will permanently remove the medication and all its inventory lots. This
                  action cannot be undone.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={handleDeleteMedication}
                  className="flex-1"
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Medication'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsDeleteDialogOpen(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
