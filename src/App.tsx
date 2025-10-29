import { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { AuthenticationPage } from './components/auth/AuthenticationPage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { FormularyView } from './components/FormularyView';
import { MedicationDetail } from './components/MedicationDetail';
import { DispensingLog } from './components/DispensingLog';
import { EditDispensingRecordDialog } from './components/EditDispensingRecordDialog';
import { StockManagement } from './components/StockManagement';
import { OfflineSync } from './components/OfflineSync';
import { Button } from './components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './components/ui/sheet';
import { Pill, ClipboardList, Package, Menu, LogOut, User } from 'lucide-react';
import { Medication, DispensingRecord, InventoryItem, User as UserType } from './types/medication';
import { MedicationService } from './services/medicationService';
import { syncService } from './services/syncService';
import { OfflineStore } from './utils/offlineStore';
import { logger } from './utils/logger';

export default function App() {
  const { user, isLoading, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<'formulary' | 'detail'>('formulary');
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [dispensingRecords, setDispensingRecords] = useState<DispensingRecord[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [activeTab, setActiveTab] = useState('formulary');
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<DispensingRecord | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Initialize currentUser when authentication completes
  useEffect(() => {
    if (user && !currentUser) {
      const defaultUser: UserType = {
        id: user.id,
        name: user.email?.split('@')[0] || 'User',
        role: 'pharmacy_staff', // Default to pharmacy_staff for now
        initials: user.email?.substring(0, 2).toUpperCase() || 'US'
      };
      setCurrentUser(defaultUser);
    }
  }, [user, currentUser]);

  // Load medications when user is authenticated
  useEffect(() => {
    if (user && !isLoading) {
      loadInitialData();
    }
  }, [user, isLoading]);

  const loadInitialData = async () => {
    try {
      setIsLoadingData(true);
      setError(null);
      
      console.log('🔄 Loading all data...');
      
      let medicationsData: Medication[] = [];
      let dispensingData: DispensingRecord[] = [];
      let inventoryData: InventoryItem[] = [];
      let usersData: UserType[] = [];

      if (navigator.onLine) {
        // Online: fetch fresh data and start realtime sync
        try {
          [medicationsData, dispensingData, inventoryData, usersData] = await Promise.all([
            MedicationService.getAllMedications(),
            MedicationService.getAllDispensingRecords(),
            MedicationService.getAllInventory(),
            MedicationService.getAllUsers(),
          ]);
          syncService.startMedicationsRealtime();
        } catch (err) {
          console.warn('Online fetch failed, trying offline cache:', err);
          // Fallback to offline data
          medicationsData = await OfflineStore.getAllMedications();
          dispensingData = [];
          inventoryData = [];
          usersData = [];
        }
      } else {
        // Offline: use cached data
        medicationsData = await OfflineStore.getAllMedications();
        dispensingData = [];
        inventoryData = [];
        usersData = [];
      }
      
      setMedications(medicationsData);
      setDispensingRecords(dispensingData);
      setInventory(inventoryData);
      setUsers(usersData);
      setPendingChanges(0);
      
      logger.info('All data loaded successfully', { 
        medications: medicationsData.length,
        dispensingRecords: dispensingData.length,
        inventory: inventoryData.length,
        users: usersData.length
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load data';
      setError(errorMessage);
      logger.error('Failed to load initial data', err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleMedicationSelect = (medication: Medication) => {
    setSelectedMedication(medication);
    setCurrentView('detail');
  };

  const handleBackToFormulary = () => {
    setCurrentView('formulary');
    setSelectedMedication(null);
  };

  const getAlternatives = (medication: Medication): Medication[] => {
    return medications.filter(m => 
      medication.alternatives.includes(m.id) || 
      m.category === medication.category && m.id !== medication.id
    ).slice(0, 3); // Limit to 3 alternatives
  };

  const handleDispense = async (record: Omit<DispensingRecord, "id">) => {
    try {
      if (navigator.onLine) {
        // Online: write-through to server then update local/cache
        const newRecord = await MedicationService.createDispensingRecord(record);
        setDispensingRecords((prev: DispensingRecord[]) => [newRecord, ...prev]);

        // Update inventory lot quantity in database
        const inventoryLot = inventory.find(
          (inv) => inv.lotNumber === record.lotNumber && inv.medicationId === record.medicationId,
        );
        if (inventoryLot) {
          const newQuantity = Math.max(0, inventoryLot.quantity - record.quantity);
          await MedicationService.updateInventoryItem(inventoryLot.id, { quantity: newQuantity });
        }

        // Update local state
        const newStock = Math.max(
          0,
          (medications.find((m: Medication) => m.id === record.medicationId)?.currentStock || 0) -
            record.quantity,
        );
        setMedications((prev: Medication[]) =>
          prev.map((med: Medication) =>
            med.id === record.medicationId
              ? {
                  ...med,
                  currentStock: newStock,
                  isAvailable: newStock > 0,
                  lastUpdated: new Date(),
                }
              : med,
          ),
        );
        setInventory((prev) =>
          prev.map((inv) =>
            inv.lotNumber === record.lotNumber
              ? { ...inv, quantity: Math.max(0, inv.quantity - record.quantity) }
              : inv,
          ),
        );
      } else {
        // Offline: queue and update local stock/cache immediately
        await syncService.queueOfflineDispense(record);
        setMedications((prev: Medication[]) =>
          prev.map((med: Medication) =>
            med.id === record.medicationId
              ? {
                  ...med,
                  currentStock: Math.max(0, med.currentStock - record.quantity),
                  isAvailable: med.currentStock - record.quantity > 0,
                  lastUpdated: new Date(),
                }
              : med,
          ),
        );
        // Create temporary record for offline display
        const tempRecord: DispensingRecord = {
          ...record,
          id: `temp-${Date.now()}`, // Temporary ID for offline records
        };
        setDispensingRecords((prev: DispensingRecord[]) => [tempRecord, ...prev]);
      }
    } catch (error) {
      console.error('Error dispensing medication:', error);
    }
  };

  const handleEditDispensingRecord = (record: DispensingRecord) => {
    setEditingRecord(record);
    setIsEditDialogOpen(true);
  };

  const handleUpdateDispensingRecord = async (id: string, updates: Partial<DispensingRecord>) => {
    try {
      const updatedRecord = await MedicationService.updateDispensingRecord(id, updates);
      setDispensingRecords((prev) => prev.map((rec) => (rec.id === id ? updatedRecord : rec)));
    } catch (err) {
      console.error('Error updating dispensing record:', err);
      throw err;
    }
  };

  // Handler for StockManagement component (with reason parameter)
  const handleUpdateLotWithReason = async (lotId: string, newQuantity: number, reason: string) => {
    try {
      if (navigator.onLine) {
        await MedicationService.updateInventoryItem(lotId, { quantity: newQuantity });
        setInventory(prev => prev.map(item => 
          item.id === lotId 
            ? { ...item, quantity: newQuantity }
            : item
        ));
        
        // Update medication stock total
        const lot = inventory.find(inv => inv.id === lotId);
        if (lot) {
          const medication = medications.find(m => m.id === lot.medicationId);
          if (medication) {
            const totalStock = inventory
              .filter(inv => inv.medicationId === lot.medicationId)
              .reduce((sum, inv) => sum + (inv.id === lotId ? newQuantity : inv.quantity), 0);
            
            setMedications(prev => prev.map(med => 
              med.id === lot.medicationId 
                ? { ...med, currentStock: totalStock, isAvailable: totalStock > 0 }
                : med
            ));
          }
        }
      } else {
        // Handle offline
        setPendingChanges(prev => prev + 1);
      }
    } catch (err) {
      console.error('Error updating lot:', err);
      throw err;
    }
  };

  // Handler for MedicationDetail component (with updates object)
  const handleUpdateLot = (id: string, updates: Partial<Pick<InventoryItem, 'quantity' | 'lotNumber' | 'expirationDate'>>) => {
    // For now, just handle quantity updates
    if (updates.quantity !== undefined) {
      handleUpdateLotWithReason(id, updates.quantity, 'Updated from detail view');
    }
  };

  const handleAddLot = async (lot: Omit<InventoryItem, 'id' | 'isExpired'>) => {
    try {
      if (navigator.onLine) {
        const newLot = await MedicationService.createInventoryItem(lot);
        setInventory(prev => [...prev, newLot]);
        
        // Update medication stock
        const medication = medications.find(m => m.id === lot.medicationId);
        if (medication) {
          const newStock = medication.currentStock + lot.quantity;
          setMedications(prev => prev.map(med => 
            med.id === lot.medicationId 
              ? { ...med, currentStock: newStock, isAvailable: newStock > 0 }
              : med
          ));
        }
      } else {
        // Handle offline
        await syncService.queueOfflineLot(lot);
        setPendingChanges(prev => prev + 1);
      }
    } catch (err) {
      console.error('Error adding lot:', err);
      throw err;
    }
  };

  const handleDeleteLot = async (id: string) => {
    try {
      if (navigator.onLine) {
        await MedicationService.deleteInventoryItem(id);
        const lot = inventory.find(inv => inv.id === id);
        setInventory(prev => prev.filter(item => item.id !== id));
        
        // Update medication stock
        if (lot) {
          const medication = medications.find(m => m.id === lot.medicationId);
          if (medication) {
            const newStock = Math.max(0, medication.currentStock - lot.quantity);
            setMedications(prev => prev.map(med => 
              med.id === lot.medicationId 
                ? { ...med, currentStock: newStock, isAvailable: newStock > 0 }
                : med
            ));
          }
        }
      } else {
        setPendingChanges(prev => prev + 1);
      }
    } catch (err) {
      console.error('Error deleting lot:', err);
      throw err;
    }
  };

  const handleSync = async () => {
    try {
      // Simple sync: just reload data
      await loadInitialData();
      setPendingChanges(0);
    } catch (err) {
      console.error('Sync failed:', err);
    }
  };

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!user) {
    return <AuthenticationPage />;
  }

  // Show error if data loading failed
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-destructive mb-4">⚠️ Error Loading Data</div>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={loadInitialData} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Show detail view if medication is selected
  if (currentView === 'detail' && selectedMedication && currentUser) {
    return (
      <MedicationDetail
        medication={selectedMedication}
        alternatives={getAlternatives(selectedMedication)}
        inventory={inventory}
        currentUser={currentUser}
        onBack={handleBackToFormulary}
        onDispense={handleDispense}
        onSelectAlternative={handleMedicationSelect}
        onAddLot={handleAddLot}
        onUpdateLot={handleUpdateLot}
        onDeleteLot={handleDeleteLot}
      />
    );
  }

  // Show main app with tabs
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="size-8 bg-primary rounded-lg flex items-center justify-center">
              <Pill className="size-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">EFWP Formulary</h1>
            </div>
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {user.email}
            </span>
            
            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="sm:hidden">
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <User className="size-4" />
                    Account
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Signed in as: {user.email}
                  </div>
                  <Button 
                    onClick={() => signOut()} 
                    variant="outline"
                    className="w-full flex items-center gap-2"
                  >
                    <LogOut className="size-4" />
                    Sign Out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            {/* Desktop Sign Out */}
            <Button 
              onClick={() => signOut()} 
              variant="ghost" 
              size="sm"
              className="hidden sm:flex items-center gap-2"
            >
              <LogOut className="size-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-4">
        {/* Offline Sync Status */}
        <div className="mb-4">
          <OfflineSync pendingChanges={pendingChanges} onSync={handleSync} />
        </div>

        {isLoadingData ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading medications...</p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="formulary" className="flex items-center gap-2">
                <Pill className="size-4" />
                <span className="hidden sm:inline">Formulary</span>
              </TabsTrigger>
              <TabsTrigger value="dispensing" className="flex items-center gap-2">
                <ClipboardList className="size-4" />
                <span className="hidden sm:inline">Dispensing</span>
              </TabsTrigger>
              <TabsTrigger value="inventory" className="flex items-center gap-2">
                <Package className="size-4" />
                <span className="hidden sm:inline">Inventory</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="formulary" className="space-y-4">
              <FormularyView
                medications={medications}
                onMedicationSelect={handleMedicationSelect}
              />
            </TabsContent>

            <TabsContent value="dispensing" className="space-y-4">
              <DispensingLog
                records={dispensingRecords}
                onEditRecord={handleEditDispensingRecord}
              />
            </TabsContent>

            <TabsContent value="inventory" className="space-y-4">
              {currentUser ? (
                <StockManagement
                  medications={medications}
                  inventory={inventory}
                  currentUser={currentUser}
                  onUpdateLot={handleUpdateLotWithReason}
                  onAddLot={handleAddLot}
                />
              ) : (
                <div className="text-center py-8">
                  <div className="animate-pulse">Loading user data...</div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>

      {/* Edit Dispensing Record Dialog */}
      <EditDispensingRecordDialog
        record={editingRecord}
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setEditingRecord(null);
          }
        }}
        onSave={handleUpdateDispensingRecord}
      />
    </div>
  );
}