import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { CalendarIcon, Package, AlertCircle } from 'lucide-react';
import { cn } from './ui/utils';
import { Medication, InventoryItem } from '../types/medication';

interface AddLotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medication: Medication | null;
  medications: Medication[];
  onAddLot: (lot: Omit<InventoryItem, 'id' | 'isExpired'>) => Promise<void>;
}

export function AddLotDialog({ open, onOpenChange, medication, medications, onAddLot }: AddLotDialogProps) {
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(medication);
  const [createNew, setCreateNew] = useState(false);
  const [newMedName, setNewMedName] = useState('');
  const [newMedStrength, setNewMedStrength] = useState('');
  const [newMedDosageForm, setNewMedDosageForm] = useState('tablet');
  const [lotNumber, setLotNumber] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expirationDate, setExpirationDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when dialog opens/closes or medication changes
  useEffect(() => {
    if (open) {
      setSelectedMedication(medication);
      setCreateNew(false);
      setNewMedName('');
      setNewMedStrength('');
      setNewMedDosageForm('tablet');
      setLotNumber('');
      setQuantity('');
      setExpirationDate(undefined);
      setNotes('');
      setErrors({});
    }
  }, [open, medication]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!createNew) {
      if (!selectedMedication) newErrors.medication = 'Please select a medication';
    } else {
      if (!newMedName.trim()) newErrors.newMedName = 'Medication name is required';
      if (!newMedStrength.trim()) newErrors.newMedStrength = 'Strength is required';
    }

    if (!lotNumber.trim()) {
      newErrors.lotNumber = 'Lot number is required';
    }

    if (!quantity.trim()) {
      newErrors.quantity = 'Quantity is required';
    } else {
      const qty = parseInt(quantity);
      if (isNaN(qty) || qty <= 0) {
        newErrors.quantity = 'Please enter a valid quantity';
      }
    }

    if (!expirationDate) {
      newErrors.expirationDate = 'Expiration date is required';
    } else if (expirationDate <= new Date()) {
      newErrors.expirationDate = 'Expiration date must be in the future';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      // Determine medication id: create or use existing
      let medicationId: string | null = selectedMedication?.id || null;
      if (createNew) {
        if (!navigator.onLine) {
          setErrors({ submit: 'Creating a new medication requires internet connection.' });
          setIsSubmitting(false);
          return;
        }
        const { MedicationService } = await import('../services/medicationService');
        const created = await MedicationService.createMedication({
          name: newMedName.trim(),
          strength: newMedStrength.trim(),
          dosageForm: newMedDosageForm,
          isActive: true,
        });
        medicationId = created.id;
      }
      if (!medicationId) throw new Error('Medication not resolved');

      const lotData: Omit<InventoryItem, 'id' | 'isExpired'> = {
        medicationId,
        lotNumber: lotNumber.trim(),
        quantity: parseInt(quantity),
        expirationDate: expirationDate!,
      };

      await onAddLot(lotData);
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding lot:', error);
      setErrors({ submit: 'Failed to add lot. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateLotNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substr(2, 3).toUpperCase();
    setLotNumber(`LOT-${timestamp}-${random}`);
  };

  if (!medications || medications.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="size-5" />
            Add New Lot
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Medication Selection or Creation */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="medication-select">Medication *</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setCreateNew(!createNew)}>
                {createNew ? 'Select Existing' : 'Create New'}
              </Button>
            </div>

            {!createNew ? (
              <div className="space-y-2">
                <Select 
                  value={selectedMedication?.id || ''} 
                  onValueChange={(value: string) => {
                    const med = medications.find(m => m.id === value);
                    setSelectedMedication(med || null);
                  }}
                >
                  <SelectTrigger className={cn(errors.medication && "border-red-500")}>
                    <SelectValue placeholder="Choose a medication" />
                  </SelectTrigger>
                  <SelectContent>
                    {medications.map((med) => (
                      <SelectItem key={med.id} value={med.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{med.name}</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            {med.strength} • {med.dosageForm}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.medication && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="size-4" />
                    {errors.medication}
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-2 sm:col-span-1">
                  <Label htmlFor="new-med-name">Name *</Label>
                  <Input id="new-med-name" value={newMedName} onChange={(e) => setNewMedName(e.target.value)} className={cn(errors.newMedName && 'border-red-500')} />
                  {errors.newMedName && (
                    <p className="text-sm text-red-500 flex items-center gap-1"><AlertCircle className="size-4" />{errors.newMedName}</p>
                  )}
                </div>
                <div className="space-y-2 sm:col-span-1">
                  <Label htmlFor="new-med-strength">Strength *</Label>
                  <Input id="new-med-strength" value={newMedStrength} onChange={(e) => setNewMedStrength(e.target.value)} className={cn(errors.newMedStrength && 'border-red-500')} />
                  {errors.newMedStrength && (
                    <p className="text-sm text-red-500 flex items-center gap-1"><AlertCircle className="size-4" />{errors.newMedStrength}</p>
                  )}
                </div>
                <div className="space-y-2 sm:col-span-1">
                  <Label htmlFor="new-med-form">Dosage Form</Label>
                  <Select value={newMedDosageForm} onValueChange={(v: string) => setNewMedDosageForm(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tablet">tablet</SelectItem>
                      <SelectItem value="capsule">capsule</SelectItem>
                      <SelectItem value="syrup">syrup</SelectItem>
                      <SelectItem value="drops">drops</SelectItem>
                      <SelectItem value="ointment">ointment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* Medication Info */}
          {!createNew && selectedMedication && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm font-medium">Medication Details</p>
              <p className="text-sm text-muted-foreground">
                {selectedMedication.name} • {selectedMedication.strength} • {selectedMedication.dosageForm}
              </p>
              <p className="text-sm text-muted-foreground">
                Current Total Stock: {selectedMedication.currentStock} units
              </p>
            </div>
          )}

          {/* Lot Number */}
          <div className="space-y-2">
            <Label htmlFor="lot-number">Lot Number *</Label>
            <div className="flex gap-2">
              <Input
                id="lot-number"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value.toUpperCase())}
                placeholder="e.g., LOT-123456-ABC"
                className={cn(errors.lotNumber && "border-red-500")}
              />
              <Button
                type="button"
                variant="outline"
                onClick={generateLotNumber}
                className="shrink-0"
              >
                Generate
              </Button>
            </div>
            {errors.lotNumber && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="size-4" />
                {errors.lotNumber}
              </p>
            )}
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity *</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity"
              className={cn(errors.quantity && "border-red-500")}
            />
            {errors.quantity && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="size-4" />
                {errors.quantity}
              </p>
            )}
          </div>

          {/* Expiration Date */}
          <div className="space-y-2">
            <Label>Expiration Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !expirationDate && "text-muted-foreground",
                    errors.expirationDate && "border-red-500"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expirationDate ? expirationDate.toLocaleDateString() : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={expirationDate}
                  onSelect={setExpirationDate}
                  disabled={(date) => date <= new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {errors.expirationDate && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="size-4" />
                {errors.expirationDate}
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about this lot..."
            />
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="size-4" />
                {errors.submit}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? 'Adding...' : 'Add Lot'}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}