import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, FileText } from 'lucide-react';
import { VendorCustomFormBuilder } from './VendorCustomFormBuilder';

interface Product {
  id: string;
  name: string;
  product_type: string;
}

export function VendorFormBuilderTab() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchProducts();
  }, [user]);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, name, product_type')
      .eq('vendor_id', user?.id)
      .eq('product_type', 'custom_order')
      .eq('is_active', true);

    setProducts(data || []);
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const selectedProduct = products.find(p => p.id === selectedProductId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <FileText className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">Custom Order Form Builder</h2>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No "Custom Order" products found. Create a product with type "Custom Order" first.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2 max-w-md">
            <Label>Select Product</Label>
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a custom order product..." />
              </SelectTrigger>
              <SelectContent>
                {products.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProduct && (
            <VendorCustomFormBuilder productId={selectedProduct.id} productName={selectedProduct.name} />
          )}
        </>
      )}
    </div>
  );
}
