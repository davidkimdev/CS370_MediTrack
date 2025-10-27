import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Upload, FileSpreadsheet, FileText, AlertTriangle, CheckCircle, X, Calendar, Hash } from 'lucide-react';
import { parseFormularyFile } from '../services/formularyParser';

export interface ImportedMedicationRow {
  name: string;
  strength: string;
  quantity: number;
  lotNumber?: string;
  expirationDate?: string;
  status: 'valid' | 'warning' | 'error';
  message?: string;
}

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (items: ImportedMedicationRow[]) => void;
}

export function BulkImportDialog({ open, onOpenChange, onImport }: BulkImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importedData, setImportedData] = useState<ImportedMedicationRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview' | 'customize'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'docx', 'doc'].includes(fileExtension || '')) {
      alert('Please upload an Excel (.xlsx, .xls) or Word (.docx, .doc) file');
      return;
    }

    setFile(selectedFile);
    setIsProcessing(true);

    try {
      // Parse file
      const parsed = await parseFormularyFile(selectedFile);
      setImportedData(parsed);
      setStep('preview');
    } catch (error) {
      console.error('Error parsing file:', error);
      alert('Failed to parse file. Please check the file format.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = () => {
    onImport(importedData);
    handleClose();
  };

  const handleClose = () => {
    setFile(null);
    setImportedData([]);
    setStep('upload');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onOpenChange(false);
  };

  const updateRow = (index: number, field: keyof ImportedMedicationRow, value: string) => {
    const updated = [...importedData];
    updated[index] = { ...updated[index], [field]: value };
    setImportedData(updated);
  };

  const removeRow = (index: number) => {
    setImportedData(importedData.filter((_, i) => i !== index));
  };

  const validCount = importedData.filter(row => row.status === 'valid').length;
  const warningCount = importedData.filter(row => row.status === 'warning').length;
  const errorCount = importedData.filter(row => row.status === 'error').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] sm:max-w-[1400px] w-[1400px] max-h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>Bulk Import Medication Inventory</DialogTitle>
          <DialogDescription>
            Upload an Excel or Word document containing your medication formulary.
            Supported formats: .xlsx, .xls, .docx, .doc
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          {step === 'upload' && (
          <div className="space-y-4">
            {/* File Upload Area */}
            <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-4">
              <div className="flex justify-center gap-4">
                <FileSpreadsheet className="size-12 text-green-600" />
                <FileText className="size-12 text-blue-600" />
              </div>

              <div>
                <p className="text-lg font-medium mb-2">
                  {file ? file.name : 'Choose a file to upload'}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Excel (.xlsx, .xls) or Word (.docx, .doc) files supported
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.docx,.doc"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />

                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="gap-2"
                >
                  <Upload className="size-4" />
                  {isProcessing ? 'Processing...' : 'Select File'}
                </Button>
              </div>
            </div>

        
          </div>
          )}

          {step === 'preview' && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="border rounded-lg p-3 flex items-center gap-2">
                <CheckCircle className="size-5 text-green-600" />
                <div>
                  <p className="text-lg font-bold">{validCount}</p>
                  <p className="text-xs text-muted-foreground">Valid</p>
                </div>
              </div>
              <div className="border rounded-lg p-3 flex items-center gap-2">
                <AlertTriangle className="size-5 text-orange-600" />
                <div>
                  <p className="text-lg font-bold">{warningCount}</p>
                  <p className="text-xs text-muted-foreground">Warnings</p>
                </div>
              </div>
              <div className="border rounded-lg p-3 flex items-center gap-2">
                <X className="size-5 text-red-600" />
                <div>
                  <p className="text-lg font-bold">{errorCount}</p>
                  <p className="text-xs text-muted-foreground">Errors</p>
                </div>
              </div>
            </div>

            {/* Preview Table - Scrollable */}
            <div className="border rounded-lg overflow-hidden bg-background">
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 400px)' }}>
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow className="border-b">
                      <TableHead className="w-[30%] bg-background">Medication</TableHead>
                      <TableHead className="w-[12%] bg-background">Strength</TableHead>
                      <TableHead className="w-[8%] bg-background">Qty</TableHead>
                      <TableHead className="w-[15%] bg-background">Lot Number</TableHead>
                      <TableHead className="w-[12%] bg-background">Expiration</TableHead>
                      <TableHead className="w-[18%] bg-background">Status</TableHead>
                      <TableHead className="w-[5%] bg-background"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importedData.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell>{row.strength}</TableCell>
                        <TableCell>{row.quantity}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {row.lotNumber ? (
                              row.lotNumber
                            ) : (
                              <span className="text-xs text-muted-foreground italic">
                                Auto-generated
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {row.expirationDate ? (
                            row.expirationDate
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              +1 year
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge
                              variant={
                                row.status === 'valid' ? 'default' :
                                row.status === 'warning' ? 'secondary' :
                                'destructive'
                              }
                              className="text-xs"
                            >
                              {row.status}
                            </Badge>
                            {row.message && (
                              <p className="text-xs text-muted-foreground">{row.message}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeRow(index)}
                          >
                            <X className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {warningCount > 0 && (
              <Alert>
                <AlertTriangle className="size-4" />
                <AlertDescription>
                  <strong>{warningCount} item(s) are missing lot numbers or expiration dates.</strong>
                  <br />
                  These items will be imported with placeholder values. You can update them later in Stock Management.
                </AlertDescription>
              </Alert>
            )}
          </div>
          )}
        </div>

        {/* Fixed Footer with Actions */}
        {step === 'preview' && (
          <div className="px-6 py-4 border-t shrink-0 bg-background">
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={importedData.length === 0 || errorCount > 0}
                className="gap-2"
              >
                <Upload className="size-4" />
                Import {validCount + warningCount} Items
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

