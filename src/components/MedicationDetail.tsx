import { useEffect, useRef, useState } from 'react';
 
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ScrollArea } from './ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import {
  AlertTriangle,
  CheckCircle,
  ArrowLeft,
  Package,
  Clock,
  AlertCircle,
  Plus,
  Edit2,
  Trash2,
} from 'lucide-react';
import { Medication, DispensingRecord, InventoryItem, User } from '../types/medication';
import { useFieldHistory } from '../hooks/useFieldHistory';
import { showErrorToast } from '../utils/toastUtils';

 

interface MedicationDetailProps {
  medication: Medication;
  alternatives: Medication[];
  inventory: InventoryItem[];
  currentUser?: User;
  isReadOnly?: boolean;
  onBack: () => void;
  onDispense?: (record: Omit<DispensingRecord, 'id'>) => void;
  onSelectAlternative: (medication: Medication) => void;
  onAddLot?: (lot: Omit<InventoryItem, 'id' | 'isExpired'>) => void;
  onUpdateLot?: (
    id: string,
    updates: Partial<Pick<InventoryItem, 'quantity' | 'lotNumber' | 'expirationDate'>>,
  ) => void;
  onDeleteLot?: (id: string) => void;
  onRequireAuth?: () => void;
}

interface LotSelection {
  lotNumber: string;
  quantity: number;
  expirationDate?: Date;
}

export function MedicationDetail({
  medication,
  alternatives,
  inventory,
  currentUser,
  isReadOnly = false,
  onBack,
  onDispense,
  onSelectAlternative,
  onAddLot,
  onUpdateLot,
  onDeleteLot,
  onRequireAuth,
}: MedicationDetailProps) {
  const [isDispenseDialogOpen, setIsDispenseDialogOpen] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [patientInitials, setPatientInitials] = useState('');
  const [dose, setDose] = useState('');
  const [selectedLots, setSelectedLots] = useState<LotSelection[]>([
    { lotNumber: '', quantity: 0 },
  ]);
  const [physicianName, setPhysicianName] = useState('');
  const [studentName, setStudentName] = useState('');
  const [clinicSite, setClinicSite] = useState('');
  const [notes, setNotes] = useState('');

  const patientIdInputRef = useRef<HTMLInputElement>(null);
  const patientInitialsInputRef = useRef<HTMLInputElement>(null);
  const doseInputRef = useRef<HTMLInputElement>(null);
  const physicianInputRef = useRef<HTMLInputElement>(null);
  const studentInputRef = useRef<HTMLInputElement>(null);
  const clinicInputRef = useRef<HTMLInputElement>(null);

  const patientIdHistory = useFieldHistory('dispense_patient_id', { minLength: 2 });
  const patientInitialsHistory = useFieldHistory('dispense_patient_initials', { minLength: 2 });
  const doseHistory = useFieldHistory('dispense_dose', { minLength: 1 });
  const physicianHistory = useFieldHistory('dispense_physician_name', { minLength: 2 });
  const studentHistory = useFieldHistory('dispense_student_name', { minLength: 2 });
  const clinicSiteHistory = useFieldHistory('dispense_clinic_site', { minLength: 2 });
  // Per-field open flags
  const [openPatientId, setOpenPatientId] = useState(false);
  const [openPatientInitials, setOpenPatientInitials] = useState(false);
  const [openDose, setOpenDose] = useState(false);
  const [openPhysician, setOpenPhysician] = useState(false);
  const [openStudent, setOpenStudent] = useState(false);
  const [openClinic, setOpenClinic] = useState(false);

  const closeAllSuggestions = () => {
    setOpenPatientId(false);
    setOpenPatientInitials(false);
    setOpenDose(false);
    setOpenPhysician(false);
    setOpenStudent(false);
    setOpenClinic(false);
  };

  useEffect(() => {
    if (!isDispenseDialogOpen) {
      closeAllSuggestions();
    }
  }, [isDispenseDialogOpen]);

  // Outside click listener
  useEffect(() => {
    if (!isDispenseDialogOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.history-suggestion-container')) {
        closeAllSuggestions();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isDispenseDialogOpen]);

  // Lot editing state
  const [isLotDialogOpen, setIsLotDialogOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<InventoryItem | null>(null);
  const [lotNumber, setLotNumber] = useState('');
  const [lotQuantity, setLotQuantity] = useState('');
  const [lotExpiration, setLotExpiration] = useState('');

  const readOnly = isReadOnly || !currentUser;
  const medicationInventory = inventory.filter((inv) => inv.medicationId === medication.id);
  const availableLots = medicationInventory.filter((inv) => !inv.isExpired && inv.quantity > 0);

  const getStockStatus = () => {
    if (!medication.isAvailable) {
      return { status: 'Out of Stock', color: 'destructive', icon: AlertTriangle };
    }
    if (medication.currentStock <= medication.minStock) {
      return { status: 'Low Stock', color: 'secondary', icon: AlertTriangle };
    }
    return { status: 'In Stock', color: 'default', icon: CheckCircle };
  };

  const handleDispense = () => {
    if (readOnly || !currentUser || !onDispense) {
      onRequireAuth?.();
      return;
    }

    // Validate required fields
    if (!patientId.trim() || !patientInitials.trim() || !dose.trim() || !physicianName.trim()) {
      showErrorToast(
        'Missing required fields',
        'Please fill in all required fields (marked with *)',
      );
      return;
    }

    // Validate lots
    const validLots = selectedLots.filter((lot) => lot.lotNumber && lot.quantity > 0);
    if (validLots.length === 0) {
      showErrorToast('No lots selected', 'Please select at least one lot with quantity > 0');
      return;
    }

    // Validate each lot has sufficient quantity
    for (const selectedLot of validLots) {
      const inventoryLot = availableLots.find((lot) => lot.lotNumber === selectedLot.lotNumber);
      if (inventoryLot && selectedLot.quantity > inventoryLot.quantity) {
        showErrorToast(
          'Insufficient inventory',
          `Lot ${selectedLot.lotNumber} only has ${inventoryLot.quantity} units available (you entered ${selectedLot.quantity})`,
        );
        return;
      }
    }

    // Create one dispensing record per lot
    validLots.forEach((selectedLot) => {
      const inventoryLot = availableLots.find((lot) => lot.lotNumber === selectedLot.lotNumber);

      const record: Omit<DispensingRecord, 'id'> = {
        medicationId: medication.id,
        medicationName: `${medication.name} ${medication.strength}`,
        patientId: patientId.trim(),
        patientInitials: patientInitials.trim(),
        quantity: selectedLot.quantity,
        dose: dose.trim(),
        lotNumber: selectedLot.lotNumber,
        expirationDate: inventoryLot?.expirationDate,
        dispensedBy: currentUser.name,
        physicianName: physicianName.trim(),
        studentName: studentName.trim() || undefined,
        dispensedAt: new Date(),
        indication: '', // Not tracked by client
        notes: notes.trim() || undefined,
        clinicSite: clinicSite.trim() || undefined,
      };

      console.log('🚀 MedicationDetail: About to call onDispense with record:', record);
      onDispense(record);
    });

  patientIdHistory.recordValue(patientId);
  patientInitialsHistory.recordValue(patientInitials);
  doseHistory.recordValue(dose);
  physicianHistory.recordValue(physicianName);
  studentHistory.recordValue(studentName);
  clinicSiteHistory.recordValue(clinicSite);

    console.log(`Medication dispensed successfully from ${validLots.length} lot(s)`);
    setIsDispenseDialogOpen(false);

    // Reset form
    setPatientId('');
    setPatientInitials('');
    setDose('');
    setSelectedLots([{ lotNumber: '', quantity: 0 }]);
    setPhysicianName('');
    setStudentName('');
    setClinicSite('');
    setNotes('');
  patientIdHistory.updateQuery('');
  patientInitialsHistory.updateQuery('');
  doseHistory.updateQuery('');
  physicianHistory.updateQuery('');
  studentHistory.updateQuery('');
  clinicSiteHistory.updateQuery('');
  };

  // Multi-lot helpers for dispensing
  const addLotSelection = () => {
    setSelectedLots([...selectedLots, { lotNumber: '', quantity: 0 }]);
  };

  const removeLotSelection = (index: number) => {
    if (selectedLots.length > 1) {
      setSelectedLots(selectedLots.filter((_, i) => i !== index));
    }
  };

  const updateLotSelection = (
    index: number,
    field: 'lotNumber' | 'quantity',
    value: string | number,
  ) => {
    const updated = [...selectedLots];
    if (field === 'lotNumber') {
      updated[index].lotNumber = value as string;
      // Auto-fill expiration date when lot is selected
      const lot = availableLots.find((l) => l.lotNumber === value);
      if (lot) {
        updated[index].expirationDate = lot.expirationDate;
      }
    } else {
      updated[index].quantity = typeof value === 'string' ? parseInt(value) || 0 : value;
    }
    setSelectedLots(updated);
  };

  // const totalQuantity = useMemo(() => {
  //   return selectedLots.reduce((sum, lot) => sum + (lot.quantity || 0), 0);
  // }, [selectedLots]);

  const handleAddLot = () => {
    setEditingLot(null);
    setLotNumber('');
    setLotQuantity('');
    setLotExpiration('');
    setIsLotDialogOpen(true);
  };

  const handleEditLot = (lot: InventoryItem) => {
    setEditingLot(lot);
    setLotNumber(lot.lotNumber);
    setLotQuantity(lot.quantity.toString());
    setLotExpiration(lot.expirationDate.toISOString().split('T')[0]);
    setIsLotDialogOpen(true);
  };

  const handleSaveLot = () => {
    if (!lotNumber.trim() || !lotQuantity || !lotExpiration) {
      showErrorToast('Missing lot information', 'Please fill in all lot fields');
      return;
    }

    const qty = parseInt(lotQuantity);
    if (qty < 0) {
      showErrorToast('Invalid quantity', 'Quantity must be positive');
      return;
    }

    if (editingLot) {
      // Update existing lot
      onUpdateLot?.(editingLot.id, {
        lotNumber: lotNumber.trim(),
        quantity: qty,
        expirationDate: new Date(lotExpiration),
      });
    } else {
      // Add new lot
      onAddLot?.({
        medicationId: medication.id,
        lotNumber: lotNumber.trim(),
        quantity: qty,
        expirationDate: new Date(lotExpiration),
      });
    }

    setIsLotDialogOpen(false);
  };

  const handleDeleteLot = (lotId: string) => {
    if (confirm('Are you sure you want to delete this lot?')) {
      onDeleteLot?.(lotId);
    }
  };

  const stockStatus = getStockStatus();
  const StatusIcon = stockStatus.icon;
  const canEditLots = !readOnly && currentUser?.role === 'pharmacy_staff';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{medication.name}</h1>
          <p className="text-muted-foreground">{medication.genericName}</p>
        </div>
        {readOnly && (
          <Button variant="outline" size="sm" onClick={() => onRequireAuth?.()}>
            Log in
          </Button>
        )}
      </div>

      {/* Stock Status Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusIcon className="size-5" />
              <div>
                <p className="font-medium">{stockStatus.status}</p>
                <p className="text-sm text-muted-foreground">
                  {medication.currentStock} units available
                </p>
              </div>
            </div>

            {medication.isAvailable && (
              readOnly ? (
                <Button variant="outline" onClick={() => onRequireAuth?.()}>
                  Log in to dispense
                </Button>
              ) : (
                <Dialog open={isDispenseDialogOpen} onOpenChange={setIsDispenseDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="size-4 mr-2" />
                      Dispense
                    </Button>
                  </DialogTrigger>
                  <DialogContent
                    className="max-h-[90vh] max-w-[90vw] sm:max-w-[700px]"
                    onOpenAutoFocus={(event) => event.preventDefault()}
                  >
                    <form
                      autoComplete="off"
                      className="flex flex-col gap-4"
                      onSubmit={(event) => {
                        event.preventDefault();
                        handleDispense();
                      }}
                    >
                      <DialogHeader>
                        <DialogTitle>Dispense {medication.name}</DialogTitle>
                        <DialogDescription>
                          Record medication dispensing for patient
                        </DialogDescription>
                      </DialogHeader>
                      <ScrollArea className="max-h-[60vh] pr-4">
                        <div className="space-y-4">
                      {/* Patient Information */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="patientId">Patient ID *</Label>
                          <div className="space-y-1">
                            <div className="relative">
                              <div className="history-suggestion-container">
                                <Input
                                  id="patientId"
                                  placeholder="e.g., 2025-196"
                                  autoComplete="off"
                                  ref={patientIdInputRef}
                                  value={patientId}
                                  onFocus={() => {
                                    setOpenPatientId(true);
                                    patientIdHistory.updateQuery(patientId);
                                  }}
                                  onMouseDown={(event) => {
                                    if (
                                      document.activeElement === event.currentTarget &&
                                      event.currentTarget.value.trim() === ''
                                    ) {
                                      event.preventDefault();
                                      setOpenPatientId((prev) => {
                                        const next = !prev;
                                        if (next) {
                                          patientIdHistory.updateQuery(event.currentTarget.value);
                                        }
                                        return next;
                                      });
                                    }
                                  }}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setPatientId(value);
                                    patientIdHistory.updateQuery(value);
                                    if (!openPatientId) setOpenPatientId(true);
                                  }}
                                />
                                {openPatientId && patientIdHistory.suggestions.length > 0 && (
                                  <ul className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border bg-popover text-sm shadow" role="listbox">
                                    {patientIdHistory.suggestions.map((s) => (
                                      <li key={s.value}>
                                        <button
                                          type="button"
                                          className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-muted"
                                          onClick={() => {
                                            setPatientId(s.value);
                                            patientIdHistory.recordValue(s.value);
                                            patientIdHistory.updateQuery(s.value);
                                            setOpenPatientId(false);
                                          }}
                                        >
                                          <span>{s.value}</span>
                                          <span
                                            className="text-xs text-muted-foreground hover:text-destructive"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              patientIdHistory.clearEntry(s.value);
                                              patientIdHistory.updateQuery(patientId);
                                            }}
                                          >
                                            Clear
                                          </span>
                                        </button>
                                      </li>
                                    ))}
                                    <li className="border-t">
                                      <button
                                        type="button"
                                        className="w-full px-3 py-1.5 text-left text-xs text-muted-foreground hover:text-destructive hover:bg-muted"
                                        onClick={() => {
                                          patientIdHistory.clearAll();
                                          patientIdHistory.updateQuery(patientId);
                                        }}
                                      >
                                        Clear all
                                      </button>
                                    </li>
                                  </ul>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="initials">Patient Initials *</Label>
                          <div className="space-y-1">
                            <div className="relative">
                              <div className="history-suggestion-container">
                                <Input
                                  id="initials"
                                  placeholder="e.g., J.D."
                                  autoComplete="off"
                                  ref={patientInitialsInputRef}
                                  value={patientInitials}
                                  onFocus={() => {
                                    setOpenPatientInitials(true);
                                    patientInitialsHistory.updateQuery(patientInitials);
                                  }}
                                  onMouseDown={(event) => {
                                    if (
                                      document.activeElement === event.currentTarget &&
                                      event.currentTarget.value.trim() === ''
                                    ) {
                                      event.preventDefault();
                                      setOpenPatientInitials((prev) => {
                                        const next = !prev;
                                        if (next) {
                                          patientInitialsHistory.updateQuery(
                                            event.currentTarget.value,
                                          );
                                        }
                                        return next;
                                      });
                                    }
                                  }}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setPatientInitials(value);
                                    patientInitialsHistory.updateQuery(value);
                                    if (!openPatientInitials) setOpenPatientInitials(true);
                                  }}
                                />
                                {openPatientInitials && patientInitialsHistory.suggestions.length > 0 && (
                                  <ul className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border bg-popover text-sm shadow" role="listbox">
                                    {patientInitialsHistory.suggestions.map((s) => (
                                      <li key={s.value}>
                                        <button
                                          type="button"
                                          className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-muted"
                                          onClick={() => {
                                            setPatientInitials(s.value);
                                            patientInitialsHistory.recordValue(s.value);
                                            patientInitialsHistory.updateQuery(s.value);
                                            setOpenPatientInitials(false);
                                          }}
                                        >
                                          <span>{s.value}</span>
                                          <span
                                            className="text-xs text-muted-foreground hover:text-destructive"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              patientInitialsHistory.clearEntry(s.value);
                                              patientInitialsHistory.updateQuery(patientInitials);
                                            }}
                                          >
                                            Clear
                                          </span>
                                        </button>
                                      </li>
                                    ))}
                                    <li className="border-t">
                                      <button
                                        type="button"
                                        className="w-full px-3 py-1.5 text-left text-xs text-muted-foreground hover:text-destructive hover:bg-muted"
                                        onClick={() => {
                                          patientInitialsHistory.clearAll();
                                          patientInitialsHistory.updateQuery(patientInitials);
                                        }}
                                      >
                                        Clear all
                                      </button>
                                    </li>
                                  </ul>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Dose Instructions */}
                      <div className="space-y-2">
                        <Label htmlFor="dose">Dose Instructions *</Label>
                        <div className="space-y-1">
                          <div className="relative">
                            <div className="history-suggestion-container">
                              <Input
                                id="dose"
                                placeholder="e.g., 1 tab, PRN, 1 gtt"
                                autoComplete="off"
                                ref={doseInputRef}
                                value={dose}
                                onFocus={() => {
                                  setOpenDose(true);
                                  doseHistory.updateQuery(dose);
                                }}
                                onMouseDown={(event) => {
                                  if (
                                    document.activeElement === event.currentTarget &&
                                    event.currentTarget.value.trim() === ''
                                  ) {
                                    event.preventDefault();
                                    setOpenDose((prev) => {
                                      const next = !prev;
                                      if (next) {
                                        doseHistory.updateQuery(event.currentTarget.value);
                                      }
                                      return next;
                                    });
                                  }
                                }}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setDose(value);
                                  doseHistory.updateQuery(value);
                                  if (!openDose) setOpenDose(true);
                                }}
                              />
                              {openDose && doseHistory.suggestions.length > 0 && (
                                <ul className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border bg-popover text-sm shadow" role="listbox">
                                  {doseHistory.suggestions.map((s) => (
                                    <li key={s.value}>
                                      <button
                                        type="button"
                                        className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-muted"
                                        onClick={() => {
                                          setDose(s.value);
                                          doseHistory.recordValue(s.value);
                                          doseHistory.updateQuery(s.value);
                                          setOpenDose(false);
                                        }}
                                      >
                                        <span>{s.value}</span>
                                        <span
                                          className="text-xs text-muted-foreground hover:text-destructive"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            doseHistory.clearEntry(s.value);
                                            doseHistory.updateQuery(dose);
                                          }}
                                        >
                                          Clear
                                        </span>
                                      </button>
                                    </li>
                                  ))}
                                  <li className="border-t">
                                    <button
                                      type="button"
                                      className="w-full px-3 py-1.5 text-left text-xs text-muted-foreground hover:text-destructive hover:bg-muted"
                                      onClick={() => {
                                        doseHistory.clearAll();
                                        doseHistory.updateQuery(dose);
                                      }}
                                    >
                                      Clear all
                                    </button>
                                  </li>
                                </ul>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Multi-Lot Selection */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Lots to Dispense *</Label>
                          <p className="text-sm text-muted-foreground">
                            Total: {medication.currentStock} units
                          </p>
                        </div>

                        {selectedLots.map((lot, index) => {
                          const inventoryLot = availableLots.find(
                            (l) => l.lotNumber === lot.lotNumber,
                          );
                          const lotSelectId = `lot-select-${index}`;
                          const lotQuantityId = `lot-quantity-${index}`;
                          return (
                            <div
                              key={index}
                              className="flex gap-2 items-start p-3 border rounded-md bg-muted/30"
                            >
                              <div className="flex-1 space-y-2">
                                <div className="space-y-1">
                                  <Label htmlFor={lotSelectId} className="text-xs">
                                    Lot Number
                                  </Label>
                                  <Select
                                    value={lot.lotNumber}
                                    onValueChange={(value: string) =>
                                      updateLotSelection(index, 'lotNumber', value)
                                    }
                                  >
                                    <SelectTrigger id={lotSelectId} className="h-9">
                                      <SelectValue placeholder="Select lot" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {availableLots.map((availLot) => (
                                        <SelectItem
                                          key={availLot.lotNumber}
                                          value={availLot.lotNumber}
                                        >
                                          {availLot.lotNumber} - Exp:{' '}
                                          {availLot.expirationDate.toLocaleDateString()} - Qty:{' '}
                                          {availLot.quantity}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <Label htmlFor={lotQuantityId} className="text-xs">
                                      Quantity
                                    </Label>
                                    <Input
                                      id={lotQuantityId}
                                      type="number"
                                      min="0"
                                      max={inventoryLot?.quantity || 9999}
                                      value={lot.quantity || ''}
                                      onChange={(e) =>
                                        updateLotSelection(index, 'quantity', e.target.value)
                                      }
                                      placeholder="0"
                                      className="h-9"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Available</Label>
                                    <p className="text-sm font-medium py-2">
                                      {inventoryLot ? `${inventoryLot.quantity} units` : '-'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              {selectedLots.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeLotSelection(index)}
                                  className="h-9 px-2 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              )}
                            </div>
                          );
                        })}

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addLotSelection}
                          className="w-full"
                        >
                          <Plus className="size-4 mr-2" />
                          Add Another Lot
                        </Button>
                      </div>

                      {/* Provider Information */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="physician">Physician Name *</Label>
                          <div className="space-y-1">
                            <div className="relative">
                              <div className="history-suggestion-container">
                                <Input
                                  id="physician"
                                  name="physician-name"
                                  placeholder="e.g., Dr. Smith"
                                  autoComplete="off"
                                  autoCapitalize="words"
                                  ref={physicianInputRef}
                                  value={physicianName}
                                  onFocus={() => {
                                    setOpenPhysician(true);
                                    physicianHistory.updateQuery(physicianName);
                                  }}
                                  onMouseDown={(event) => {
                                    if (
                                      document.activeElement === event.currentTarget &&
                                      event.currentTarget.value.trim() === ''
                                    ) {
                                      event.preventDefault();
                                      setOpenPhysician((prev) => {
                                        const next = !prev;
                                        if (next) {
                                          physicianHistory.updateQuery(event.currentTarget.value);
                                        }
                                        return next;
                                      });
                                    }
                                  }}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setPhysicianName(value);
                                    physicianHistory.updateQuery(value);
                                    if (!openPhysician) setOpenPhysician(true);
                                  }}
                                />
                                {openPhysician && physicianHistory.suggestions.length > 0 && (
                                  <ul className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border bg-popover text-sm shadow" role="listbox">
                                    {physicianHistory.suggestions.map((s) => (
                                      <li key={s.value}>
                                        <button
                                          type="button"
                                          className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-muted"
                                          onClick={() => {
                                            setPhysicianName(s.value);
                                            physicianHistory.recordValue(s.value);
                                            physicianHistory.updateQuery(s.value);
                                            setOpenPhysician(false);
                                          }}
                                        >
                                          <span>{s.value}</span>
                                          <span
                                            className="text-xs text-muted-foreground hover:text-destructive"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              physicianHistory.clearEntry(s.value);
                                              physicianHistory.updateQuery(physicianName);
                                            }}
                                          >
                                            Clear
                                          </span>
                                        </button>
                                      </li>
                                    ))}
                                    <li className="border-t">
                                      <button
                                        type="button"
                                        className="w-full px-3 py-1.5 text-left text-xs text-muted-foreground hover:text-destructive hover:bg-muted"
                                        onClick={() => {
                                          physicianHistory.clearAll();
                                          physicianHistory.updateQuery(physicianName);
                                        }}
                                      >
                                        Clear all
                                      </button>
                                    </li>
                                  </ul>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="student">Student Name</Label>
                          <div className="space-y-1">
                            <div className="relative">
                              <div className="history-suggestion-container">
                                <Input
                                  id="student"
                                  placeholder="e.g., Jane Doe (optional)"
                                  autoComplete="off"
                                  ref={studentInputRef}
                                  value={studentName}
                                  onFocus={() => {
                                    setOpenStudent(true);
                                    studentHistory.updateQuery(studentName);
                                  }}
                                  onMouseDown={(event) => {
                                    if (
                                      document.activeElement === event.currentTarget &&
                                      event.currentTarget.value.trim() === ''
                                    ) {
                                      event.preventDefault();
                                      setOpenStudent((prev) => {
                                        const next = !prev;
                                        if (next) {
                                          studentHistory.updateQuery(event.currentTarget.value);
                                        }
                                        return next;
                                      });
                                    }
                                  }}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setStudentName(value);
                                    studentHistory.updateQuery(value);
                                    if (!openStudent) setOpenStudent(true);
                                  }}
                                />
                                {openStudent && studentHistory.suggestions.length > 0 && (
                                  <ul className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border bg-popover text-sm shadow" role="listbox">
                                    {studentHistory.suggestions.map((s) => (
                                      <li key={s.value}>
                                        <button
                                          type="button"
                                          className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-muted"
                                          onClick={() => {
                                            setStudentName(s.value);
                                            studentHistory.recordValue(s.value);
                                            studentHistory.updateQuery(s.value);
                                            setOpenStudent(false);
                                          }}
                                        >
                                          <span>{s.value}</span>
                                          <span
                                            className="text-xs text-muted-foreground hover:text-destructive"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              studentHistory.clearEntry(s.value);
                                              studentHistory.updateQuery(studentName);
                                            }}
                                          >
                                            Clear
                                          </span>
                                        </button>
                                      </li>
                                    ))}
                                    <li className="border-t">
                                      <button
                                        type="button"
                                        className="w-full px-3 py-1.5 text-left text-xs text-muted-foreground hover:text-destructive hover:bg-muted"
                                        onClick={() => {
                                          studentHistory.clearAll();
                                          studentHistory.updateQuery(studentName);
                                        }}
                                      >
                                        Clear all
                                      </button>
                                    </li>
                                  </ul>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Clinic Site */}
                      <div className="space-y-2">
                        <Label htmlFor="clinic-site">Clinic Site</Label>
                        <div className="space-y-1">
                          <div className="relative">
                            <div className="history-suggestion-container">
                              <Input
                                id="clinic-site"
                                placeholder="e.g., Bainbridge, Moultrie, etc."
                                autoComplete="off"
                                ref={clinicInputRef}
                                value={clinicSite}
                                onFocus={() => {
                                  setOpenClinic(true);
                                  clinicSiteHistory.updateQuery(clinicSite);
                                }}
                                onMouseDown={(event) => {
                                  if (
                                    document.activeElement === event.currentTarget &&
                                    event.currentTarget.value.trim() === ''
                                  ) {
                                    event.preventDefault();
                                    setOpenClinic((prev) => {
                                      const next = !prev;
                                      if (next) {
                                        clinicSiteHistory.updateQuery(event.currentTarget.value);
                                      }
                                      return next;
                                    });
                                  }
                                }}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setClinicSite(value);
                                  clinicSiteHistory.updateQuery(value);
                                  if (!openClinic) setOpenClinic(true);
                                }}
                              />
                              {openClinic && clinicSiteHistory.suggestions.length > 0 && (
                                <ul className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border bg-popover text-sm shadow" role="listbox">
                                  {clinicSiteHistory.suggestions.map((s) => (
                                    <li key={s.value}>
                                      <button
                                        type="button"
                                        className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-muted"
                                        onClick={() => {
                                          setClinicSite(s.value);
                                          clinicSiteHistory.recordValue(s.value);
                                          clinicSiteHistory.updateQuery(s.value);
                                          setOpenClinic(false);
                                        }}
                                      >
                                        <span>{s.value}</span>
                                        <span
                                          className="text-xs text-muted-foreground hover:text-destructive"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            clinicSiteHistory.clearEntry(s.value);
                                            clinicSiteHistory.updateQuery(clinicSite);
                                          }}
                                        >
                                          Clear
                                        </span>
                                      </button>
                                    </li>
                                  ))}
                                  <li className="border-t">
                                    <button
                                      type="button"
                                      className="w-full px-3 py-1.5 text-left text-xs text-muted-foreground hover:text-destructive hover:bg-muted"
                                      onClick={() => {
                                        clinicSiteHistory.clearAll();
                                        clinicSiteHistory.updateQuery(clinicSite);
                                      }}
                                    >
                                      Clear all
                                    </button>
                                  </li>
                                </ul>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Notes */}
                      <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                          id="notes"
                          placeholder="Optional notes..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={2}
                        />
                      </div>

                        </div>
                      </ScrollArea>
                      <div className="flex gap-2 pt-4">
                        <Button type="submit" className="w-full">
                          Confirm Dispensing
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )
            )}
          </div>
        </CardContent>
      </Card>

      {/* Medication Details */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Medication Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-sm font-medium">Strength</Label>
              <p className="text-sm">{medication.strength}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Dosage Form</Label>
              <p className="text-sm">{medication.dosageForm}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Category</Label>
              <Badge variant="outline">{medication.category}</Badge>
            </div>
            <div>
              <Label className="text-sm font-medium">Last Updated</Label>
              <p className="text-sm text-muted-foreground">
                {medication.lastUpdated.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clinical Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-sm font-medium">Common Uses</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {medication.commonUses.map((use) => (
                  <Badge key={use} variant="secondary" className="text-xs">
                    {use}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Contraindications</Label>
              <div className="space-y-1 mt-1">
                {medication.contraindications.map((contra) => (
                  <div key={contra} className="flex items-center gap-2">
                    <AlertCircle className="size-3 text-amber-500" />
                    <span className="text-sm">{contra}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inventory Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="size-4" />
              Inventory Details
            </CardTitle>
            {canEditLots && (
              <Button variant="outline" size="sm" onClick={handleAddLot}>
                <Plus className="size-4 mr-1" />
                Add Lot
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {medicationInventory.length > 0 ? (
            <div className="space-y-2">
              {medicationInventory.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex-1">
                    <p className="font-medium">Lot: {inv.lotNumber}</p>
                    <p className="text-sm text-muted-foreground">Quantity: {inv.quantity} units</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        <Clock className="size-3" />
                        <span className="text-sm">
                          Exp: {inv.expirationDate.toLocaleDateString()}
                        </span>
                      </div>
                      {inv.isExpired && (
                        <Badge variant="destructive" className="text-xs mt-1">
                          Expired
                        </Badge>
                      )}
                    </div>
                    {canEditLots && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditLot(inv)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteLot(inv.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Package className="size-12 mx-auto mb-2 opacity-30" />
              <p>No lot numbers recorded</p>
              {canEditLots && (
                <Button variant="outline" size="sm" onClick={handleAddLot} className="mt-3">
                  <Plus className="size-4 mr-1" />
                  Add First Lot
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alternatives */}
      {(!medication.isAvailable || medication.currentStock <= medication.minStock) &&
        alternatives.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Alternative Medications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {alternatives.map((alt) => (
                  <div
                    key={alt.id}
                    className="flex items-center justify-between p-3 border rounded cursor-pointer hover:bg-muted/50"
                    onClick={() => onSelectAlternative(alt)}
                  >
                    <div>
                      <p className="font-medium">
                        {alt.name} {alt.strength}
                      </p>
                      <p className="text-sm text-muted-foreground">{alt.genericName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-green-600">{alt.currentStock} available</p>
                      <p className="text-xs text-muted-foreground">Click to view</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      {/* Lot Edit/Add Dialog */}
      {canEditLots && (
        <Dialog open={isLotDialogOpen} onOpenChange={setIsLotDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingLot ? 'Edit Lot Number' : 'Add Lot Number'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="lot-number">Lot Number *</Label>
                <Input
                  id="lot-number"
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                  placeholder="e.g., EW0646, 11953A"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lot-quantity">Quantity *</Label>
                <Input
                  id="lot-quantity"
                  type="number"
                  value={lotQuantity}
                  onChange={(e) => setLotQuantity(e.target.value)}
                  min="0"
                  placeholder="e.g., 100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lot-expiration">Expiration Date *</Label>
                <Input
                  id="lot-expiration"
                  type="date"
                  value={lotExpiration}
                  onChange={(e) => setLotExpiration(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsLotDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveLot}>{editingLot ? 'Update' : 'Add'} Lot</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
