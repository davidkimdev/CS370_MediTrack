import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Search, Download, Calendar, Package, User, ChevronDown, Edit } from 'lucide-react';
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

  const dateFilterOptions = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' }
  ];

  const filteredRecords = useMemo(() => {
    let filtered = records;

    // Filter by search term
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      filtered = filtered.filter(record => {
        const med = (record.medicationName || '').toLowerCase()
        const initials = (record.patientInitials || '').toLowerCase()
        const by = (record.dispensedBy || '').toLowerCase()
        const ind = (record.indication || '').toLowerCase()
        const site = (record.clinicSite || '').toLowerCase()
        return med.includes(q) || initials.includes(q) || by.includes(q) || ind.includes(q) || site.includes(q)
      });
    }

    // Filter by date
    if (dateFilter !== 'all') {
      // Compute boundaries in EST
      const estTodayStr = toESTDateString(new Date());
      const estToday = logDateToUTCNoon(estTodayStr);

      filtered = filtered.filter(record => {
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
      const ta = a.dispensedAt instanceof Date ? a.dispensedAt.getTime() : new Date(a.dispensedAt as any).getTime()
      const tb = b.dispensedAt instanceof Date ? b.dispensedAt.getTime() : new Date(b.dispensedAt as any).getTime()
      return tb - ta
    });
  }, [records, searchTerm, dateFilter]);

  const totalDispensed = filteredRecords.reduce((sum, record) => sum + record.quantity, 0);
  const uniquePatients = new Set(filteredRecords.map(record => record.patientInitials)).size;
  const uniqueMedications = new Set(filteredRecords.map(record => record.medicationId)).size;

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
      'Notes'
    ];

    const csvData = filteredRecords.map(record => [
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
      record.notes || ''
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
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
    const excelData = filteredRecords.map(record => ({
      'Date': formatDateEST(record.dispensedAt),
      'Patient ID': record.patientId,
      'Medication': record.medicationName,
      'Dose': record.dose,
      'Lot Number': record.lotNumber,
      'Expiration': record.expirationDate ? formatDateEST(record.expirationDate) : '',
      'Amount Dispensed': record.quantity,
      'Physician Name': record.physicianName,
      'Student Name': record.studentName || '',
      'Dispensed By': record.dispensedBy,
      'Clinic Site': record.clinicSite || '',
      'Indication': record.indication,
      'Notes': record.notes || ''
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
      { wch: 30 }  // Notes
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
            className="pl-10"
          />
        </div>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {dateFilterOptions.map(option => (
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Patient ID</TableHead>
                  <TableHead>Medication</TableHead>
                  <TableHead>Dose</TableHead>
                  <TableHead>Lot #</TableHead>
                  <TableHead>Exp</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Physician</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Clinic Site</TableHead>
                  <TableHead>Notes</TableHead>
                  {onEditRecord && <TableHead className="w-[80px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map(record => (
                  <TableRow key={record.id}>
                    <TableCell className="text-sm">
                      {formatDateEST(record.dispensedAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-mono">
                        {record.patientId}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p className="font-medium">{record.medicationName}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {record.dose}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-mono">{record.lotNumber}</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {record.expirationDate ? formatDateEST(record.expirationDate) : '-'}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{record.quantity}</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {record.physicianName}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {record.studentName || '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {record.clinicSite || '-'}
                    </TableCell>
                    <TableCell className="max-w-[150px]">
                      {record.notes && (
                        <p className="text-sm text-muted-foreground truncate" title={record.notes}>
                          {record.notes}
                        </p>
                      )}
                    </TableCell>
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
                  </TableRow>
                ))}
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
    </div>
  );
}