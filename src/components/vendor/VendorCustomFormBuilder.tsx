import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, FileText, GripVertical } from 'lucide-react';

interface FormField {
  id?: string;
  product_id: string;
  field_label: string;
  field_type: string;
  field_options: string[] | null;
  is_required: boolean;
  display_order: number;
}

interface VendorCustomFormBuilderProps {
  productId: string;
  productName: string;
}

export function VendorCustomFormBuilder({ productId, productName }: VendorCustomFormBuilderProps) {
  const [fields, setFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchFields(); }, [productId]);

  const fetchFields = async () => {
    const { data } = await supabase
      .from('custom_form_fields')
      .select('*')
      .eq('product_id', productId)
      .order('display_order');

    setFields((data || []).map(f => ({
      ...f,
      field_options: f.field_options as string[] | null
    })));
    setLoading(false);
  };

  const addField = () => {
    setFields([...fields, {
      product_id: productId,
      field_label: '',
      field_type: 'text',
      field_options: null,
      is_required: false,
      display_order: fields.length,
    }]);
  };

  const removeField = async (index: number) => {
    const field = fields[index];
    if (field.id) {
      await supabase.from('custom_form_fields').delete().eq('id', field.id);
    }
    setFields(fields.filter((_, i) => i !== index));
    toast.success('Field removed');
  };

  const updateField = (index: number, updates: Partial<FormField>) => {
    setFields(fields.map((f, i) => i === index ? { ...f, ...updates } : f));
  };

  const saveFields = async () => {
    setSaving(true);
    
    // Delete existing and re-insert all
    await supabase.from('custom_form_fields').delete().eq('product_id', productId);
    
    const validFields = fields.filter(f => f.field_label.trim());
    if (validFields.length > 0) {
      const { error } = await supabase.from('custom_form_fields').insert(
        validFields.map((f, i) => ({
          product_id: productId,
          field_label: f.field_label.trim(),
          field_type: f.field_type,
          field_options: f.field_type === 'dropdown' ? f.field_options : null,
          is_required: f.is_required,
          display_order: i,
        }))
      );
      if (error) { toast.error('Failed to save fields'); setSaving(false); return; }
    }
    
    toast.success('Form fields saved');
    setSaving(false);
    fetchFields();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Custom Order Form</CardTitle>
              <CardDescription>Define form fields for "{productName}"</CardDescription>
            </div>
          </div>
          <Button onClick={addField} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" /> Add Field
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.length === 0 ? (
          <p className="text-center py-4 text-muted-foreground text-sm">
            No form fields yet. Add fields that customers will fill when placing a custom order.
          </p>
        ) : (
          fields.map((field, index) => (
            <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
              <div className="flex-1 grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Field Label</Label>
                  <Input
                    value={field.field_label}
                    onChange={e => updateField(index, { field_label: e.target.value })}
                    placeholder="e.g., Size, Color, Description"
                  />
                </div>
                <div>
                  <Label className="text-xs">Field Type</Label>
                  <Select value={field.field_type} onValueChange={v => updateField(index, { field_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="textarea">Long Text</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="dropdown">Dropdown</SelectItem>
                      <SelectItem value="checkbox">Checkbox</SelectItem>
                      <SelectItem value="file">File Upload</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {field.field_type === 'dropdown' && (
                  <div className="col-span-2">
                    <Label className="text-xs">Options (comma-separated)</Label>
                    <Input
                      value={(field.field_options || []).join(', ')}
                      onChange={e => updateField(index, { field_options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                      placeholder="Option 1, Option 2, Option 3"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={field.is_required}
                    onCheckedChange={v => updateField(index, { is_required: v })}
                  />
                  <span className="text-xs text-muted-foreground">Required</span>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeField(index)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}

        {fields.length > 0 && (
          <Button onClick={saveFields} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Form Fields
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
