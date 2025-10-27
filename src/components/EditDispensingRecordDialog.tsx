import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { DispensingRecord } from '../types/medication';
import { formatDateEST } from '../utils/timezone';

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
  onSave
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

  // Populate form when record changes
  useEffect(() => {
    if (record) {
      setPatientId(record.patientId || '');
      setDose(record.dose || '');
      setQuantity(record.quantity?.toString() || '');
      setLotNumber(record.lotNumber || '');
      setPhysicianName(record.physicianName || '');
      setStudentName(record.studentName || '');
      setClinicSite(record.clinicSite || '');
      setNotes(record.notes || '');
    }
  }, [record]);

  const handleSave = async () => {
    if (!record) return;

    const updates: Partial<Omit<DispensingRecord, 'id'>> = {};

    if (patientId !== record.patientId) updates.patientId = patientId;
    if (dose !== record.dose) updates.dose = dose;
    if (parseInt(quantity) !== record.quantity) updates.quantity = parseInt(quantity);
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
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save changes:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Dispensing Record</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Read-only fields */}
          <div className="p-3 bg-muted rounded-md space-y-2">
            <div>
              <Label className="text-xs text-muted-foreground">Medication (cannot be changed)</Label>
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
              <div className="space-y-2">
                <Label htmlFor="edit-quantity">Quantity *</Label>
                <Input
                  id="edit-quantity"
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="1"
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
              <Label htmlFor="edit-lotNumber">Lot Number</Label>
              <Input
                id="edit-lotNumber"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                placeholder="e.g., EW0646"
              />
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
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
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
      </DialogContent>
    </Dialog>
  );
}