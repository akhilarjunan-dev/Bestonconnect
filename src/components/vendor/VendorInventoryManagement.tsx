import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Boxes, Save, Search, AlertTriangle } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  stock_quantity: number | null;
  is_active: boolean;
  is_digital: boolean;
  category: string;
}

export function VendorInventoryManagement() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editedStock, setEditedStock] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchProducts();
  }, [user]);

  const fetchProducts = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('id, name, stock_quantity, is_active, is_digital, category')
      .eq('vendor_id', user.id)
      .eq('is_digital', false)
      .order('name');

    if (error) {
      toast.error('Failed to fetch inventory');
    } else {
      setProducts(data || []);
      // Initialize edited stock with current values
      const stockMap: Record<string, string> = {};
      data?.forEach(p => {
        stockMap[p.id] = p.stock_quantity?.toString() || '0';
      });
      setEditedStock(stockMap);
    }
    setLoading(false);
  };

  const handleSaveStock = async (productId: string) => {
    const newStock = parseInt(editedStock[productId] || '0');
    
    if (isNaN(newStock) || newStock < 0) {
      toast.error('Invalid stock quantity');
      return;
    }

    setSaving(productId);
    
    const { error } = await supabase
      .from('products')
      .update({ stock_quantity: newStock })
      .eq('id', productId);

    if (error) {
      toast.error('Failed to update stock');
    } else {
      toast.success('Stock updated');
      fetchProducts();
    }
    
    setSaving(null);
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const lowStockProducts = products.filter(p => (p.stock_quantity || 0) < 10);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="w-5 h-5" />
              Low Stock Alert
            </CardTitle>
            <CardDescription>
              {lowStockProducts.length} product(s) have low stock (less than 10 units)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lowStockProducts.map(p => (
                <Badge key={p.id} variant="outline" className="text-warning border-warning/50">
                  {p.name}: {p.stock_quantity || 0} left
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Boxes className="w-5 h-5" />
              Inventory Management
            </CardTitle>
            <CardDescription>Update stock quantities for your products</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <Boxes className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No physical products found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Current Stock</TableHead>
                    <TableHead>New Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell>
                        <Badge variant={(product.stock_quantity || 0) < 10 ? 'destructive' : 'secondary'}>
                          {product.stock_quantity || 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          value={editedStock[product.id] || '0'}
                          onChange={(e) => setEditedStock({ ...editedStock, [product.id]: e.target.value })}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.is_active ? 'default' : 'secondary'}>
                          {product.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          size="sm" 
                          onClick={() => handleSaveStock(product.id)}
                          disabled={saving === product.id || editedStock[product.id] === product.stock_quantity?.toString()}
                        >
                          {saving === product.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Save className="w-4 h-4 mr-1" />
                              Save
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
