import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { useFieldHistory, type FieldHistoryEntry } from '../hooks/useFieldHistory';
import { showErrorToast } from '../utils/toastUtils';

const isBrowser = typeof window !== 'undefined';

interface HistoryDropdownProps {
  anchorRef: React.RefObject<HTMLInputElement>;
  suggestions: FieldHistoryEntry[];
  onSelect: (value: string) => void;
  onClearEntry: (value: string) => void;
  onClearAll: () => void;
  onClose: () => void;
}

function HistoryDropdown({ anchorRef, suggestions, onSelect, onClearEntry, onClearAll, onClose }: HistoryDropdownProps) {
  if (!suggestions.length) {
    return null;
  }

  if (!isBrowser) {
    return null;
  }

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );

  useEffect(() => {
    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) {
        setPosition(null);
        return;
      }
      const rect = anchor.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (anchorRef.current?.contains(target)) {
        return;
      }
      if (dropdownRef.current?.contains(target)) {
        return;
      }
      onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [anchorRef, onClose]);

  if (!position) {
    return null;
  }

  return createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: position.width,
        zIndex: 2000,
      }}
      className="overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-xl"
    >
      <ul className="max-h-48 overflow-y-auto text-sm">
        {suggestions.map((entry) => (
          <li key={entry.value} className="flex items-center gap-1 border-b last:border-b-0">
            <button
              type="button"
              className="flex-1 px-3 py-2 text-left hover:bg-muted"
              onMouseDown={(event) => {
                event.preventDefault();
                onSelect(entry.value);
              }}
            >
              {entry.value}
            </button>
            <button
              type="button"
              className="px-2 text-xs text-muted-foreground hover:text-destructive"
              onMouseDown={(event) => {
                event.preventDefault();
                onClearEntry(entry.value);
              }}
            >
              Clear
            </button>
          </li>
        ))}
      </ul>
      <div className="flex justify-end border-t bg-muted/40 px-2 py-1">
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-destructive"
          onMouseDown={(event) => {
            event.preventDefault();
            onClearAll();
          }}
        >
          Clear all
        </button>
      </div>
    </div>,
    document.body,
  );
}

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

  const [activeHistoryField, setActiveHistoryField] = useState<string | null>(null);

  useEffect(() => {
    if (!isDispenseDialogOpen) {
      setActiveHistoryField(null);
    }
  }, [isDispenseDialogOpen]);

  const scheduleHistoryClose = (fieldKey: string) => {
    if (typeof window === 'undefined') {
      return;
    }

    window.setTimeout(() => {
      setActiveHistoryField((current) => (current === fieldKey ? null : current));
    }, 120);
  };

  const patientIdSuggestionsOpen =
    activeHistoryField === 'patientId' && patientIdHistory.suggestions.length > 0;
  const patientInitialsSuggestionsOpen =
    activeHistoryField === 'patientInitials' && patientInitialsHistory.suggestions.length > 0;
  const doseSuggestionsOpen =
    activeHistoryField === 'dose' && doseHistory.suggestions.length > 0;
  const physicianSuggestionsOpen =
    activeHistoryField === 'physician' && physicianHistory.suggestions.length > 0;
  const studentSuggestionsOpen =
    activeHistoryField === 'student' && studentHistory.suggestions.length > 0;
  const clinicSuggestionsOpen =
    activeHistoryField === 'clinic' && clinicSiteHistory.suggestions.length > 0;

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
                              <Input
                                id="patientId"
                                placeholder="e.g., 2025-196"
                                autoComplete="off"
                                ref={patientIdInputRef}
                                value={patientId}
                                onFocus={() => {
                                  setActiveHistoryField('patientId');
                                  patientIdHistory.updateQuery(patientId);
                                }}
                                onMouseDown={(event) => {
                                  if (document.activeElement === event.currentTarget) {
                                    event.preventDefault();
                                    const value = event.currentTarget.value;
                                    setActiveHistoryField((current) => {
                                      const next = current === 'patientId' ? null : 'patientId';
                                      if (next) {
                                        patientIdHistory.updateQuery(value);
                                      }
                                      return next;
                                    });
                                  }
                                }}
                                onBlur={() => scheduleHistoryClose('patientId')}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setPatientId(value);
                                  patientIdHistory.updateQuery(value);
                                }}
                              />
                              {patientIdSuggestionsOpen && (
                                <HistoryDropdown
                                  anchorRef={patientIdInputRef}
                                  suggestions={patientIdHistory.suggestions}
                                  onSelect={(value) => {
                                    setPatientId(value);
                                    patientIdHistory.recordValue(value);
                                    patientIdHistory.updateQuery(value);
                                    setActiveHistoryField(null);
                                  }}
                                  onClearEntry={(value) => {
                                    patientIdHistory.clearEntry(value);
                                    patientIdHistory.updateQuery(patientId);
                                  }}
                                  onClearAll={() => {
                                    patientIdHistory.clearAll();
                                    patientIdHistory.updateQuery(patientId);
                                  }}
                                  onClose={() => {
                                    setActiveHistoryField(null);
                                    patientIdHistory.updateQuery(patientId);
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="initials">Patient Initials *</Label>
                          <div className="space-y-1">
                            <div className="relative">
                              <Input
                                id="initials"
                                placeholder="e.g., J.D."
                                autoComplete="off"
                                ref={patientInitialsInputRef}
                                value={patientInitials}
                                onFocus={() => {
                                  setActiveHistoryField('patientInitials');
                                  patientInitialsHistory.updateQuery(patientInitials);
                                }}
                                onMouseDown={(event) => {
                                  if (document.activeElement === event.currentTarget) {
                                    event.preventDefault();
                                    const value = event.currentTarget.value;
                                    setActiveHistoryField((current) => {
                                      const next =
                                        current === 'patientInitials' ? null : 'patientInitials';
                                      if (next) {
                                        patientInitialsHistory.updateQuery(value);
                                      }
                                      return next;
                                    });
                                  }
                                }}
                                onBlur={() => scheduleHistoryClose('patientInitials')}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setPatientInitials(value);
                                  patientInitialsHistory.updateQuery(value);
                                }}
                              />
                              {patientInitialsSuggestionsOpen && (
                                <HistoryDropdown
                                  anchorRef={patientInitialsInputRef}
                                  suggestions={patientInitialsHistory.suggestions}
                                  onSelect={(value) => {
                                    setPatientInitials(value);
                                    patientInitialsHistory.recordValue(value);
                                    patientInitialsHistory.updateQuery(value);
                                    setActiveHistoryField(null);
                                  }}
                                  onClearEntry={(value) => {
                                    patientInitialsHistory.clearEntry(value);
                                    patientInitialsHistory.updateQuery(patientInitials);
                                  }}
                                  onClearAll={() => {
                                    patientInitialsHistory.clearAll();
                                    patientInitialsHistory.updateQuery(patientInitials);
                                  }}
                                  onClose={() => {
                                    setActiveHistoryField(null);
                                    patientInitialsHistory.updateQuery(patientInitials);
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Dose Instructions */}
                      <div className="space-y-2">
                        <Label htmlFor="dose">Dose Instructions *</Label>
                        <div className="space-y-1">
                          <div className="relative">
                            <Input
                              id="dose"
                              placeholder="e.g., 1 tab, PRN, 1 gtt"
                              autoComplete="off"
                              ref={doseInputRef}
                              value={dose}
                              onFocus={() => {
                                setActiveHistoryField('dose');
                                doseHistory.updateQuery(dose);
                              }}
                              onMouseDown={(event) => {
                                if (document.activeElement === event.currentTarget) {
                                  event.preventDefault();
                                  const value = event.currentTarget.value;
                                  setActiveHistoryField((current) => {
                                    const next = current === 'dose' ? null : 'dose';
                                    if (next) {
                                      doseHistory.updateQuery(value);
                                    }
                                    return next;
                                  });
                                }
                              }}
                              onBlur={() => scheduleHistoryClose('dose')}
                              onChange={(e) => {
                                const value = e.target.value;
                                setDose(value);
                                doseHistory.updateQuery(value);
                              }}
                            />
                            {doseSuggestionsOpen && (
                              <HistoryDropdown
                                anchorRef={doseInputRef}
                                suggestions={doseHistory.suggestions}
                                onSelect={(value) => {
                                  setDose(value);
                                  doseHistory.recordValue(value);
                                  doseHistory.updateQuery(value);
                                  setActiveHistoryField(null);
                                }}
                                onClearEntry={(value) => {
                                  doseHistory.clearEntry(value);
                                  doseHistory.updateQuery(dose);
                                }}
                                onClearAll={() => {
                                  doseHistory.clearAll();
                                  doseHistory.updateQuery(dose);
                                }}
                                onClose={() => {
                                  setActiveHistoryField(null);
                                  doseHistory.updateQuery(dose);
                                }}
                              />
                            )}
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
                              <Input
                                id="physician"
                                name="physician-name"
                                placeholder="e.g., Dr. Smith"
                                autoComplete="off"
                                autoCapitalize="words"
                                ref={physicianInputRef}
                                value={physicianName}
                                onFocus={() => {
                                  setActiveHistoryField('physician');
                                  physicianHistory.updateQuery(physicianName);
                                }}
                                onMouseDown={(event) => {
                                  if (document.activeElement === event.currentTarget) {
                                    event.preventDefault();
                                    const value = event.currentTarget.value;
                                    setActiveHistoryField((current) => {
                                      const next = current === 'physician' ? null : 'physician';
                                      if (next) {
                                        physicianHistory.updateQuery(value);
                                      }
                                      return next;
                                    });
                                  }
                                }}
                                onBlur={() => scheduleHistoryClose('physician')}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setPhysicianName(value);
                                  physicianHistory.updateQuery(value);
                                }}
                              />
                              {physicianSuggestionsOpen && (
                                <HistoryDropdown
                                  anchorRef={physicianInputRef}
                                  suggestions={physicianHistory.suggestions}
                                  onSelect={(value) => {
                                    setPhysicianName(value);
                                    physicianHistory.recordValue(value);
                                    physicianHistory.updateQuery(value);
                                    setActiveHistoryField(null);
                                  }}
                                  onClearEntry={(value) => {
                                    physicianHistory.clearEntry(value);
                                    physicianHistory.updateQuery(physicianName);
                                  }}
                                  onClearAll={() => {
                                    physicianHistory.clearAll();
                                    physicianHistory.updateQuery(physicianName);
                                  }}
                                  onClose={() => {
                                    setActiveHistoryField(null);
                                    physicianHistory.updateQuery(physicianName);
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="student">Student Name</Label>
                          <div className="space-y-1">
                            <div className="relative">
                              <Input
                                id="student"
                                placeholder="e.g., Jane Doe (optional)"
                                autoComplete="off"
                                ref={studentInputRef}
                                value={studentName}
                                onFocus={() => {
                                  setActiveHistoryField('student');
                                  studentHistory.updateQuery(studentName);
                                }}
                                onMouseDown={(event) => {
                                  if (document.activeElement === event.currentTarget) {
                                    event.preventDefault();
                                    const value = event.currentTarget.value;
                                    setActiveHistoryField((current) => {
                                      const next = current === 'student' ? null : 'student';
                                      if (next) {
                                        studentHistory.updateQuery(value);
                                      }
                                      return next;
                                    });
                                  }
                                }}
                                onBlur={() => scheduleHistoryClose('student')}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setStudentName(value);
                                  studentHistory.updateQuery(value);
                                }}
                              />
                              {studentSuggestionsOpen && (
                                <HistoryDropdown
                                  anchorRef={studentInputRef}
                                  suggestions={studentHistory.suggestions}
                                  onSelect={(value) => {
                                    setStudentName(value);
                                    studentHistory.recordValue(value);
                                    studentHistory.updateQuery(value);
                                    setActiveHistoryField(null);
                                  }}
                                  onClearEntry={(value) => {
                                    studentHistory.clearEntry(value);
                                    studentHistory.updateQuery(studentName);
                                  }}
                                  onClearAll={() => {
                                    studentHistory.clearAll();
                                    studentHistory.updateQuery(studentName);
                                  }}
                                  onClose={() => {
                                    setActiveHistoryField(null);
                                    studentHistory.updateQuery(studentName);
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Clinic Site */}
                      <div className="space-y-2">
                        <Label htmlFor="clinic-site">Clinic Site</Label>
                        <div className="space-y-1">
                          <div className="relative">
                            <Input
                              id="clinic-site"
                              placeholder="e.g., Bainbridge, Moultrie, etc."
                              autoComplete="off"
                              ref={clinicInputRef}
                              value={clinicSite}
                              onFocus={() => {
                                setActiveHistoryField('clinic');
                                clinicSiteHistory.updateQuery(clinicSite);
                              }}
                              onMouseDown={(event) => {
                                if (document.activeElement === event.currentTarget) {
                                  event.preventDefault();
                                  const value = event.currentTarget.value;
                                  setActiveHistoryField((current) => {
                                    const next = current === 'clinic' ? null : 'clinic';
                                    if (next) {
                                      clinicSiteHistory.updateQuery(value);
                                    }
                                    return next;
                                  });
                                }
                              }}
                              onBlur={() => scheduleHistoryClose('clinic')}
                              onChange={(e) => {
                                const value = e.target.value;
                                setClinicSite(value);
                                clinicSiteHistory.updateQuery(value);
                              }}
                            />
                            {clinicSuggestionsOpen && (
                              <HistoryDropdown
                                anchorRef={clinicInputRef}
                                suggestions={clinicSiteHistory.suggestions}
                                onSelect={(value) => {
                                  setClinicSite(value);
                                  clinicSiteHistory.recordValue(value);
                                  clinicSiteHistory.updateQuery(value);
                                  setActiveHistoryField(null);
                                }}
                                onClearEntry={(value) => {
                                  clinicSiteHistory.clearEntry(value);
                                  clinicSiteHistory.updateQuery(clinicSite);
                                }}
                                onClearAll={() => {
                                  clinicSiteHistory.clearAll();
                                  clinicSiteHistory.updateQuery(clinicSite);
                                }}
                                onClose={() => {
                                  setActiveHistoryField(null);
                                  clinicSiteHistory.updateQuery(clinicSite);
                                }}
                              />
                            )}
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
