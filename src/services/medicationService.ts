import { supabase } from '../lib/supabase'
import { Medication, InventoryItem, DispensingRecord, User } from '../types/medication'
import { toESTDateString, logDateToUTCNoon } from '../utils/timezone'

export class MedicationService {

  // Medications
  static async getAllMedications(): Promise<Medication[]> {
    // First get all medications
    const { data: medications, error: medError } = await supabase
      .from('medications')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (medError) {
      console.error('Error fetching medications:', medError)
      throw new Error('Failed to fetch medications')
    }

    // Then get all inventory
    const { data: inventory, error: invError } = await supabase
      .from('inventory')
      .select('medication_id, qty_units, updated_at, created_at')
    
      //console.log('Inventory data:', inventory)

    if (invError) {
      console.error('Error fetching inventory:', invError)
    }

    // Group inventory by medication_id
    type InventoryAggregate = {
      total: number
      latestUpdated: Date | null
    }
    const inventoryMap = new Map<string, InventoryAggregate>()
    console.log('Total inventory items fetched:', inventory?.length)
    inventory?.forEach(inv => {
      const current = inventoryMap.get(inv.medication_id) || { total: 0, latestUpdated: null }
      const nextTotal = current.total + (inv.qty_units || 0)
      const candidateDates = [inv.updated_at, inv.created_at]
        .filter(Boolean)
        .map(dateString => new Date(dateString as string))
        .filter(date => !Number.isNaN(date.getTime()))

      let latestUpdated = current.latestUpdated
      candidateDates.forEach(dateValue => {
        if (!latestUpdated || dateValue > latestUpdated) {
          latestUpdated = dateValue
        }
      })

      inventoryMap.set(inv.medication_id, {
        total: nextTotal,
        latestUpdated
      })
      // console.log(`Inventory: med_id=${inv.medication_id}, qty=${inv.qty_units}, running_total=${current + inv.qty_units}`)
    })

    // console.log('Inventory map:', Array.from(inventoryMap.entries()))

    return medications?.map(med => {
      const aggregate = inventoryMap.get(med.id)
      const totalStock = aggregate?.total || 0
      const latestInventoryUpdate = aggregate?.latestUpdated
      const medicationUpdatedAt = [med.updated_at, med.created_at]
        .filter(Boolean)
        .map((dateString: string) => new Date(dateString))
        .find(date => !Number.isNaN(date.getTime()))
      const lastUpdated =
        latestInventoryUpdate && medicationUpdatedAt
          ? (latestInventoryUpdate > medicationUpdatedAt ? latestInventoryUpdate : medicationUpdatedAt)
          : latestInventoryUpdate || medicationUpdatedAt || new Date()

      // Debug logging
      // if (med.name === 'Acetaminophen') {
      //   console.log('=== ACETAMINOPHEN DEBUG ===')
      //   console.log('Acetaminophen ID:', med.id)
      //   console.log('Acetaminophen inventory items:', inventory?.filter(i => i.medication_id === med.id))
      //   console.log('Acetaminophen total stock from map:', totalStock)
      //   console.log('Map has this key?', inventoryMap.has(med.id))
      // }

      return {
        id: med.id,
        name: med.name,
        genericName: med.name,
        strength: med.strength || '',
        dosageForm: med.dosage_form || 'tablet',
        category: med.category || 'General',
        currentStock: totalStock,
        minStock: typeof med.min_stock === 'number' ? med.min_stock : 20,
        maxStock: typeof med.max_stock === 'number' ? med.max_stock : 100,
        isAvailable: med.is_active && totalStock > 0,
        lastUpdated,
        alternatives: [],
        commonUses: [],
        contraindications: []
      }
    }) || []
  }

  static async getMedicationById(id: string): Promise<Medication | null> {
    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching medication:', error)
      return null
    }

    if (!data) return null

    return {
      id: data.id,
      name: data.name,
      genericName: data.generic_name,
      strength: data.strength,
      dosageForm: data.dosage_form,
      category: data.category,
      currentStock: data.current_stock,
      minStock: data.min_stock,
      maxStock: data.max_stock,
      isAvailable: data.is_available,
      lastUpdated: new Date(data.last_updated),
      alternatives: data.alternatives || [],
      commonUses: data.common_uses || [],
      contraindications: data.contraindications || []
    }
  }

  static async updateMedicationStock(medicationId: string, newStock: number): Promise<void> {
    const { error } = await supabase
      .from('medications')
      .update({
        current_stock: newStock,
        is_available: newStock > 0,
        last_updated: new Date().toISOString()
      })
      .eq('id', medicationId)

    if (error) {
      console.error('Error updating medication stock:', error)
      throw new Error('Failed to update medication stock')
    }
  }

  // Inventory
  static async getInventoryByMedicationId(medicationId: string): Promise<InventoryItem[]> {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('medication_id', medicationId)
      .order('expiration_date')

    if (error) {
      console.error('Error fetching inventory:', error)
      throw new Error('Failed to fetch inventory')
    }

    return data?.map(item => {
      const expirationDate = item.expiration_date
        ? logDateToUTCNoon(item.expiration_date)
        : new Date()
      return {
        id: item.id,
        medicationId: item.medication_id,
        lotNumber: item.lot_number,
        expirationDate,
        quantity: item.qty_units,
        isExpired: expirationDate < new Date()
      }
    }) || []
  }

  static async getAllInventory(): Promise<InventoryItem[]> {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('expiration_date')

    if (error) {
      console.error('Error fetching all inventory:', error)
      throw new Error('Failed to fetch inventory')
    }

    return data?.map(item => {
      const expirationDate = item.expiration_date
        ? logDateToUTCNoon(item.expiration_date)
        : new Date()
      return {
        id: item.id,
        medicationId: item.medication_id,
        lotNumber: item.lot_number,
        expirationDate,
        quantity: item.qty_units,
        isExpired: expirationDate < new Date()
      }
    }) || []
  }

  static async createInventoryItem(item: Omit<InventoryItem, 'id' | 'isExpired'>): Promise<InventoryItem> {
    const { data, error } = await supabase
      .from('inventory')
      .insert({
        medication_id: item.medicationId,
        lot_number: item.lotNumber,
        expiration_date: item.expirationDate.toISOString().split('T')[0],
        qty_units: item.quantity,
        low_stock_threshold: 10
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating inventory item:', error)
      throw new Error('Failed to create inventory item')
    }

    const expirationDate = data.expiration_date
      ? logDateToUTCNoon(data.expiration_date)
      : new Date()

    return {
      id: data.id,
      medicationId: data.medication_id,
      lotNumber: data.lot_number,
      expirationDate,
      quantity: data.qty_units,
      isExpired: expirationDate < new Date()
    }
  }



    // Create a new medication (online only)
    static async createMedication(input: {
      name: string
      strength: string
      dosageForm?: string
      isActive?: boolean
    }): Promise<{ id: string }> {
      const { data, error } = await supabase
        .from('medications')
        .insert({
          name: input.name,
          strength: input.strength,
          dosage_form: input.dosageForm || 'tablet',
          is_active: input.isActive ?? true,
        })
        .select('id')
        .single()
  
      if (error || !data) {
        console.error('Error creating medication:', error)
        throw new Error(error?.message || 'Failed to create medication')
      }
  
      return { id: data.id }
    }
    
  static async updateInventoryItem(id: string, updates: Partial<Pick<InventoryItem, 'quantity' | 'lotNumber' | 'expirationDate'>>): Promise<InventoryItem> {
    const updateData: any = {}

    if (updates.quantity !== undefined) updateData.qty_units = updates.quantity
    if (updates.lotNumber !== undefined) updateData.lot_number = updates.lotNumber
    if (updates.expirationDate !== undefined) updateData.expiration_date = updates.expirationDate.toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('inventory')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating inventory item:', error)
      throw new Error('Failed to update inventory item')
    }

    const expirationDate = data.expiration_date
      ? logDateToUTCNoon(data.expiration_date)
      : new Date()

    return {
      id: data.id,
      medicationId: data.medication_id,
      lotNumber: data.lot_number,
      expirationDate,
      quantity: data.qty_units,
      isExpired: expirationDate < new Date()
    }
  }

  static async deleteInventoryItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('inventory')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting inventory item:', error)
      throw new Error('Failed to delete inventory item')
    }
  }

  // Dispensing Records
  static async getAllDispensingRecords(): Promise<DispensingRecord[]> {
    const { data, error } = await supabase
      .from('dispensing_logs')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching dispensing records:', error)
      throw new Error('Failed to fetch dispensing records')
    }

    return data?.map(record => {
      const dispensedAt = record.log_date
        ? logDateToUTCNoon(record.log_date)
        : (record.created_at ? new Date(record.created_at) : new Date())
      return ({
      id: record.id,
      medicationId: record.medication_id || record.medication_name || '',
      medicationName: record.medication_name,
      patientId: record.patient_id || '',
      patientInitials: record.patient_id?.split('-')[0] + '.' + (record.patient_id?.split('-')[1]?.slice(0,1) || '') + '.',
      quantity: (() => {
        const raw = record.amount_dispensed
        const s = raw === null || raw === undefined ? '' : String(raw)
        const digits = s.replace(/\D/g, '')
        const n = parseInt(digits, 10)
        return Number.isFinite(n) && n > 0 ? n : 1
      })(),
      dose: record.dose_instructions || '',
      lotNumber: record.lot_number || '',
  expirationDate: record.expiration_date ? new Date(record.expiration_date + 'T00:00:00') : undefined,
      dispensedBy: record.entered_by || 'System',
      physicianName: record.physician_name || '',
      studentName: record.student_name || undefined,
      // Anchor at UTC noon to ensure EST display matches calendar date; fallback to created_at if needed
      dispensedAt,
      indication: record.dose_instructions || '',
      notes: record.notes || undefined,
      clinicSite: record.clinic_site || undefined
    })}) || []
  }

  static async updateDispensingRecord(id: string, updates: Partial<Omit<DispensingRecord, 'id'>>): Promise<DispensingRecord> {
    const updateData: any = {}

    if (updates.patientId !== undefined) updateData.patient_id = updates.patientId
    if (updates.dose !== undefined) updateData.dose_instructions = updates.dose
    if (updates.quantity !== undefined) updateData.amount_dispensed = `${updates.quantity} tabs`
    if (updates.lotNumber !== undefined) updateData.lot_number = updates.lotNumber
  if (updates.expirationDate !== undefined) updateData.expiration_date = updates.expirationDate.toISOString().split('T')[0]
    if (updates.physicianName !== undefined) updateData.physician_name = updates.physicianName
    if (updates.studentName !== undefined) updateData.student_name = updates.studentName
    if (updates.indication !== undefined) updateData.dose_instructions = updates.indication
    if (updates.notes !== undefined) updateData.notes = updates.notes
  if (updates.clinicSite !== undefined) updateData.clinic_site = updates.clinicSite

  // Supabase stores UTC; keep updated_at in UTC
  updateData.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('dispensing_logs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating dispensing record:', error)
      throw new Error('Failed to update dispensing record')
    }

    return {
      id: data.id,
      medicationId: data.medication_id || data.medication_name,
      medicationName: data.medication_name,
      patientId: data.patient_id,
      patientInitials: data.patient_id?.split('-')[0] + '.' + (data.patient_id?.split('-')[1]?.slice(0,1) || '') + '.',
      quantity: (() => {
        const raw = data.amount_dispensed
        const s = raw === null || raw === undefined ? '' : String(raw)
        const digits = s.replace(/\D/g, '')
        const n = parseInt(digits, 10)
        return Number.isFinite(n) && n > 0 ? n : 1
      })(),
      dose: data.dose_instructions,
      lotNumber: data.lot_number || '',
  expirationDate: data.expiration_date ? new Date(data.expiration_date + 'T00:00:00') : undefined,
      dispensedBy: data.entered_by || 'System',
      physicianName: data.physician_name,
      studentName: data.student_name || undefined,
      // Anchor at UTC noon; fallback if log_date missing
      dispensedAt: data.log_date ? logDateToUTCNoon(data.log_date) : (data.created_at ? new Date(data.created_at) : new Date()),
      indication: data.dose_instructions,
      notes: data.notes || undefined,
      clinicSite: data.clinic_site || undefined
    }
  }

  static async createDispensingRecord(record: Omit<DispensingRecord, 'id'>): Promise<DispensingRecord> {
    // Get the current user ID from the dispensedBy name (pharmacy staff)
    // This is a temporary solution until we implement proper user session management
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .ilike('first_name', `%${record.dispensedBy.split(' ')[0]}%`)
      .limit(1)
      .single()

    const enteredBy = userData?.id || null

    const { data, error } = await supabase
      .from('dispensing_logs')
      .insert({
        // Store the EST calendar date for log_date
        log_date: toESTDateString(record.dispensedAt),
        patient_id: record.patientId,
        medication_id: record.medicationId,
        medication_name: record.medicationName,
        dose_instructions: record.dose,
        lot_number: record.lotNumber,
        expiration_date: record.expirationDate ? record.expirationDate.toISOString().split('T')[0] : null,
        amount_dispensed: `${record.quantity} tabs`,
        physician_name: record.physicianName,
        student_name: record.studentName || null,
        entered_by: enteredBy,
        notes: record.notes || null,
        clinic_site: record.clinicSite || null
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating dispensing record:', error)
      throw new Error('Failed to create dispensing record')
    }

    return {
      id: data.id,
      medicationId: record.medicationId,
      medicationName: data.medication_name,
      patientId: data.patient_id,
      patientInitials: data.patient_id?.split('-')[0] + '.' + (data.patient_id?.split('-')[1]?.slice(0,1) || '') + '.',
      quantity: record.quantity,
      dose: data.dose_instructions,
      lotNumber: record.lotNumber || '',
      expirationDate: record.expirationDate,
      dispensedBy: record.dispensedBy,
      physicianName: data.physician_name,
      studentName: data.student_name || undefined,
      // Anchor at UTC noon; fallback if log_date missing
      dispensedAt: data.log_date ? logDateToUTCNoon(data.log_date) : (data.created_at ? new Date(data.created_at) : record.dispensedAt),
      indication: record.indication,
      notes: data.notes || undefined,
      clinicSite: data.clinic_site || record.clinicSite
    }
  }

  static async deleteDispensingRecord(id: string): Promise<void> {
    const { error } = await supabase
      .from('dispensing_logs')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting dispensing record:', error)
      throw new Error('Failed to delete dispensing record')
    }
  }

  // Users
  static async getAllUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('first_name')

    if (error) {
      console.error('Error fetching users:', error)
      throw new Error('Failed to fetch users')
    }

    return data?.map(user => ({
      id: user.id,
      name: `${user.first_name} ${user.last_name}`.trim(),
      role: user.role === 'pharmacy_staff' ? 'pharmacy_staff' : 'provider',
      initials: user.first_name?.charAt(0) + user.last_name?.charAt(0) || user.first_name?.substring(0, 2) || 'XX'
    })) || []
  }

  // Bulk Import for Inventory
  static async bulkImportInventory(items: Array<{
    name: string
    strength: string
    quantity: number
    lotNumber?: string
    expirationDate?: string
    dosageForm?: string
  }>, p0: string, id: string): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    }

    // Process each item
    for (const item of items) {
      try {
        // 1. Check if medication exists in medications table
        const { data: existingMed, error: searchError } = await supabase
          .from('medications')
          .select('id')
          .eq('name', item.name)
          .eq('strength', item.strength)
          .eq('dosage_form', item.dosageForm || 'tablet')
          .single()

        let medicationId: string

        if (existingMed) {
          // Medication exists, use existing ID
          medicationId = existingMed.id
        } else {
          // Medication doesn't exist, create new one
          const { data: newMed, error: createError } = await supabase
            .from('medications')
            .insert({
              name: item.name,
              strength: item.strength,
              dosage_form: item.dosageForm || 'tablet',
              is_active: true
            })
            .select('id')
            .single()

          if (createError || !newMed) {
            results.failed++
            results.errors.push(`Failed to create medication ${item.name}: ${createError?.message}`)
            continue
          }

          medicationId = newMed.id
        }

        // 2. Generate lot number and expiration date if not provided
        const lotNumber = item.lotNumber || `BULK-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
        const expirationDate = item.expirationDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // +1 year

        // 3. Create inventory record in inventory
        const { error: inventoryError } = await supabase
          .from('inventory')
          .insert({
            medication_id: medicationId,
            lot_number: lotNumber,
            expiration_date: expirationDate,
            qty_units: item.quantity,
            low_stock_threshold: 10,
            notes: item.lotNumber ? 'Imported from formulary' : 'Bulk import - placeholder lot number, please update'
          })

        if (inventoryError) {
          results.failed++
          results.errors.push(`Failed to create inventory for ${item.name}: ${inventoryError.message}`)
        } else {
          results.success++
        }

      } catch (error) {
        results.failed++
        results.errors.push(`Error processing ${item.name}: ${error}`)
      }
    }

    return results
  }
}
