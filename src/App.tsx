import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from './contexts/AuthContext';
import { AuthenticationPage } from './components/auth/AuthenticationPage';
import { FormularyView } from './components/FormularyView';
import { MedicationDetail } from './components/MedicationDetail';
import { DispensingLog } from './components/DispensingLog';
import { EditDispensingRecordDialog } from './components/EditDispensingRecordDialog';
import { StockManagement } from './components/StockManagement';
import { OfflineSync } from './components/OfflineSync';
import { ProfilePage } from './components/auth/ProfilePage';
import { AdminPanel } from './components/AdminPanel';
import { Button } from './components/ui/button';
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './components/ui/sheet';
import { cn } from './components/ui/utils';
import type { LucideIcon } from 'lucide-react';
import { Pill, ClipboardList, Package, Menu, LogOut, User, ShieldCheck } from 'lucide-react';
import { Medication, DispensingRecord, InventoryItem, User as UserType } from './types/medication';
import { MedicationService } from './services/medicationService';
import { syncService } from './services/syncService';
import { OfflineStore } from './utils/offlineStore';
import { logger } from './utils/logger';

type AppSection = 'formulary' | 'dispensing' | 'inventory' | 'profile' | 'admin';

export default function App() {
  const { user, profile, isLoading, signOut, isAuthenticated } = useAuth();
  const [currentView, setCurrentView] = useState<'formulary' | 'detail'>('formulary');
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [dispensingRecords, setDispensingRecords] = useState<DispensingRecord[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [activeSection, setActiveSection] = useState<AppSection>('formulary');
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<DispensingRecord | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [lastLoadedMode, setLastLoadedMode] = useState<'authenticated' | 'public' | null>(null);
  const isLoadingDataRef = useRef(false);
  const lastLoadedModeRef = useRef<'authenticated' | 'public' | null>(null);
  const isMountedRef = useRef(true);

  const isAdmin = profile?.role === 'admin';

  // Track component mount/unmount
  useEffect(() => {
    console.log('🚀 App component mounted');
    isMountedRef.current = true;
    return () => {
      console.log('🛑 App component unmounting, cleaning up...');
      isMountedRef.current = false;
      syncService.stopRealtime();
    };
  }, []);

  // Initialize currentUser when authentication completes
  useEffect(() => {
    if (profile) {
      const firstInitial = profile.firstName?.charAt(0)?.toUpperCase() ?? '';
      const lastInitial = profile.lastName?.charAt(0)?.toUpperCase() ?? '';
      const displayName = `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() || user?.email || 'User';

      const formattedUser: UserType = {
        id: profile.id,
        name: displayName,
        role: 'pharmacy_staff',
        initials: `${firstInitial}${lastInitial}` || (user?.email?.substring(0, 2).toUpperCase() ?? 'US'),
      };
      setCurrentUser(formattedUser);
    } else if (user && !profile) {
      const fallbackName = user.email?.split('@')[0] || 'User';
      setCurrentUser({
        id: user.id,
        name: fallbackName,
        role: 'pharmacy_staff',
        initials: fallbackName.substring(0, 2).toUpperCase() || 'US',
      });
    } else if (!user && currentUser) {
      setCurrentUser(null);
    }
  }, [user, profile]);

  useEffect(() => {
    if (user) {
      setShowAuthModal(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setCurrentView('formulary');
      setSelectedMedication(null);
      setActiveSection('formulary');
    }
  }, [user]);

  useEffect(() => {
    if (!isAuthenticated) {
      setActiveSection('formulary');
    }
  }, [isAuthenticated]);

  const loadInitialData = useCallback(async (authenticated: boolean, force = false) => {
    // Check if component is still mounted
    if (!isMountedRef.current) {
      console.log('⚠️ Component unmounted, aborting data load');
      return;
    }

    // Prevent concurrent calls
    if (isLoadingDataRef.current && !force) {
      console.log('⏸️ Load already in progress, skipping...');
      return;
    }

    const mode = authenticated ? 'authenticated' : 'public';
    
    // Check if already loaded in this mode (using ref to avoid stale closure)
    if (!force && lastLoadedModeRef.current === mode) {
      console.log(`⏸️ Already loaded in ${mode} mode, skipping...`);
      return;
    }

    isLoadingDataRef.current = true;
    setIsLoadingData(true);
    setError(null);

    try {
      console.log(`🔄 Loading ${mode} data...`);

      let medicationsData: Medication[] = [];
      let dispensingData: DispensingRecord[] = [];
      let inventoryData: InventoryItem[] = [];

      if (!authenticated) {
        syncService.stopRealtime();
      }

      if (navigator.onLine) {
        if (authenticated) {
          try {
            console.log('📡 Fetching authenticated data from server...');
            console.time('Data fetch duration');
            
            try {
              medicationsData = await MedicationService.getAllMedications();
            } catch (medErr) {
              console.error('❌ Failed to fetch medications:', medErr);
              throw medErr;
            }
            
            try {
              dispensingData = await MedicationService.getAllDispensingRecords();
            } catch (dispErr) {
              console.error('❌ Failed to fetch dispensing records:', dispErr);
              throw dispErr;
            }
            
            try {
              inventoryData = await MedicationService.getAllInventory();
            } catch (invErr) {
              console.error('❌ Failed to fetch inventory:', invErr);
              throw invErr;
            }
            
            console.timeEnd('Data fetch duration');
            console.log('✅ Authenticated data fetched successfully');
            
            // Only start realtime if not already started
            syncService.stopRealtime(); // Stop any existing subscription first
            syncService.startMedicationsRealtime();
            console.log('📡 Realtime subscription started');
          } catch (err) {
            console.error('❌ Online fetch failed:', err);
            console.warn('🔄 Trying offline cache...');
            medicationsData = await OfflineStore.getAllMedications();
            dispensingData = [];
            inventoryData = [];
            console.log(`📦 Loaded ${medicationsData.length} medications from cache`);
          }
        } else {
          try {
            console.log('📡 Fetching public data from server...');
            console.time('Public data fetch duration');
            
            medicationsData = await MedicationService.getAllMedications();
            inventoryData = await MedicationService.getAllInventory();
            
            console.timeEnd('Public data fetch duration');
            console.log('✅ Public data fetched successfully');
          } catch (err) {
            console.error('❌ Public data fetch failed:', err);
            console.warn('🔄 Trying offline cache...');
            medicationsData = await OfflineStore.getAllMedications();
            inventoryData = [];
            console.log(`📦 Loaded ${medicationsData.length} medications from cache`);
          }
        }
      } else {
        console.log('📴 Offline mode - loading from cache');
        medicationsData = await OfflineStore.getAllMedications();
        inventoryData = [];
        dispensingData = [];
      }

      // Only update state if still mounted
      if (!isMountedRef.current) {
        console.log('⚠️ Component unmounted during load, skipping state updates');
        return;
      }

      setMedications(medicationsData);
      setDispensingRecords(authenticated ? dispensingData : []);
      setInventory(inventoryData);
      setPendingChanges(0);
      setLastLoadedMode(mode);
      lastLoadedModeRef.current = mode; // Update ref

      logger.info('All data loaded successfully', {
        mode,
        medications: medicationsData.length,
        dispensingRecords: dispensingData.length,
        inventory: inventoryData.length,
      });
    } catch (err) {
      if (!isMountedRef.current) {
        console.log('⚠️ Component unmounted during error, skipping error state');
        return;
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to load data';
      setError(errorMessage);
      logger.error('Failed to load initial data', err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (isMountedRef.current) {
        setIsLoadingData(false);
      }
      isLoadingDataRef.current = false;
    }
  }, []);

  // Reset loaded mode when auth state changes significantly
  useEffect(() => {
    if (!isLoading) {
      const currentMode = isAuthenticated ? 'authenticated' : 'public';
      // If auth state changed, reset the ref so data reloads
      if (lastLoadedModeRef.current !== null && lastLoadedModeRef.current !== currentMode) {
        console.log(`🔄 Auth mode changed from ${lastLoadedModeRef.current} to ${currentMode}, resetting...`);
        lastLoadedModeRef.current = null;
        setLastLoadedMode(null);
      }
    }
  }, [isLoading, isAuthenticated]);

  // Load medications when user is authenticated
  useEffect(() => {
    if (isLoading) {
      console.log('⏳ Waiting for auth to finish loading...');
      return;
    }

    const desiredMode = isAuthenticated ? 'authenticated' : 'public';
    // Use ref to check current mode without causing re-renders
    if (lastLoadedModeRef.current === desiredMode) {
      console.log(`✅ Already loaded in ${desiredMode} mode, skipping reload`);
      return;
    }

    console.log(`🚀 Starting to load data in ${desiredMode} mode...`);
    void loadInitialData(isAuthenticated);
  }, [isLoading, isAuthenticated, loadInitialData]);

  // Safety timeout: if data loading takes too long, show error
  useEffect(() => {
    if (isLoadingData && !error) {
      const timeout = setTimeout(() => {
        console.error('⏱️ Data loading timeout after 30 seconds');
        setError('Data loading is taking longer than expected. Please refresh the page.');
        setIsLoadingData(false);
        isLoadingDataRef.current = false;
      }, 30000); // 30 second timeout

      return () => clearTimeout(timeout);
    }
  }, [isLoadingData, error]);

  const handleMedicationSelect = (medication: Medication) => {
    setSelectedMedication(medication);
    setCurrentView('detail');
  };

  const handleBackToFormulary = () => {
    setCurrentView('formulary');
    setSelectedMedication(null);
    setActiveSection('formulary');
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
      await loadInitialData(isAuthenticated, true);
      setPendingChanges(0);
    } catch (err) {
      console.error('Sync failed:', err);
    }
  };

  const navigationSections = useMemo<Array<{
    key: Exclude<AppSection, 'profile' | 'admin'>;
    label: string;
    icon: LucideIcon;
    requiresAuth?: boolean;
  }>>(() => {
    const baseSections: Array<{
      key: Exclude<AppSection, 'profile' | 'admin'>;
      label: string;
      icon: LucideIcon;
      requiresAuth?: boolean;
    }> = [
      { key: 'formulary', label: 'Formulary', icon: Pill },
      { key: 'dispensing', label: 'Dispensing Log', icon: ClipboardList, requiresAuth: true },
      { key: 'inventory', label: 'Inventory', icon: Package, requiresAuth: true },
    ];
    return baseSections;
  }, [isAdmin]);

  const tabValue = navigationSections.some(({ key }) => key === activeSection)
    ? activeSection
    : '__none';

  const handleSectionChange = (section: AppSection) => {
    if (section === 'admin' && !isAdmin) {
      return;
    }
    if (!isAuthenticated && section !== 'formulary') {
      setShowAuthModal(true);
      return;
    }

    setActiveSection(section);
    setCurrentView('formulary');
    setSelectedMedication(null);
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

  if (!isAuthenticated && showAuthModal) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-8 bg-primary rounded-lg flex items-center justify-center">
                <Pill className="size-4 text-primary-foreground" />
              </div>
              <h1 className="text-lg font-semibold">EFWP Formulary</h1>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowAuthModal(false)}>
              Back to formulary
            </Button>
          </div>
        </header>
        <main className="flex-1">
          <AuthenticationPage />
        </main>
      </div>
    );
  }

  // Show error if data loading failed
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md space-y-4">
          <div className="text-destructive">⚠️ Error Loading Data</div>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => loadInitialData(isAuthenticated, true)} variant="outline">
            Try Again
          </Button>
          {!isAuthenticated && (
            <Button onClick={() => setShowAuthModal(true)}>Log In</Button>
          )}
        </div>
      </div>
    );
  }

  // Show detail view if medication is selected
  if (currentView === 'detail' && selectedMedication) {
    return (
      <MedicationDetail
        medication={selectedMedication}
        alternatives={getAlternatives(selectedMedication)}
        inventory={inventory}
        currentUser={currentUser ?? undefined}
        isReadOnly={!isAuthenticated}
        onBack={handleBackToFormulary}
        onDispense={isAuthenticated ? handleDispense : undefined}
        onSelectAlternative={handleMedicationSelect}
        onAddLot={isAuthenticated ? handleAddLot : undefined}
        onUpdateLot={isAuthenticated ? handleUpdateLot : undefined}
        onDeleteLot={isAuthenticated ? handleDeleteLot : undefined}
        onRequireAuth={() => setShowAuthModal(true)}
      />
    );
  }

  // Show main app layout
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="size-8 bg-primary rounded-lg flex items-center justify-center">
              <Pill className="size-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">EFWP Formulary</h1>
              {!isAuthenticated && (
                <p className="text-xs text-muted-foreground">Viewing limited access</p>
              )}
            </div>
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <div className="hidden sm:flex items-center overflow-hidden rounded-lg border bg-background/80 shadow-sm">
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-pressed={activeSection === 'admin'}
                    className={cn(
                      'rounded-none px-3 h-9 gap-2 text-sm first:rounded-l-lg transition-colors',
                      activeSection === 'admin'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-muted/60'
                    )}
                    onClick={() => handleSectionChange('admin')}
                  >
                    <ShieldCheck className="size-4" />
                    <span className="hidden lg:inline">Admin</span>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  aria-pressed={activeSection === 'profile'}
                  className={cn(
                    'rounded-none px-3 h-9 gap-2 text-sm last:rounded-r-lg transition-colors',
                    isAdmin ? '' : 'first:rounded-l-lg',
                    activeSection === 'profile'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted/60'
                  )}
                  onClick={() => handleSectionChange('profile')}
                >
                  <User className="size-4" />
                  <span className="hidden md:inline">Profile</span>
                </Button>
              </div>
            )}

            {user ? (
              <>
                <span className="text-sm text-muted-foreground hidden lg:block">
                  {user.email}
                </span>

                {/* Mobile Menu */}
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="sm" className="sm:hidden">
                      <Menu className="size-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="gap-0">
                    <SheetHeader className="pb-2">
                      <SheetTitle className="flex items-center gap-2">
                        <User className="size-4" />
                        Account
                      </SheetTitle>
                    </SheetHeader>
                    <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-6">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                          Navigate
                        </p>
                        <div className="grid gap-2">
                          {navigationSections.map(({ key, label, icon: Icon, requiresAuth }) => {
                            const isActive = activeSection === key;
                            const isRestricted = requiresAuth && !isAuthenticated;

                            return (
                              <SheetClose asChild key={key}>
                                <Button
                                  variant={isActive ? 'secondary' : 'ghost'}
                                  size="sm"
                                  className={`justify-start gap-2 ${isRestricted ? 'opacity-70' : ''}`}
                                  disabled={isRestricted}
                                  onClick={() => handleSectionChange(key)}
                                  title={isRestricted ? 'Log in to access this area' : undefined}
                                >
                                  <Icon className="size-4" />
                                  {label}
                                </Button>
                              </SheetClose>
                            );
                          })}
                          {isAdmin && (
                            <SheetClose asChild>
                              <Button
                                variant={activeSection === 'admin' ? 'secondary' : 'ghost'}
                                size="sm"
                                className="justify-start gap-2"
                                onClick={() => handleSectionChange('admin')}
                              >
                                <ShieldCheck className="size-4" />
                                Admin
                              </Button>
                            </SheetClose>
                          )}
                          <SheetClose asChild>
                            <Button
                              variant={activeSection === 'profile' ? 'secondary' : 'ghost'}
                              size="sm"
                              className="justify-start gap-2"
                              onClick={() => handleSectionChange('profile')}
                            >
                              <User className="size-4" />
                              Profile
                            </Button>
                          </SheetClose>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="text-sm text-muted-foreground">
                          Signed in as: {user.email}
                        </div>
                        <SheetClose asChild>
                          <Button
                            onClick={() => signOut()}
                            variant="outline"
                            className="w-full flex items-center gap-2"
                          >
                            <LogOut className="size-4" />
                            Sign Out
                          </Button>
                        </SheetClose>
                      </div>
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
              </>
            ) : (
              <Button size="sm" onClick={() => setShowAuthModal(true)}>
                Log In
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-4 space-y-4">
        {!isAuthenticated && (
          <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
            Browse medications and inventory details. Log in to dispense or manage stock.
          </div>
        )}

        <Tabs
          value={tabValue}
          onValueChange={(value) => handleSectionChange(value as AppSection)}
          className="w-full"
        >
          <TabsList className="w-full flex flex-wrap justify-start gap-2">
            {navigationSections.map(({ key, label, icon: Icon, requiresAuth }) => {
              const isRestricted = requiresAuth && !isAuthenticated;

              return (
                <TabsTrigger
                  key={key}
                  value={key}
                  className={`flex items-center gap-2 ${isRestricted ? 'opacity-70' : ''}`}
                  disabled={isRestricted}
                  title={isRestricted ? 'Log in to access this area' : undefined}
                >
                  <Icon className="size-4" />
                  <span>{label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        {isAuthenticated && activeSection !== 'profile' && activeSection !== 'admin' && (
          <OfflineSync pendingChanges={pendingChanges} onSync={handleSync} />
        )}

        {isLoadingData && activeSection !== 'profile' && activeSection !== 'admin' ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading data...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeSection === 'formulary' && (
              <FormularyView
                medications={medications}
                onMedicationSelect={handleMedicationSelect}
              />
            )}

            {activeSection === 'dispensing' && isAuthenticated && (
              <DispensingLog
                records={dispensingRecords}
                onEditRecord={handleEditDispensingRecord}
              />
            )}

            {activeSection === 'inventory' && isAuthenticated && (
              currentUser ? (
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
              )
            )}

            {activeSection === 'profile' && isAuthenticated && <ProfilePage />}

            {activeSection === 'admin' && isAuthenticated && isAdmin && <AdminPanel />}
          </div>
        )}
      </main>

      {/* Edit Dispensing Record Dialog */}
      {isAuthenticated && (
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
      )}
    </div>
  );
}