import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { FormularyView } from './components/FormularyView';
import { MedicationDetail } from './components/MedicationDetail';
import { DispensingLog } from './components/DispensingLog';
import { EditDispensingRecordDialog } from './components/EditDispensingRecordDialog';
import { StockManagement } from './components/StockManagement';
import { OfflineSync } from './components/OfflineSync';
import { LoginPage } from './components/LoginPage';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './components/ui/sheet';
import { Toaster } from './components/ui/sonner';
import { Pill, ClipboardList, Settings, User, Menu, LogOut, CheckCircle, XCircle, RotateCcw, AlertTriangle } from 'lucide-react';
import { Medication, DispensingRecord, InventoryItem, User as UserType } from './types/medication';
import { MedicationService } from './services/medicationService';
import { syncService } from './services/syncService';
import { OfflineStore } from './utils/offlineStore';
import { showSuccessToast, showErrorToast } from './utils/toastUtils';
import { formatDateEST } from './utils/timezone';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loggedInNetId, setLoggedInNetId] = useState('');
  const [currentView, setCurrentView] = useState<'formulary' | 'detail'>('formulary');
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [dispensingRecords, setDispensingRecords] = useState<DispensingRecord[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [activeTab, setActiveTab] = useState('formulary');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<DispensingRecord | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  // State for undo functionality
  const [recentDispensingRecords, setRecentDispensingRecords] = useState<DispensingRecord[]>([]);
  const [recentInventoryChanges, setRecentInventoryChanges] = useState<{recordId: string, inventoryId: string, previousQuantity: number}[]>([]);

  // Load initial data from Supabase (online) or IndexedDB (offline fallback)
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        let medicationsData: Medication[] = [];
        let dispensingData: DispensingRecord[] = [];
        let inventoryData: InventoryItem[] = [];
        let usersData: UserType[] = [];

        if (navigator.onLine) {
          // Online: fetch fresh and prime cache; start realtime
          [medicationsData, dispensingData, inventoryData, usersData] = await Promise.all([
            MedicationService.getAllMedications(),
            MedicationService.getAllDispensingRecords(),
            MedicationService.getAllInventory(),
            MedicationService.getAllUsers()
          ]);
          syncService.startMedicationsRealtime();
        } else {
          // Offline: use cached meds and empty logs/inventory/users (or keep last)
          medicationsData = await OfflineStore.getAllMedications();
          dispensingData = [];
          inventoryData = [];
          usersData = [];
        }

        setMedications(medicationsData);
        setDispensingRecords(dispensingData);
        setInventory(inventoryData);
        setUsers(usersData);

        // Set default user (first pharmacy staff or first user)
        const defaultUser = usersData.find(u => u.role === 'pharmacy_staff') || usersData[0];
        if (defaultUser) {
          setCurrentUser(defaultUser);
        }

        setPendingChanges(0);
      } catch (err) {
        console.error('Error loading data:', err);
        // Offline fallback if network error: try cache
        try {
          const cachedMeds = await OfflineStore.getAllMedications();
          if (cachedMeds.length > 0) {
            setMedications(cachedMeds);
            setDispensingRecords([]);
            setInventory([]);
            setUsers([]);
            setCurrentUser(null);
            setError(null);
          } else {
            const message = err instanceof Error ? err.message : 'Failed to load data from database. Please try again.';
            setError(message);
          }
        } catch (e) {
          const message = err instanceof Error ? err.message : 'Failed to load data from database. Please try again.';
          setError(message);
        }
      } finally {
        setIsLoading(false);
      }
    };

  loadData();
    // Initialize pending changes count from offline queue
    (async () => {
      const count = await OfflineStore.getPendingCount();
      setPendingChanges(count);
    })();
    // Update pending count on connectivity changes
    const updatePending = async () => setPendingChanges(await OfflineStore.getPendingCount());
    window.addEventListener('online', updatePending);
    window.addEventListener('offline', updatePending);
    return () => {
      window.removeEventListener('online', updatePending);
      window.removeEventListener('offline', updatePending);
      syncService.stopRealtime();
    }
  }, []);

  const handleLogin = (netId: string) => {
    setLoggedInNetId(netId);
    setIsLoggedIn(true);
    console.log(`User logged in: ${netId}`);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setLoggedInNetId('');
    setCurrentView('formulary');
    setSelectedMedication(null);
    setActiveTab('formulary');
    console.log('User logged out');
  };

  const handleMedicationSelect = (medication: Medication) => {
    setSelectedMedication(medication);
    setCurrentView('detail');
  };

  const handleBackToFormulary = () => {
    setCurrentView('formulary');
    setSelectedMedication(null);
  };

  const handleDispense = async (record: Omit<DispensingRecord, 'id'>) => {
    try {
      if (navigator.onLine) {
        // Online: write-through to server then update local/cache
        const newRecord = await MedicationService.createDispensingRecord(record);
        setDispensingRecords((prev: DispensingRecord[]) => [newRecord, ...prev]);

        // Store for undo functionality
        const inventoryLot = inventory.find(inv => inv.lotNumber === record.lotNumber && inv.medicationId === record.medicationId);
        const previousQuantity = inventoryLot?.quantity || 0;
        
        if (inventoryLot) {
          const newQuantity = Math.max(0, inventoryLot.quantity - record.quantity);
          await MedicationService.updateInventoryItem(inventoryLot.id, { quantity: newQuantity });
          
          // Track changes for undo
          const inventoryChangeRecord = {
            recordId: newRecord.id,
            inventoryId: inventoryLot.id,
            previousQuantity: previousQuantity
          };
          
          setRecentInventoryChanges(prev => [...prev, inventoryChangeRecord]);
          
          // Update local state
          const newStock = Math.max(0, (medications.find((m: Medication) => m.id === record.medicationId)?.currentStock || 0) - record.quantity);
          setMedications((prev: Medication[]) => prev.map((med: Medication) => med.id === record.medicationId ? { ...med, currentStock: newStock, isAvailable: newStock > 0, lastUpdated: new Date() } : med));
          setInventory(prev => prev.map(inv => inv.lotNumber === record.lotNumber ? { ...inv, quantity: Math.max(0, inv.quantity - record.quantity) } : inv));
          
          // Add to recent records for undo
          setRecentDispensingRecords(prev => [newRecord, ...prev].slice(0, 5)); // Keep only last 5 for undo

          // Show success toast with undo option
          showSuccessToast(
            `Dispensed ${record.quantity} ${record.medicationName} to ${record.patientInitials}`,
            `Lot: ${record.lotNumber} • Provider: ${record.dispensedBy}`,
            {
              label: "Withdraw",
              onClick: () => handleUndoDispensing(newRecord.id, newRecord, inventoryChangeRecord)
            }
          );
        }

      } else {
        // Offline: queue and update local stock/cache immediately
        await syncService.queueOfflineDispense(record);
        setMedications((prev: Medication[]) => prev.map((med: Medication) => med.id === record.medicationId ? { ...med, currentStock: Math.max(0, med.currentStock - record.quantity), isAvailable: med.currentStock - record.quantity > 0, lastUpdated: new Date() } : med));
        setInventory(prev => prev.map(inv => inv.lotNumber === record.lotNumber ? { ...inv, quantity: Math.max(0, inv.quantity - record.quantity) } : inv));
        setPendingChanges((prev: number) => prev + 1);
        
        // Show offline success message
        showSuccessToast(
          `Dispensing queued for sync: ${record.quantity} ${record.medicationName}`,
          `Will sync when online • Patient: ${record.patientInitials}`
        );
      }
    } catch (err) {
      console.error('Error dispensing medication:', err);
      setError('Failed to record dispensing. Please try again.');
      showErrorToast(
        'Failed to dispense medication',
        'Please try again or contact support if the issue persists.'
      );
    }
  };

  // Undo/Withdraw dispensing function
  const handleUndoDispensing = async (
    recordId: string, 
    recordToUndo?: DispensingRecord, 
    inventoryChange?: {recordId: string, inventoryId: string, previousQuantity: number}
  ) => {
    try {
      // Use provided record or find it in state
      const targetRecord = recordToUndo || recentDispensingRecords.find(r => r.id === recordId);
      const targetInventoryChange = inventoryChange || recentInventoryChanges.find(ic => ic.recordId === recordId);
      
      if (!targetRecord) {
        showErrorToast('Cannot withdraw: Record not found');
        return;
      }

      if (navigator.onLine) {
        // Delete the dispensing record from database
        await MedicationService.deleteDispensingRecord(recordId);
        
        // Restore inventory quantity if we have the change record
        if (targetInventoryChange) {
          await MedicationService.updateInventoryItem(targetInventoryChange.inventoryId, { 
            quantity: targetInventoryChange.previousQuantity 
          });
        }

        // Update local state - remove the record
        setDispensingRecords(prev => prev.filter(r => r.id !== recordId));
        
        // Restore medication stock
        setMedications(prev => prev.map(med => 
          med.id === targetRecord.medicationId 
            ? { ...med, currentStock: med.currentStock + targetRecord.quantity, isAvailable: true, lastUpdated: new Date() }
            : med
        ));
        
        // Restore inventory quantity
        setInventory(prev => prev.map(inv => 
          inv.lotNumber === targetRecord.lotNumber 
            ? { ...inv, quantity: inv.quantity + targetRecord.quantity }
            : inv
        ));

        // Clean up tracking arrays
        setRecentDispensingRecords(prev => prev.filter(r => r.id !== recordId));
        setRecentInventoryChanges(prev => prev.filter(ic => ic.recordId !== recordId));

        showSuccessToast(
          'Successfully withdrew dispensing record',
          `Restored ${targetRecord.quantity} ${targetRecord.medicationName} to inventory`
        );
      } else {
        showErrorToast(
          'Cannot withdraw while offline',
          'Please connect to the internet to withdraw dispensing records'
        );
      }
    } catch (err) {
      console.error('Error undoing dispensing:', err);
      showErrorToast(
        'Failed to withdraw dispensing record',
        'Please try again or contact support'
      );
    }
  };

  const handleEditDispensingRecord = (record: DispensingRecord) => {
    setEditingRecord(record);
    setIsEditDialogOpen(true);
  };

  const handleSaveEditedRecord = async (id: string, updates: Partial<Omit<DispensingRecord, 'id'>>) => {
    try {
      const updatedRecord = await MedicationService.updateDispensingRecord(id, updates);
      setDispensingRecords(prev => prev.map(rec => rec.id === id ? updatedRecord : rec));
      
      showSuccessToast(
        'Updated dispensing record',
        `Changes saved for ${updatedRecord.medicationName} • Patient: ${updatedRecord.patientInitials}`
      );
    } catch (err) {
      console.error('Error updating dispensing record:', err);
      showErrorToast(
        'Failed to update dispensing record',
        'Please try again or contact support.'
      );
      throw err; // Re-throw to let dialog handle error display
    }
  };

  const handleAddLot = async (lot: Omit<InventoryItem, 'id' | 'isExpired'>) => {
    try {
      const newLot = await MedicationService.createInventoryItem(lot);
      setInventory(prev => [...prev, newLot]);

      // Reload medications to update total stock count
      const updatedMedications = await MedicationService.getAllMedications();
      setMedications(updatedMedications);
      
      showSuccessToast(
        'Added new inventory lot',
        `Lot ${newLot.lotNumber} • ${newLot.quantity} units • Expires ${formatDateEST(newLot.expirationDate)}`
      );
    } catch (err) {
      console.error('Error adding lot:', err);
      setError('Failed to add lot. Please try again.');
      showErrorToast(
        'Failed to add inventory lot',
        'Please check the information and try again.'
      );
    }
  };

  const handleUpdateLot = async (
    id: string,
    updates: Partial<Pick<InventoryItem, 'quantity' | 'lotNumber' | 'expirationDate'>>,
    options?: { reason?: string }
  ) => {
    try {
      const updatedLot = await MedicationService.updateInventoryItem(id, updates);
      setInventory(prev => prev.map(lot => lot.id === id ? updatedLot : lot));

      // Reload medications to update total stock count
      const updatedMedications = await MedicationService.getAllMedications();
      setMedications(updatedMedications);

      const detailParts: string[] = [`Lot ${updatedLot.lotNumber}`];
      if (updates.quantity !== undefined) {
        detailParts.push(`Quantity: ${updatedLot.quantity} units`);
      }
      if (updates.lotNumber !== undefined) {
        detailParts.push(`Lot #: ${updatedLot.lotNumber}`);
      }
      if (updates.expirationDate !== undefined) {
        detailParts.push(`Expires ${formatDateEST(updatedLot.expirationDate)}`);
      }
      const details = detailParts.join(' • ');
      const reasonSuffix = options?.reason ? ` • Reason: ${options.reason}` : '';

      showSuccessToast(
        'Updated inventory lot',
        `${details}${reasonSuffix}`
      );
    } catch (err) {
      console.error('Error updating lot:', err);
      setError('Failed to update lot. Please try again.');
      showErrorToast(
        'Failed to update inventory lot',
        'Please try again or contact support.'
      );
    }
  };

  const handleSetLotQuantity = async (lotId: string, newQuantity: number, reason: string) => {
    await handleUpdateLot(lotId, { quantity: newQuantity }, { reason });
  };

  const handleDeleteLot = async (id: string) => {
    try {
      // Get lot info before deletion for toast message
      const lotToDelete = inventory.find(lot => lot.id === id);
      
      await MedicationService.deleteInventoryItem(id);
      setInventory(prev => prev.filter(lot => lot.id !== id));

      // Reload medications to update total stock count
      const updatedMedications = await MedicationService.getAllMedications();
      setMedications(updatedMedications);
      
      showSuccessToast(
        'Deleted inventory lot',
        lotToDelete ? `Lot ${lotToDelete.lotNumber} • ${lotToDelete.quantity} units removed` : 'Inventory lot removed successfully'
      );
    } catch (err) {
      console.error('Error deleting lot:', err);
      setError('Failed to delete lot. Please try again.');
      showErrorToast(
        'Failed to delete inventory lot',
        'Please try again or contact support.'
      );
    }
  };

  const handleSync = async () => {
    if (!navigator.onLine) return;
    // Process pending queue and refresh meds from server
    const result = await syncService.flushQueue();
    const freshMeds = await syncService.primeMedicationsCache();
    const freshLogs = await MedicationService.getAllDispensingRecords();
    setMedications(freshMeds);
    setDispensingRecords(freshLogs);
    if (result.processed > 0) setPendingChanges(0);
  };

  const getAlternatives = (medication: Medication): Medication[] => {
    return medications.filter((med: Medication) => 
      medication.alternatives.includes(med.id) && med.isAvailable
    );
  };

  const canAccessStockManagement = currentUser?.role === 'pharmacy_staff';

  // User selection component for mobile
  const UserSelector = () => (
    <div className="flex items-center gap-2">
      <User className="size-4 flex-shrink-0" />
      <Select value={currentUser?.id || ''} onValueChange={(value: string) => {
        const user = users.find((u: UserType) => u.id === value);
        if (user) setCurrentUser(user);
      }}>
        <SelectTrigger className="w-full min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {users.map((user: UserType) => (
            <SelectItem key={user.id} value={user.id}>
              <div className="flex items-center gap-2">
                <span className="truncate">{user.name}</span>
                <Badge variant="outline" className="text-xs flex-shrink-0">
                  {user.role === 'pharmacy_staff' ? 'Pharmacy' : 'Provider'}
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  // Show login page if not logged in
  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading formulary...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <div className="size-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <Settings className="size-8 text-destructive" />
          </div>
          <h1 className="text-lg font-semibold">Connection Error</h1>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
        {/* Mobile Header */}
        <div className="block sm:hidden mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold truncate">EFWP Formulary</h1>
              <p className="text-sm text-muted-foreground truncate">Mobile Clinic</p>
            </div>
            
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="flex-shrink-0">
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <SheetHeader>
                  <SheetTitle>User Settings</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Logged in as:</p>
                    <p className="text-sm text-muted-foreground">{loggedInNetId}</p>
                  </div>
                  <UserSelector />
                  <Button 
                    variant="outline" 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2"
                  >
                    <LogOut className="size-4" />
                    Sign Out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden sm:flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">EFWP Medication Formulary</h1>
            <p className="text-muted-foreground">Emory Farmworker Project Mobile Clinic</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium">{loggedInNetId}</p>
              <p className="text-xs text-muted-foreground">Signed in</p>
            </div>
            <div className="w-48">
              <UserSelector />
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <LogOut className="size-4" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Offline Sync Status */}
        <div className="mb-4 sm:mb-6">
          <OfflineSync pendingChanges={pendingChanges} onSync={handleSync} />
        </div>

        {/* Main Content */}
        {currentView === 'detail' && selectedMedication ? (
          <MedicationDetail
            medication={selectedMedication}
            alternatives={getAlternatives(selectedMedication)}
            inventory={inventory}
            currentUser={currentUser!}
            onBack={handleBackToFormulary}
            onDispense={handleDispense}
            onSelectAlternative={handleMedicationSelect}
            onAddLot={handleAddLot}
            onUpdateLot={handleUpdateLot}
            onDeleteLot={handleDeleteLot}
          />
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-4 sm:mb-6">
              <TabsTrigger value="formulary" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <Pill className="size-3 sm:size-4" />
                <span className="hidden xs:inline">Formulary</span>
                <span className="xs:hidden">Drugs</span>
              </TabsTrigger>
              <TabsTrigger value="log" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <ClipboardList className="size-3 sm:size-4" />
                <span className="hidden xs:inline">Dispensing Log</span>
                <span className="xs:hidden">Log</span>
              </TabsTrigger>
              <TabsTrigger 
                value="stock" 
                className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                disabled={!canAccessStockManagement}
              >
                <Settings className="size-3 sm:size-4" />
                <span className="hidden sm:inline">Stock Management</span>
                <span className="sm:hidden">Stock</span>
                {!canAccessStockManagement && (
                  <Badge variant="outline" className="text-[10px] sm:text-xs ml-1 hidden sm:inline-flex">
                    Staff Only
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="formulary" className="mt-0">
              <FormularyView
                medications={medications}
                onMedicationSelect={handleMedicationSelect}
              />
            </TabsContent>

            <TabsContent value="log" className="mt-0">
              <DispensingLog
                records={dispensingRecords}
                onEditRecord={handleEditDispensingRecord}
              />
            </TabsContent>

            <TabsContent value="stock" className="mt-0">
              {canAccessStockManagement ? (
                <StockManagement
                  medications={medications}
                  inventory={inventory}
                  currentUser={currentUser!}
                  onUpdateLot={handleSetLotQuantity}
                  onAddLot={handleAddLot}
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Settings className="size-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg mb-2">Access Restricted</p>
                  <p className="text-sm">Stock management is available to pharmacy staff only</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Edit Dispensing Record Dialog */}
      <EditDispensingRecordDialog
        record={editingRecord}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSave={handleSaveEditedRecord}
      />

      {/* Toast Notifications */}
      <Toaster position="top-right" />
    </div>
  );
}
