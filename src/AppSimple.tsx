import { useState, useEffect, useMemo } from 'react';
import { useAuth } from './contexts/AuthContext';
import { AuthenticationPage } from './components/auth/AuthenticationPage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { FormularyView } from './components/FormularyView';
import { MedicationDetail } from './components/MedicationDetail';
import { DispensingLog } from './components/DispensingLog';
import { StockManagement } from './components/StockManagement';
import { Button } from './components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './components/ui/sheet';
import { Pill, ClipboardList, Package, Menu, LogOut, User } from 'lucide-react';
import { Medication, InventoryItem, DispensingRecord, User as UserType } from './types/medication';
import { MedicationService } from './services/medicationService';
import { logger } from './utils/logger';

export default function App() {
  const { user, isLoading, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<'formulary' | 'detail'>('formulary');
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [dispensingRecords, setDispensingRecords] = useState<DispensingRecord[]>([]);
  const [activeTab, setActiveTab] = useState('formulary');
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentUser = useMemo<UserType | null>(() => {
    if (!user) {
      return null;
    }

    const email = user.email ?? 'User';
    return {
      id: user.id,
      name: email,
      role: 'pharmacy_staff',
      initials: email.substring(0, 2).toUpperCase(),
    };
  }, [user]);

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
      
      console.log('🔄 Loading medications...');
      const [medicationsData, inventoryData, dispensingData] = await Promise.all([
        MedicationService.getAllMedications(),
        MedicationService.getAllInventory(),
        MedicationService.getAllDispensingRecords(),
      ]);
      setMedications(medicationsData);
      setInventory(inventoryData);
      setDispensingRecords(dispensingData);
      
      logger.info('Medications loaded successfully', { count: medicationsData.length });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load data';
      setError(errorMessage);
      logger.error('Failed to load initial data', err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoadingData(false);
    }
  };

  const getAlternatives = (medication: Medication): Medication[] => {
    return medications
      .filter((candidate) => candidate.id !== medication.id && candidate.category === medication.category)
      .slice(0, 3);
  };

  const handleMedicationSelect = (medication: Medication) => {
    setSelectedMedication(medication);
    setCurrentView('detail');
  };

  const handleBackToFormulary = () => {
    setSelectedMedication(null);
    setCurrentView('formulary');
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

  // Show detail view
  if (currentView === 'detail' && selectedMedication) {
    return (
      <MedicationDetail
        medication={selectedMedication}
        alternatives={getAlternatives(selectedMedication)}
        inventory={inventory}
        currentUser={currentUser ?? undefined}
        isReadOnly={false}
        onBack={handleBackToFormulary}
        onSelectAlternative={handleMedicationSelect}
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
              <DispensingLog records={dispensingRecords} />
            </TabsContent>

            <TabsContent value="inventory" className="space-y-4">
              {currentUser ? (
                <StockManagement
                  medications={medications}
                  inventory={inventory}
                  currentUser={currentUser}
                  onUpdateLot={async () => {}}
                  onAddLot={async () => {}}
                />
              ) : (
                <div className="text-sm text-muted-foreground">Loading user details…</div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}