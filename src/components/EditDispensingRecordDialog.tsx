import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { DispensingRecord, InventoryItem } from '../types/medication';
import { formatDateEST } from '../utils/timezone';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { MedicationService } from '../services/medicationService';

interface EditDispensingRecordDialogProps {
  record: DispensingRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: Partial<Omit<DispensingRecord, 'id'>>) => Promise<void>;
}

export function EditDispensingRecordDialog({
  record,
  open,
  onOpenChange,
  onSave,
}: EditDispensingRecordDialogProps) {
  const [patientId, setPatientId] = useState('');
  const [dose, setDose] = useState('');
  const [quantity, setQuantity] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [physicianName, setPhysicianName] = useState('');
  const [studentName, setStudentName] = useState('');
  const [clinicSite, setClinicSite] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [availableLots, setAvailableLots] = useState<InventoryItem[]>([]);
  const [isLoadingLots, setIsLoadingLots] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  // Populate form when record changes
  useEffect(() => {
    if (!record) return;

    setPatientId(record.patientId || '');
    setDose(record.dose || '');
    setQuantity(record.quantity?.toString() || '');
    setLotNumber(record.lotNumber || '');
    setPhysicianName(record.physicianName || '');
    setStudentName(record.studentName || '');
    setClinicSite(record.clinicSite || '');
    setNotes(record.notes || '');

    // Load lots for this medication (copying the idea from MedicationDetail)
    const loadLots = async () => {
      if (!record.medicationId) return;
      try {
        setIsLoadingLots(true);
        const lots = await MedicationService.getInventoryByMedicationId(record.medicationId);
        const usable = lots.filter((lot) => !lot.isExpired && lot.quantity > 0);
        setAvailableLots(usable);

        // If record had no lotNumber but we have valid lots, default to first
        if (!record.lotNumber && usable.length > 0) {
          setLotNumber(usable[0].lotNumber);
        }
      } finally {
        setIsLoadingLots(false);
      }
    };

    loadLots();
  }, [record]);

  // Detect mobile screen size
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSave = async () => {
    // FIX: Block the function if it's already running
    if (isSaving) return;
    if (!record) return;

    const updates: Partial<Omit<DispensingRecord, 'id'>> = {};

    if (patientId !== record.patientId) updates.patientId = patientId;
    if (dose !== record.dose) updates.dose = dose;

    // Ensure we parse the integer correctly, allowing 0
    const parsedQty = parseInt(quantity);
    if (!isNaN(parsedQty) && parsedQty !== record.quantity) {
      updates.quantity = parsedQty;
    }
    if (lotNumber !== record.lotNumber) updates.lotNumber = lotNumber;
    if (physicianName !== record.physicianName) updates.physicianName = physicianName;
    if (studentName !== record.studentName) updates.studentName = studentName || undefined;
    if (clinicSite !== record.clinicSite) updates.clinicSite = clinicSite || undefined;
    if (notes !== record.notes) updates.notes = notes || undefined;

    if (Object.keys(updates).length === 0) {
      onOpenChange(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(record.id, updates);
      window.location.reload();
    } catch (error) {
      console.error('Failed to save changes:', error);
      alert('Failed to save changes. Please try again.');
      setIsSaving(false);
    }
  };

  if (!record) return null;

  const selectedLot = availableLots.find((lot) => lot.lotNumber === lotNumber);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[90vw] max-w-[700px] p-0 flex flex-col gap-0 overflow-hidden"
        style={
          isMobile
            ? {
                top: '5rem',
                height: 'calc(100vh - 10rem)',
                transform: 'none',
              }
            : {
                maxHeight: 'calc(100vh - 8rem)',
              }
        }
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="flex-shrink-0 px-4 sm:px-6 pt-3 pb-2 border-b">
          <DialogTitle className="text-base sm:text-lg">Edit Dispensing Record</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6">
          <div className="space-y-4 py-4">
            {/* Read-only fields */}
            <div className="p-3 bg-muted rounded-md space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">
                  Medication (cannot be changed)
                </Label>
                <p className="text-sm font-medium">{record.medicationName}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Date (cannot be changed)</Label>
                <p className="text-sm">{formatDateEST(record.dispensedAt)}</p>
              </div>
            </div>

            {/* Editable fields */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-patientId">Patient ID *</Label>
                  <Input
                    id="edit-patientId"
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    placeholder="e.g., 2025-196"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-dose">Dose Instructions *</Label>
                <Input
                  id="edit-dose"
                  value={dose}
                  onChange={(e) => setDose(e.target.value)}
                  placeholder="e.g., 1 tab, PRN, 1 gtt"
                />
              </div>

              <div className="space-y-2">
                <Label>Lot & Quantity</Label>

                {availableLots.length > 0 ? (
                  <div className="p-3 border rounded-md bg-muted/30 space-y-3">
                    {/* Lot select */}
                    <div className="space-y-1">
                      <Label htmlFor="edit-lotNumber" className="text-xs sm:text-sm">
                        Lot Number
                      </Label>
                      <Select
                        value={lotNumber}
                        onValueChange={(value) => setLotNumber(value)}
                      >
                        <SelectTrigger id="edit-lotNumber" className="h-8 sm:h-9 w-full">
                          <SelectValue
                            placeholder={isLoadingLots ? 'Loading lots...' : 'Select lot'}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {/* --- FIX START: Always show the current record's lot --- */}
                          {record?.lotNumber && (
                            <SelectItem value={record.lotNumber}>
                              <span className="text-xs sm:text-sm font-semibold">
                                {record.lotNumber} (Current)
                                {record.expirationDate &&
                                  ` - Exp: ${new Date(record.expirationDate).toLocaleDateString()}`
                                }
                                {/* We use the original quantity here so they see what it WAS before editing */}
                                {record.quantity !== undefined && ` - Qty: ${record.quantity}`}
                              </span>
                            </SelectItem>
                          )}
                          {/* --- FIX END --- */}

                          {/* Filter out the current lot to avoid showing it twice, then map the rest */}
                          {availableLots
                            .filter((lot) => lot.lotNumber !== record?.lotNumber)
                            .map((availLot) => (
                              <SelectItem
                                key={availLot.lotNumber}
                                value={availLot.lotNumber}
                              >
                                <span className="text-xs sm:text-sm">
                                  {availLot.lotNumber} - Exp:{' '}
                                  {availLot.expirationDate.toLocaleDateString()} - Qty:{' '}
                                  {availLot.quantity}
                                </span>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Quantity + Available side by side */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="edit-quantity" className="text-xs sm:text-sm">
                          Quantity *
                        </Label>
                        <Input
                          id="edit-quantity"
                          type="number"
                          value={quantity}
                          onChange={(e) => {
                            // natural numbers only
                            const v = e.target.value.replace(/\D/g, '');
                            setQuantity(v === '' ? '' : String(Math.max(0, Number(v))));
                          }}
                          min="0"
                          inputMode="numeric"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs sm:text-sm">Available</Label>
                        <p className="text-sm font-medium py-2">
                          {selectedLot
                            ? `${selectedLot.quantity} units`
                            : (record?.lotNumber === lotNumber ? '0 units (Empty)' : '-')}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Fallback when there are no lots in inventory
                  <div className="space-y-2">
                    <Input
                      id="edit-lotNumber"
                      value={lotNumber}
                      onChange={(e) => setLotNumber(e.target.value)}
                      placeholder={
                        isLoadingLots
                          ? 'Loading lots...'
                          : 'No lots available – enter manually'
                      }
                    />
                    <div className="space-y-1">
                      <Label htmlFor="edit-quantity" className="text-xs sm:text-sm">
                        Quantity *
                      </Label>
                      <Input
                        id="edit-quantity"
                        type="number"
                        value={quantity}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, '');
                          setQuantity(v === '' ? '' : String(Math.max(0, Number(v))));
                        }}
                        min="0"
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-physician">Physician Name *</Label>
                  <Input
                    id="edit-physician"
                    value={physicianName}
                    onChange={(e) => setPhysicianName(e.target.value)}
                    placeholder="e.g., Dr. Smith"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-student">Student Name</Label>
                  <Input
                    id="edit-student"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="e.g., Jane Doe"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-clinic-site">Clinic Site</Label>
                <Input
                  id="edit-clinic-site"
                  value={clinicSite}
                  onChange={(e) => setClinicSite(e.target.value)}
                  placeholder="e.g., Bainbridge, Moultrie, etc."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes..."
                  rows={3}
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-3 mt-6 pb-4">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || !patientId || !dose || !quantity || !physicianName}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
