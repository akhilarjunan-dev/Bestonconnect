import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Loader2, ClipboardList, CheckCircle, ArrowLeft } from 'lucide-react';

interface FormField {
  id: string;
  field_label: string;
  field_type: string;
  field_options: string[] | null;
  is_required: boolean;
  display_order: number;
}

export default function CustomOrderPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState<any>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    fetchData();
  }, [productId, user]);

  const fetchData = async () => {
    const { data: prod } = await supabase.from('products').select('id, name, description, price, image_urls, vendor_id').eq('id', productId).maybeSingle();
    if (!prod) { toast.error('Product not found'); navigate('/shop'); return; }
    setProduct(prod);

    const { data: formFields } = await supabase.from('custom_form_fields').select('*').eq('product_id', productId!).order('display_order');
    setFields((formFields || []).map(f => ({ ...f, field_options: f.field_options as string[] | null })));
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate required fields
    for (const field of fields) {
      if (field.is_required && !formValues[field.field_label]) {
        toast.error(`"${field.field_label}" is required`);
        return;
      }
    }

    setSubmitting(true);
    const { error } = await supabase.from('custom_orders').insert({
      product_id: productId!,
      user_id: user!.id,
      vendor_id: product.vendor_id,
      form_data: formValues,
      status: 'pending',
    });

    if (error) { toast.error('Failed to submit order'); setSubmitting(false); return; }
    setSubmitted(true);
    setSubmitting(false);
    toast.success('Custom order submitted!');
  };

  if (loading) return <Layout><div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></Layout>;

  if (submitted) {
    return (
      <Layout>
        <div className="container max-w-lg py-12 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold">Custom Order Submitted!</h2>
          <p className="text-muted-foreground">Your custom order for "{product?.name}" has been submitted. The vendor will review and respond soon.</p>
          <Button onClick={() => navigate('/shop')}>Continue Shopping</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-lg py-8 space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <ClipboardList className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Custom Order</CardTitle>
                <p className="text-sm text-muted-foreground">{product?.name}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {fields.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No custom order form has been set up for this product yet.</p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {fields.map(field => (
                  <div key={field.id} className="space-y-2">
                    <Label>{field.field_label} {field.is_required && <span className="text-destructive">*</span>}</Label>
                    
                    {field.field_type === 'text' && (
                      <Input
                        value={formValues[field.field_label] || ''}
                        onChange={e => setFormValues({ ...formValues, [field.field_label]: e.target.value })}
                        required={field.is_required}
                      />
                    )}
                    
                    {field.field_type === 'textarea' && (
                      <Textarea
                        value={formValues[field.field_label] || ''}
                        onChange={e => setFormValues({ ...formValues, [field.field_label]: e.target.value })}
                        required={field.is_required}
                        rows={3}
                      />
                    )}
                    
                    {field.field_type === 'number' && (
                      <Input
                        type="number"
                        value={formValues[field.field_label] || ''}
                        onChange={e => setFormValues({ ...formValues, [field.field_label]: e.target.value })}
                        required={field.is_required}
                      />
                    )}
                    
                    {field.field_type === 'dropdown' && field.field_options && (
                      <Select value={formValues[field.field_label] || ''} onValueChange={v => setFormValues({ ...formValues, [field.field_label]: v })}>
                        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          {field.field_options.map(opt => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    
                    {field.field_type === 'checkbox' && (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={!!formValues[field.field_label]}
                          onCheckedChange={v => setFormValues({ ...formValues, [field.field_label]: v })}
                        />
                        <span className="text-sm">Yes</span>
                      </div>
                    )}
                  </div>
                ))}

                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Submit Custom Order
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
