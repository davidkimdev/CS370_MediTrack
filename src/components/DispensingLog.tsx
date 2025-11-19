import { useState, useMemo } from 'react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Search, Download, Calendar, Package, User, ChevronDown, Edit } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { DispensingRecord } from '../types/medication';
import { formatDateEST } from '../utils/timezone';
import { toESTDateString, logDateToUTCNoon } from '../utils/timezone';
import * as XLSX from 'xlsx';

interface DispensingLogProps {
  records: DispensingRecord[];
  onEditRecord?: (record: DispensingRecord) => void;
}

export function DispensingLog({ records, onEditRecord }: DispensingLogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [activeNoteRecord, setActiveNoteRecord] = useState<DispensingRecord | null>(null);

  const dateFilterOptions = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
  ];

  const filteredRecords = useMemo(() => {
    let filtered = records;

    // Filter by search term
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter((record) => {
        const med = (record.medicationName || '').toLowerCase();
       // const initials = (record.patientInitials || '').toLowerCase();
        const by = (record.dispensedBy || '').toLowerCase();
        const ind = (record.indication || '').toLowerCase();
        const site = (record.clinicSite || '').toLowerCase();
        return (
          med.includes(q) ||
          //initials.includes(q) ||
          by.includes(q) ||
          ind.includes(q) ||
          site.includes(q)
        );
      });
    }

    // Filter by date
    if (dateFilter !== 'all') {
      // Compute boundaries in EST
      const estTodayStr = toESTDateString(new Date());
      const estToday = logDateToUTCNoon(estTodayStr);

      filtered = filtered.filter((record) => {
        const recordDate = record.dispensedAt; // already anchored for EST display

        switch (dateFilter) {
          case 'today':
            return recordDate >= estToday;
          case 'week': {
            const weekAgo = new Date(estToday.getTime() - 7 * 24 * 60 * 60 * 1000);
            return recordDate >= weekAgo;
          }
          case 'month': {
            const monthAgo = new Date(estToday);
            monthAgo.setUTCDate(monthAgo.getUTCDate() - 30);
            return recordDate >= monthAgo;
          }
          default:
            return true;
        }
      });
    }

    return filtered.sort((a, b) => {
      const ta =
        a.dispensedAt instanceof Date
          ? a.dispensedAt.getTime()
          : new Date(a.dispensedAt as any).getTime();
      const tb =
        b.dispensedAt instanceof Date
          ? b.dispensedAt.getTime()
          : new Date(b.dispensedAt as any).getTime();
      return tb - ta;
    });
  }, [records, searchTerm, dateFilter]);

  const totalDispensed = filteredRecords.reduce((sum, record) => sum + record.quantity, 0);
  const uniquePatients = new Set(filteredRecords.map((record) => record.patientId)).size;
  const uniqueMedications = new Set(filteredRecords.map((record) => record.medicationId)).size;

  const exportToCSV = () => {
    const headers = [
      'Date',
      'Patient ID',
      'Medication',
      'Dose',
      'Lot Number',
      'Expiration',
      'Amount Dispensed',
      'Physician Name',
      'Student Name',
      'Dispensed By',
      'Clinic Site',
      'Indication',
      'Notes',
    ];

    const csvData = filteredRecords.map((record) => [
      formatDateEST(record.dispensedAt),
      record.patientId,
      record.medicationName,
      record.dose,
      record.lotNumber,
      record.expirationDate ? formatDateEST(record.expirationDate) : '',
      record.quantity.toString(),
      record.physicianName,
      record.studentName || '',
      record.dispensedBy,
      record.clinicSite || '',
      record.indication,
      record.notes || '',
    ]);

    const csvContent = [headers, ...csvData]
      .map((row) => row.map((field) => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dispensing-log-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToExcel = () => {
    const excelData = filteredRecords.map((record) => ({
      Date: formatDateEST(record.dispensedAt),
      'Patient ID': record.patientId,
      Medication: record.medicationName,
      Dose: record.dose,
      'Lot Number': record.lotNumber,
      Expiration: record.expirationDate ? formatDateEST(record.expirationDate) : '',
      'Amount Dispensed': record.quantity,
      'Physician Name': record.physicianName,
      'Student Name': record.studentName || '',
      'Dispensed By': record.dispensedBy,
      'Clinic Site': record.clinicSite || '',
      Indication: record.indication,
      Notes: record.notes || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dispensing Log');

    // Auto-size columns
    const maxWidth = excelData.reduce((w, r) => {
      return Math.max(w, r.Medication.length);
    }, 10);
    worksheet['!cols'] = [
      { wch: 20 }, // Date/Time
      { wch: maxWidth }, // Medication
      { wch: 15 }, // Patient Initials
      { wch: 10 }, // Quantity
      { wch: 15 }, // Lot Number
      { wch: 20 }, // Dispensed By
      { wch: 20 }, // Indication
      { wch: 30 }, // Notes
    ];

    XLSX.writeFile(workbook, `dispensing-log-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dispensing Log</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Download className="size-4 mr-2" />
              Export
              <ChevronDown className="size-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportToCSV}>
              <Download className="size-4 mr-2" />
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportToExcel}>
              <Download className="size-4 mr-2" />
              Export as Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Package className="size-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{totalDispensed}</p>
                <p className="text-sm text-muted-foreground">Units Dispensed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <User className="size-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{uniquePatients}</p>
                <p className="text-sm text-muted-foreground">Patients Served</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Calendar className="size-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">{uniqueMedications}</p>
                <p className="text-sm text-muted-foreground">Medications Used</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by medication, patient, provider, or indication..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              backgroundColor: '#86efac', // Tailwind's green-300 hex
              borderColor: '#22c55e',     // Tailwind's green-500
              color: '#064e3b',           // Tailwind's green-900 (text)
            }}
            className="pl-10 border-2 focus:ring-2 focus:ring-green-600 focus:border-green-600"
          />
        </div>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {dateFilterOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        Showing {filteredRecords.length} of {records.length} dispensing records
      </p>

      {/* Dispensing Records Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-hidden">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow>
                  {onEditRecord && <TableHead className="w-[80px]">Actions</TableHead>}
                  <TableHead>Date</TableHead>
                  <TableHead className="w-[100px]">Patient ID</TableHead>
                  <TableHead>Medication</TableHead>
                  <TableHead>Dose</TableHead>
                  <TableHead>Lot #</TableHead>
                  <TableHead>Exp</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Physician</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Clinic Site</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-[110px]">Date</TableHead>
                  <TableHead className="w-[140px]">Patient</TableHead>
                  <TableHead className="w-[220px]">Prescription</TableHead>
                  <TableHead className="w-[180px]">Provider</TableHead>
                  <TableHead className="w-[160px]">Inventory</TableHead>
                  <TableHead className="w-[160px]">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => {
                  const doseText = record.dose?.trim() || '';
                  const indicationText = record.indication?.trim() || '';
                  const showIndication =
                    Boolean(indicationText) &&
                    (!doseText || indicationText.toLowerCase() !== doseText.toLowerCase());

                  return (
                    <TableRow key={record.id}>
                    {onEditRecord && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditRecord(record)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="size-4" />
                        </Button>
                      </TableCell>
                    )}
                    <TableCell className="text-sm align-top break-words">
                      {formatDateEST(record.dispensedAt)}
                    </TableCell>
                    <TableCell className="align-top break-words">
                      <div className="flex flex-col gap-1 break-words">
                        <Badge variant="outline" className="text-xs font-mono w-fit">
                          {record.patientId}
                        </Badge>
                        {record.clinicSite && (
                          <p className="text-xs text-muted-foreground break-words">
                            {record.clinicSite}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="align-top break-words">
                      <div className="space-y-1 break-words">
                        <p className="text-sm font-semibold leading-tight">{record.medicationName}</p>
                        <p className="text-xs text-muted-foreground flex flex-wrap gap-2 break-words">
                          {doseText && (
                            <span>
                              <span className="text-foreground font-medium">Dose:</span> {doseText}
                            </span>
                          )}
                          <span className="font-medium text-foreground">• Qty {record.quantity}</span>
                        </p>
                        {showIndication && (
                          <p className="text-xs text-muted-foreground break-words">
                            <span className="text-foreground font-medium">Indication:</span>{' '}
                            {indicationText}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="align-top break-words">
                      <div className="text-xs text-muted-foreground space-y-1 break-words">
                        <p>
                          <span className="text-foreground font-medium">Physician:</span>{' '}
                          {record.physicianName}
                        </p>
                        <p>
                          <span className="text-foreground font-medium">Student:</span>{' '}
                          {record.studentName || '—'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="align-top break-words">
                      <div className="text-xs text-muted-foreground space-y-1 break-words">
                        <p>
                          <span className="text-foreground font-medium">Lot:</span> {record.lotNumber}
                        </p>
                        <p>
                          <span className="text-foreground font-medium">Exp:</span>{' '}
                          {record.expirationDate ? formatDateEST(record.expirationDate) : '—'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="align-top break-words">
                      {record.notes ? (
                        <div className="space-y-1">
                          <p
                            className="text-sm text-muted-foreground overflow-hidden text-ellipsis"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            {record.notes}
                          </p>
                          {record.notes.length > 60 && (
                            <Button
                              variant="link"
                              size="sm"
                              className="px-0 text-xs"
                              onClick={() => setActiveNoteRecord(record)}
                            >
                              View full note
                            </Button>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {filteredRecords.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="size-12 mx-auto mb-2 opacity-50" />
              <p>No dispensing records found</p>
            </div>
          )}
        </CardContent>
      </Card>
      {activeNoteRecord && (
        <Dialog open onOpenChange={(open) => !open && setActiveNoteRecord(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dispensing Note</DialogTitle>
              <DialogDescription>
                {formatDateEST(activeNoteRecord.dispensedAt)} • {activeNoteRecord.medicationName}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 text-sm text-foreground whitespace-pre-wrap">
              {activeNoteRecord.notes}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
