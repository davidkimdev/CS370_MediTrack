export interface Medication {
  id: string;
  name: string;
  genericName: string;
  strength: string;
  dosageForm: string;
  category: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  isAvailable: boolean;
  lastUpdated: Date;
  alternatives: string[];
  commonUses: string[];
  contraindications: string[];
}

export interface InventoryItem {
  id: string;
  medicationId: string;
  lotNumber: string;
  expirationDate: Date;
  quantity: number;
  isExpired: boolean;
}

export interface DispensingRecord {
  id: string;
  medicationId: string;
  medicationName: string;
  patientId: string;              // e.g., "2025-196", "2635-140"
  patientInitials: string;        // Still keep for quick reference
  quantity: number;
  dose: string;                   // e.g., "1 tab", "PRN", "1 gtt"
  lotNumber: string;
  expirationDate?: Date;
  dispensedBy: string;            // Pharmacy staff who dispensed
  physicianName: string;          // Physician who prescribed
  studentName?: string;           // Student observer/trainee
  dispensedAt: Date;
  indication: string;
  notes?: string;
  clinicSite?: string;            // Free-text clinic site where dispensed
}

export interface StockUpdate {
  medicationId: string;
  newQuantity: number;
  reason: string;
  updatedBy: string;
  updatedAt: Date;
}

export type UserRole = 'provider' | 'pharmacy_staff';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  initials: string;
}