import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Download, Upload, Loader2, UserPlus } from 'lucide-react';
import JSZip from 'jszip';

type ProductExportRow = Record<string, unknown> & {
  id?: string;
  name?: string;
  image_urls?: string[] | null;
};

interface ProductBulkActionsProps {
  products: ProductExportRow[];
  onRefresh: () => void;
  showVendorAssign?: boolean;
}

export function ProductBulkActions({ products, onRefresh, showVendorAssign = false }: ProductBulkActionsProps) {
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [vendors, setVendors] = useState<{ id: string; full_name: string | null; email: string }[]>([]);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportProducts = async () => {
    if (products.length === 0) {
      toast.error('No products to export');
      return;
    }

    setExporting(true);
    try {
      const zip = new JSZip();
      const imageFolder = zip.folder('images');
      const headers = ['name', 'description', 'price', 'mrp', 'category', 'stock_quantity', 'commission_rate', 'platform_commission', 'is_active', 'is_digital', 'unit', 'unit_quantity', 'shipping_charge', 'tax_rate', 'weight_grams', 'product_type', 'vendor_id', 'main_image', 'image_files'];
      const csvRows = [headers.join(',')];
      const usedImageNames = new Set<string>();
      let exportedImages = 0;

      for (const p of products) {
        const imageUrls = Array.isArray(p.image_urls) ? p.image_urls.filter(Boolean) : [];
        const imageFiles: string[] = [];

        for (let index = 0; index < imageUrls.length; index++) {
          const imageUrl = imageUrls[index];
          const imageName = `${sanitizeFileName(p.name || 'product')}_${String(index + 1).padStart(2, '0')}${getImageExtension(imageUrl)}`;
          const uniqueImageName = ensureUniqueImageName(imageName, usedImageNames);
          usedImageNames.add(uniqueImageName);
          imageFiles.push(`images/${uniqueImageName}`);

          try {
            const response = await fetch(imageUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();
            imageFolder?.file(uniqueImageName, blob);
            exportedImages++;
          } catch (error) {
            console.error('Image export failed:', imageUrl, error);
          }
        }

        const row = headers.map(h => {
          const val = h === 'main_image'
            ? imageFiles[0] || ''
            : h === 'image_files'
              ? imageFiles.join('; ')
              : p[h];
          if (val === null || val === undefined) return '';
          const str = String(val);
          return str.includes(',') || str.includes('"') || str.includes('\n') || str.includes(';')
            ? `"${str.replace(/"/g, '""')}"` : str;
        });
        csvRows.push(row.join(','));
      }

      zip.file('products_export.csv', csvRows.join('\n'));
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `products_export_${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${products.length} products with ${exportedImages} images`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to export products');
    } finally {
      setExporting(false);
    }
  };

  const importProducts = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) {
        toast.error('CSV file is empty or has no data rows');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const nameIdx = headers.indexOf('name');
      const priceIdx = headers.indexOf('price');
      const categoryIdx = headers.indexOf('category');

      if (nameIdx === -1 || priceIdx === -1 || categoryIdx === -1) {
        toast.error('CSV must have name, price, and category columns');
        return;
      }

      let imported = 0;
      let failed = 0;

      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);
        if (values.length < headers.length) continue;

        const productData: Record<string, string | number | boolean | null> = {};
        headers.forEach((h, idx) => {
          const val = values[idx]?.trim();
          if (!val) return;
          
          if (['price', 'mrp', 'commission_rate', 'platform_commission', 'shipping_charge', 'tax_rate', 'unit_quantity'].includes(h)) {
            productData[h] = parseFloat(val) || 0;
          } else if (['stock_quantity', 'weight_grams'].includes(h)) {
            productData[h] = parseInt(val) || null;
          } else if (['is_active', 'is_digital'].includes(h)) {
            productData[h] = val.toLowerCase() === 'true';
          } else if (h === 'vendor_id' && val) {
            productData[h] = val;
          } else {
            productData[h] = val;
          }
        });

        if (!productData.name || !productData.price || !productData.category) continue;

        const { error } = await supabase.from('products').insert({
          name: productData.name,
          price: productData.price,
          category: productData.category,
          description: productData.description || null,
          mrp: productData.mrp || null,
          stock_quantity: productData.stock_quantity || null,
          commission_rate: productData.commission_rate || 10,
          is_active: productData.is_active ?? true,
          is_digital: productData.is_digital ?? false,
          unit: productData.unit || 'piece',
          unit_quantity: productData.unit_quantity || 1,
          shipping_charge: productData.shipping_charge || 0,
          tax_rate: productData.tax_rate || 0,
          weight_grams: productData.weight_grams || 500,
          product_type: productData.product_type || 'default',
          vendor_id: productData.vendor_id || null,
        });

        if (error) {
          failed++;
          console.error('Import error:', error);
        } else {
          imported++;
        }
      }

      toast.success(`Imported ${imported} products${failed > 0 ? `, ${failed} failed` : ''}`);
      onRefresh();
    } catch (err) {
      console.error(err);
      toast.error('Failed to parse CSV file');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openAssignDialog = async () => {
    // Fetch vendors
    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'vendor');

    if (roles && roles.length > 0) {
      const vendorIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', vendorIds);

      setVendors(profiles || []);
    }
    setSelectedProductIds([]);
    setSelectedVendor('');
    setAssignDialogOpen(true);
  };

  const handleAssignToVendor = async () => {
    if (!selectedVendor) {
      toast.error('Please select a vendor');
      return;
    }
    if (selectedProductIds.length === 0) {
      toast.error('Please select at least one product');
      return;
    }

    setAssigning(true);
    const { error } = await supabase
      .from('products')
      .update({ vendor_id: selectedVendor })
      .in('id', selectedProductIds);

    if (error) {
      toast.error('Failed to assign products');
    } else {
      toast.success(`${selectedProductIds.length} product(s) assigned to vendor`);
      setAssignDialogOpen(false);
      onRefresh();
    }
    setAssigning(false);
  };

  const toggleProductSelection = (id: string) => {
    setSelectedProductIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={exportProducts} disabled={exporting} className="gap-2">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {exporting ? 'Exporting...' : 'Export Products + Images'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={importProducts}
          className="hidden"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="gap-2"
        >
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {importing ? 'Importing...' : 'Import CSV'}
        </Button>
        {showVendorAssign && (
          <Button variant="outline" size="sm" onClick={openAssignDialog} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Assign to Vendor
          </Button>
        )}
      </div>

      {/* Assign to Vendor Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Products to Vendor</DialogTitle>
            <DialogDescription>Select products and a vendor to assign them.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Vendor</Label>
              <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.full_name || v.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Select Products ({selectedProductIds.length} selected)</Label>
              <div className="border border-input rounded-md p-3 max-h-60 overflow-y-auto space-y-1 mt-1">
                {products.map(p => (
                  <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1">
                    <input
                      type="checkbox"
                      checked={selectedProductIds.includes(p.id)}
                      onChange={() => toggleProductSelection(p.id)}
                      className="rounded border-input"
                    />
                    <span className="truncate">{p.name}</span>
                    <span className="text-muted-foreground ml-auto text-xs">₹{p.price}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAssignToVendor} disabled={assigning}>
                {assigning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Assign {selectedProductIds.length} Product(s)
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function sanitizeFileName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'product';
}

function getImageExtension(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.(jpg|jpeg|png|webp|gif|avif)$/i);
    return match ? `.${match[1].toLowerCase()}` : '.jpg';
  } catch {
    return '.jpg';
  }
}

function ensureUniqueImageName(fileName: string, usedNames: Set<string>): string {
  if (!usedNames.has(fileName)) return fileName;

  const dotIndex = fileName.lastIndexOf('.');
  const base = dotIndex >= 0 ? fileName.slice(0, dotIndex) : fileName;
  const ext = dotIndex >= 0 ? fileName.slice(dotIndex) : '';
  let counter = 2;
  let nextName = `${base}_${counter}${ext}`;

  while (usedNames.has(nextName)) {
    counter++;
    nextName = `${base}_${counter}${ext}`;
  }

  return nextName;
}
