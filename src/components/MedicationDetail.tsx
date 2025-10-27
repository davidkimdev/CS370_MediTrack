import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { AlertTriangle, CheckCircle, ArrowLeft, Package, Clock, AlertCircle, Plus, Edit2, Trash2 } from 'lucide-react';
import { Medication, DispensingRecord, InventoryItem, User } from '../types/medication';
import { showErrorToast } from '../utils/toastUtils';

interface MedicationDetailProps {
  medication: Medication;
  alternatives: Medication[];
  inventory: InventoryItem[];
  currentUser: User;
  onBack: () => void;
  onDispense: (record: Omit<DispensingRecord, 'id'>) => void;
  onSelectAlternative: (medication: Medication) => void;
  onAddLot?: (lot: Omit<InventoryItem, 'id' | 'isExpired'>) => void;
  onUpdateLot?: (id: string, updates: Partial<Pick<InventoryItem, 'quantity' | 'lotNumber' | 'expirationDate'>>) => void;
  onDeleteLot?: (id: string) => void;
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
  onBack,
  onDispense,
  onSelectAlternative,
  onAddLot,
  onUpdateLot,
  onDeleteLot
}: MedicationDetailProps) {
  const [isDispenseDialogOpen, setIsDispenseDialogOpen] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [patientInitials, setPatientInitials] = useState('');
  const [dose, setDose] = useState('');
  const [selectedLots, setSelectedLots] = useState<LotSelection[]>([{ lotNumber: '', quantity: 0 }]);
  const [physicianName, setPhysicianName] = useState('');
  const [studentName, setStudentName] = useState('');
  const [clinicSite, setClinicSite] = useState('');
  const [notes, setNotes] = useState('');

  // Lot editing state
  const [isLotDialogOpen, setIsLotDialogOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<InventoryItem | null>(null);
  const [lotNumber, setLotNumber] = useState('');
  const [lotQuantity, setLotQuantity] = useState('');
  const [lotExpiration, setLotExpiration] = useState('');

  const medicationInventory = inventory.filter(inv => inv.medicationId === medication.id);
  const availableLots = medicationInventory.filter(inv => !inv.isExpired && inv.quantity > 0);

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
    // Validate required fields
    if (!patientId.trim() || !patientInitials.trim() || !dose.trim() ||
        !physicianName.trim()) {
      showErrorToast(
        'Missing required fields',
        'Please fill in all required fields (marked with *)'
      );
      return;
    }

    // Validate lots
    const validLots = selectedLots.filter(lot => lot.lotNumber && lot.quantity > 0);
    if (validLots.length === 0) {
      showErrorToast(
        'No lots selected',
        'Please select at least one lot with quantity > 0'
      );
      return;
    }

    // Validate each lot has sufficient quantity
    for (const selectedLot of validLots) {
      const inventoryLot = availableLots.find(lot => lot.lotNumber === selectedLot.lotNumber);
      if (inventoryLot && selectedLot.quantity > inventoryLot.quantity) {
        showErrorToast(
          'Insufficient inventory',
          `Lot ${selectedLot.lotNumber} only has ${inventoryLot.quantity} units available (you entered ${selectedLot.quantity})`
        );
        return;
      }
    }

    // Create one dispensing record per lot
    validLots.forEach(selectedLot => {
      const inventoryLot = availableLots.find(lot => lot.lotNumber === selectedLot.lotNumber);

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

      onDispense(record);
    });

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

  const updateLotSelection = (index: number, field: 'lotNumber' | 'quantity', value: string | number) => {
    const updated = [...selectedLots];
    if (field === 'lotNumber') {
      updated[index].lotNumber = value as string;
      // Auto-fill expiration date when lot is selected
      const lot = availableLots.find(l => l.lotNumber === value);
      if (lot) {
        updated[index].expirationDate = lot.expirationDate;
      }
    } else {
      updated[index].quantity = typeof value === 'string' ? parseInt(value) || 0 : value;
    }
    setSelectedLots(updated);
  };

  const totalQuantity = useMemo(() => {
    return selectedLots.reduce((sum, lot) => sum + (lot.quantity || 0), 0);
  }, [selectedLots]);

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
      showErrorToast(
        'Missing lot information',
        'Please fill in all lot fields'
      );
      return;
    }

    const qty = parseInt(lotQuantity);
    if (qty < 0) {
      showErrorToast(
        'Invalid quantity',
        'Quantity must be positive'
      );
      return;
    }

    if (editingLot) {
      // Update existing lot
      onUpdateLot?.(editingLot.id, {
        lotNumber: lotNumber.trim(),
        quantity: qty,
        expirationDate: new Date(lotExpiration)
      });
    } else {
      // Add new lot
      onAddLot?.({
        medicationId: medication.id,
        lotNumber: lotNumber.trim(),
        quantity: qty,
        expirationDate: new Date(lotExpiration)
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
  const canEditLots = currentUser.role === 'pharmacy_staff';

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
              <Dialog open={isDispenseDialogOpen} onOpenChange={setIsDispenseDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="size-4 mr-2" />
                    Dispense
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Dispense {medication.name}</DialogTitle>
                    <DialogDescription>Record medication dispensing for patient</DialogDescription>
                  </DialogHeader>
                  <div className="max-h-[60vh] overflow-y-auto -mx-6 px-6">
                    <div className="space-y-4 py-2">
                    {/* Patient Information */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="patientId">Patient ID *</Label>
                        <Input
                          id="patientId"
                          placeholder="e.g., 2025-196"
                          value={patientId}
                          onChange={(e) => setPatientId(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="initials">Patient Initials *</Label>
                        <Input
                          id="initials"
                          placeholder="e.g., J.D."
                          value={patientInitials}
                          onChange={(e) => setPatientInitials(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Dose Instructions */}
                    <div className="space-y-2">
                      <Label htmlFor="dose">Dose Instructions *</Label>
                      <Input
                        id="dose"
                        placeholder="e.g., 1 tab, PRN, 1 gtt"
                        value={dose}
                        onChange={(e) => setDose(e.target.value)}
                      />
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
                        const inventoryLot = availableLots.find(l => l.lotNumber === lot.lotNumber);
                        const lotSelectId = `lot-select-${index}`;
                        const lotQuantityId = `lot-quantity-${index}`;
                        return (
                          <div key={index} className="flex gap-2 items-start p-3 border rounded-md bg-muted/30">
                            <div className="flex-1 space-y-2">
                              <div className="space-y-1">
                                <Label htmlFor={lotSelectId} className="text-xs">Lot Number</Label>
                                <Select
                                  value={lot.lotNumber}
                                  onValueChange={(value: string) => updateLotSelection(index, 'lotNumber', value)}
                                >
                                  <SelectTrigger id={lotSelectId} className="h-9">
                                    <SelectValue placeholder="Select lot" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableLots.map(availLot => (
                                      <SelectItem key={availLot.lotNumber} value={availLot.lotNumber}>
                                        {availLot.lotNumber} - Exp: {availLot.expirationDate.toLocaleDateString()} - Qty: {availLot.quantity}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <Label htmlFor={lotQuantityId} className="text-xs">Quantity</Label>
                                  <Input
                                    id={lotQuantityId}
                                    type="number"
                                    min="0"
                                    max={inventoryLot?.quantity || 9999}
                                    value={lot.quantity || ''}
                                    onChange={(e) => updateLotSelection(index, 'quantity', e.target.value)}
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
                        <Input
                          id="physician"
                          placeholder="e.g., Dr. Smith"
                          value={physicianName}
                          onChange={(e) => setPhysicianName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="student">Student Name</Label>
                        <Input
                          id="student"
                          placeholder="e.g., Jane Doe (optional)"
                          value={studentName}
                          onChange={(e) => setStudentName(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Clinic Site */}
                    <div className="space-y-2">
                      <Label htmlFor="clinic-site">Clinic Site</Label>
                      <Input
                        id="clinic-site"
                        placeholder="e.g., Bainbridge, Moultrie, etc."
                        value={clinicSite}
                        onChange={(e) => setClinicSite(e.target.value)}
                      />
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

                    <Button onClick={handleDispense} className="w-full">
                      Confirm Dispensing
                    </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
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
                {medication.commonUses.map(use => (
                  <Badge key={use} variant="secondary" className="text-xs">
                    {use}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Contraindications</Label>
              <div className="space-y-1 mt-1">
                {medication.contraindications.map(contra => (
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
              {medicationInventory.map(inv => (
                <div key={inv.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex-1">
                    <p className="font-medium">Lot: {inv.lotNumber}</p>
                    <p className="text-sm text-muted-foreground">
                      Quantity: {inv.quantity} units
                    </p>
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
      {(!medication.isAvailable || medication.currentStock <= medication.minStock) && alternatives.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alternative Medications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alternatives.map(alt => (
                <div 
                  key={alt.id}
                  className="flex items-center justify-between p-3 border rounded cursor-pointer hover:bg-muted/50"
                  onClick={() => onSelectAlternative(alt)}
                >
                  <div>
                    <p className="font-medium">{alt.name} {alt.strength}</p>
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
              <Button onClick={handleSaveLot}>
                {editingLot ? 'Update' : 'Add'} Lot
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}