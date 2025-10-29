import { useState, useEffect, useRef } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './components/ui/sheet';
import { Pill, ClipboardList, Settings, User, Menu, LogOut } from 'lucide-react';
import {
  Medication,
  DispensingRecord,
  InventoryItem,
  User as UserType,
  UserRole,
} from './types/medication';
import { MedicationService } from './services/medicationService';
import { syncService } from './services/syncService';
import { OfflineStore } from './utils/offlineStore';

const LOGIN_STORAGE_KEY = 'medtrack-net-id';
const USER_STORAGE_KEY = 'medtrack-user-id';
const USER_SNAPSHOT_KEY = 'medtrack-user-snapshot';

const getStoredUserSnapshot = (): UserType | null => {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(USER_SNAPSHOT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserType;
  } catch {
    return null;
  }
};

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
  const preferredRoleRef = useRef<UserRole | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedNetId = window.localStorage.getItem(LOGIN_STORAGE_KEY);
    if (storedNetId) {
      setLoggedInNetId(storedNetId);
      setIsLoggedIn(true);
    }
  }, []);

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
            MedicationService.getAllUsers(),
          ]);
          syncService.startMedicationsRealtime();
        } else {
          // Offline: use cached meds and empty logs/inventory/users (or keep last)
          medicationsData = await OfflineStore.getAllMedications();
          dispensingData = [];
          inventoryData = [];
          usersData = [];
        }

        if (usersData.length === 0) {
          const storedUser = getStoredUserSnapshot();
          if (storedUser) {
            usersData = [storedUser];
          }
        }

        setMedications(medicationsData);
        setDispensingRecords(dispensingData);
        setInventory(inventoryData);
        setUsers(usersData);

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
            const fallbackUser = getStoredUserSnapshot();
            setUsers(fallbackUser ? [fallbackUser] : []);
            setError(null);
          } else {
            setError('Failed to load data from database. Please try again.');
          }
        } catch (e) {
          setError('Failed to load data from database. Please try again.');
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
    };
  }, []);

  const handleLogin = (netId: string, preferredRole: UserRole) => {
    setLoggedInNetId(netId);
    setIsLoggedIn(true);
    preferredRoleRef.current = preferredRole;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOGIN_STORAGE_KEY, netId);
    }
    console.log(`User logged in: ${netId}`);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setLoggedInNetId('');
    setCurrentView('formulary');
    setSelectedMedication(null);
    setActiveTab('formulary');
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(LOGIN_STORAGE_KEY);
    }
    console.log('User logged out');
  };

  useEffect(() => {
    if (!isLoggedIn || users.length === 0) return;

    setCurrentUser((prev) => {
      if (prev) return prev;

      const storedUserId =
        typeof window !== 'undefined' ? window.localStorage.getItem(USER_STORAGE_KEY) : null;
      let nextUser = storedUserId ? users.find((u) => u.id === storedUserId) : undefined;

      if (!nextUser && preferredRoleRef.current) {
        nextUser = users.find((u) => u.role === preferredRoleRef.current);
      }

      if (!nextUser) {
        nextUser = users.find((u) => u.role === 'pharmacy_staff') || users[0];
      }

      if (nextUser && typeof window !== 'undefined') {
        window.localStorage.setItem(USER_STORAGE_KEY, nextUser.id);
      }

      preferredRoleRef.current = nextUser?.role ?? preferredRoleRef.current;
      return nextUser || null;
    });
  }, [isLoggedIn, users]);

  const handleUserSwitch = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    setCurrentUser(user);
    preferredRoleRef.current = user.role;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(USER_STORAGE_KEY, user.id);
    }
  };

  useEffect(() => {
    if (!currentUser || typeof window === 'undefined') return;
    window.localStorage.setItem(USER_SNAPSHOT_KEY, JSON.stringify(currentUser));
  }, [currentUser]);

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
        setInventory((prev) =>
          prev.map((inv) =>
            inv.lotNumber === record.lotNumber
              ? { ...inv, quantity: Math.max(0, inv.quantity - record.quantity) }
              : inv,
          ),
        );
        setPendingChanges((prev: number) => prev + 1);
      }
    } catch (err) {
      console.error('Error dispensing medication:', err);
      setError('Failed to record dispensing. Please try again.');
    }
  };

  const handleEditDispensingRecord = (record: DispensingRecord) => {
    setEditingRecord(record);
    setIsEditDialogOpen(true);
  };

  const handleSaveEditedRecord = async (
    id: string,
    updates: Partial<Omit<DispensingRecord, 'id'>>,
  ) => {
    try {
      const updatedRecord = await MedicationService.updateDispensingRecord(id, updates);
      setDispensingRecords((prev) => prev.map((rec) => (rec.id === id ? updatedRecord : rec)));
    } catch (err) {
      console.error('Error updating dispensing record:', err);
      throw err; // Re-throw to let dialog handle error display
    }
  };

  const handleAddLot = async (lot: Omit<InventoryItem, 'id' | 'isExpired'>) => {
    const queueLotOffline = async () => {
      await syncService.queueOfflineLot(lot);

      const medication = medications.find((m) => m.id === lot.medicationId);
      if (medication) {
        const newStock = medication.currentStock + lot.quantity;
        setMedications((prev: Medication[]) =>
          prev.map((med: Medication) =>
            med.id === lot.medicationId
              ? {
                  ...med,
                  currentStock: newStock,
                  isAvailable: newStock > 0,
                  lastUpdated: new Date(),
                }
              : med,
          ),
        );
      }

      setPendingChanges((prev: number) => prev + 1);
    };

    const shouldFallbackOffline = (error: unknown) => {
      if (typeof navigator === 'undefined') return false;
      if (navigator.onLine) {
        if (error instanceof Error) {
          const msg = error.message.toLowerCase();
          return msg.includes('fetch') || msg.includes('network') || msg.includes('failed to load');
        }
      }
      return false;
    };

    try {
      if (navigator.onLine) {
        const newLot = await MedicationService.createInventoryItem(lot);
        setInventory((prev) => [...prev, newLot]);

        const updatedMedications = await MedicationService.getAllMedications();
        setMedications(updatedMedications);
      } else {
        await queueLotOffline();
      }
    } catch (err) {
      if (shouldFallbackOffline(err)) {
        console.warn('Online lot creation failed, queuing offline instead.', err);
        try {
          await queueLotOffline();
          return;
        } catch (offlineErr) {
          console.error('Offline fallback for lot failed:', offlineErr);
        }
      }
      console.error('Error adding lot:', err);
      setError('Failed to add lot. Please try again.');
    }
  };

  const handleUpdateLot = async (
    id: string,
    updates: Partial<Pick<InventoryItem, 'quantity' | 'lotNumber' | 'expirationDate'>>,
  ) => {
    try {
      const updatedLot = await MedicationService.updateInventoryItem(id, updates);
      setInventory((prev) => prev.map((lot) => (lot.id === id ? updatedLot : lot)));

      // Reload medications to update total stock count
      const updatedMedications = await MedicationService.getAllMedications();
      setMedications(updatedMedications);
    } catch (err) {
      console.error('Error updating lot:', err);
      setError('Failed to update lot. Please try again.');
    }
  };

  const handleDeleteLot = async (id: string) => {
    try {
      await MedicationService.deleteInventoryItem(id);
      setInventory((prev) => prev.filter((lot) => lot.id !== id));

      // Reload medications to update total stock count
      const updatedMedications = await MedicationService.getAllMedications();
      setMedications(updatedMedications);
    } catch (err) {
      console.error('Error deleting lot:', err);
      setError('Failed to delete lot. Please try again.');
    }
  };

  // Adapter for StockManagement signature (lotId, newQuantity, reason)
  const handleUpdateLotQuantity = async (lotId: string, newQuantity: number) => {
    await handleUpdateLot(lotId, { quantity: newQuantity });
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleUpdateStock = async (medicationId: string, newQuantity: number, reason: string) => {
    try {
      setError(null);
      const medication = medications.find((m) => m.id === medicationId);
      if (!medication) {
        throw new Error('Medication not found.');
      }

      const currentStock = medication.currentStock;
      const difference = newQuantity - currentStock;

      if (difference === 0) return;

      if (difference > 0) {
        const lotData: Omit<InventoryItem, 'id' | 'isExpired'> = {
          medicationId,
          lotNumber: `ADJ-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
          quantity: difference,
          expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        };

        await handleAddLot(lotData);
        console.log(`Added ${difference} units to ${medication.name} (${reason})`);
      } else {
        if (!navigator.onLine) {
          throw new Error(
            'Reducing stock requires an internet connection so the central inventory stays accurate.',
          );
        }

        const amountToRemove = Math.abs(difference);
        await MedicationService.reduceInventoryStock(medicationId, amountToRemove);

        const [updatedMedications, updatedInventory] = await Promise.all([
          MedicationService.getAllMedications(),
          MedicationService.getAllInventory(),
        ]);
        setMedications(updatedMedications);
        setInventory(updatedInventory);
        console.log(`Removed ${amountToRemove} units from ${medication.name} (${reason})`);
      }
    } catch (err) {
      console.error('Error updating stock:', err);
      setError(err instanceof Error ? err.message : 'Failed to update stock. Please try again.');
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
    return medications.filter(
      (med: Medication) => medication.alternatives.includes(med.id) && med.isAvailable,
    );
  };

  const canAccessStockManagement = currentUser?.role === 'pharmacy_staff';

  // User selection component for mobile
  const UserSelector = () => (
    <div className="flex items-center gap-2">
      <User className="size-4 flex-shrink-0" />
      <Select value={currentUser?.id || ''} onValueChange={handleUserSwitch}>
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
              <TabsTrigger
                value="formulary"
                className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
              >
                <Pill className="size-3 sm:size-4" />
                <span className="hidden xs:inline">Formulary</span>
                <span className="xs:hidden">Drugs</span>
              </TabsTrigger>
              <TabsTrigger
                value="log"
                className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
              >
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
                  <Badge
                    variant="outline"
                    className="text-[10px] sm:text-xs ml-1 hidden sm:inline-flex"
                  >
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
                  onUpdateLot={handleUpdateLotQuantity}
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

      {/* Toaster temporarily disabled to fix import conflicts */}
    </div>
  );
}
