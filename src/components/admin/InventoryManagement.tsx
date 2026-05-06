import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Package, AlertTriangle, Search, RefreshCw, Plus, Minus, Edit2 } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock_quantity: number | null;
  is_active: boolean;
  is_digital: boolean;
  image_urls: string[] | null;
}

const LOW_STOCK_THRESHOLD = 10;
const OUT_OF_STOCK_THRESHOLD = 0;

export function InventoryManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState<'add' | 'subtract' | 'set'>('add');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('products')
      .select('id, name, category, price, stock_quantity, is_active, is_digital, image_urls')
      .eq('is_digital', false) // Only physical products have inventory
      .order('name');

    if (error) {
      toast.error('Failed to fetch products');
      setLoading(false);
      return;
    }

    setProducts(data || []);
    setLoading(false);
  };

  const getStockStatus = (stock: number | null) => {
    if (stock === null) return 'unlimited';
    if (stock <= OUT_OF_STOCK_THRESHOLD) return 'out_of_stock';
    if (stock <= LOW_STOCK_THRESHOLD) return 'low_stock';
    return 'in_stock';
  };

  const getStockBadge = (stock: number | null) => {
    const status = getStockStatus(stock);
    switch (status) {
      case 'unlimited':
        return <Badge variant="outline">Unlimited</Badge>;
      case 'out_of_stock':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Out of Stock</Badge>;
      case 'low_stock':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Low Stock</Badge>;
      case 'in_stock':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">In Stock</Badge>;
    }
  };

  const openAdjustDialog = (product: Product) => {
    setSelectedProduct(product);
    setAdjustAmount('');
    setAdjustType('add');
    setAdjustDialogOpen(true);
  };

  const adjustStock = async () => {
    if (!selectedProduct || !adjustAmount) return;

    const amount = parseInt(adjustAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error('Please enter a valid number');
      return;
    }

    let newStock: number;
    const currentStock = selectedProduct.stock_quantity || 0;

    switch (adjustType) {
      case 'add':
        newStock = currentStock + amount;
        break;
      case 'subtract':
        newStock = Math.max(0, currentStock - amount);
        break;
      case 'set':
        newStock = amount;
        break;
    }

    const { error } = await supabase
      .from('products')
      .update({ stock_quantity: newStock })
      .eq('id', selectedProduct.id);

    if (error) {
      toast.error('Failed to update stock');
      return;
    }

    toast.success(`Stock updated to ${newStock}`);
    setAdjustDialogOpen(false);
    fetchProducts();
  };

  const quickAdjust = async (productId: string, change: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const currentStock = product.stock_quantity || 0;
    const newStock = Math.max(0, currentStock + change);

    const { error } = await supabase
      .from('products')
      .update({ stock_quantity: newStock })
      .eq('id', productId);

    if (error) {
      toast.error('Failed to update stock');
      return;
    }

    toast.success(`Stock ${change > 0 ? 'increased' : 'decreased'} to ${newStock}`);
    fetchProducts();
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const status = getStockStatus(product.stock_quantity);
    
    if (stockFilter === 'all') return matchesSearch;
    if (stockFilter === 'low') return matchesSearch && status === 'low_stock';
    if (stockFilter === 'out') return matchesSearch && status === 'out_of_stock';
    if (stockFilter === 'unlimited') return matchesSearch && status === 'unlimited';
    return matchesSearch;
  });

  const stats = {
    total: products.length,
    inStock: products.filter(p => getStockStatus(p.stock_quantity) === 'in_stock').length,
    lowStock: products.filter(p => getStockStatus(p.stock_quantity) === 'low_stock').length,
    outOfStock: products.filter(p => getStockStatus(p.stock_quantity) === 'out_of_stock').length,
    unlimited: products.filter(p => getStockStatus(p.stock_quantity) === 'unlimited').length,
  };

  if (loading) {
    return <div className="animate-pulse text-muted-foreground p-8">Loading inventory...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {(stats.lowStock > 0 || stats.outOfStock > 0) && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-medium">Inventory Alerts</p>
                <p className="text-sm text-muted-foreground">
                  {stats.outOfStock > 0 && <span className="text-red-600">{stats.outOfStock} products out of stock. </span>}
                  {stats.lowStock > 0 && <span className="text-yellow-600">{stats.lowStock} products running low.</span>}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total Products</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.inStock}</p>
            <p className="text-sm text-muted-foreground">In Stock</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.lowStock}</p>
            <p className="text-sm text-muted-foreground">Low Stock</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.outOfStock}</p>
            <p className="text-sm text-muted-foreground">Out of Stock</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-muted-foreground">{stats.unlimited}</p>
            <p className="text-sm text-muted-foreground">Unlimited</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Inventory Management
            </CardTitle>
            <CardDescription>Track and manage product stock levels</CardDescription>
          </div>
          <Button variant="outline" onClick={fetchProducts}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={stockFilter} onValueChange={setStockFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter stock" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                <SelectItem value="low">Low Stock</SelectItem>
                <SelectItem value="out">Out of Stock</SelectItem>
                <SelectItem value="unlimited">Unlimited</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No products found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Quick Adjust</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id} className={
                    getStockStatus(product.stock_quantity) === 'out_of_stock' ? 'bg-red-500/5' :
                    getStockStatus(product.stock_quantity) === 'low_stock' ? 'bg-yellow-500/5' : ''
                  }>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {product.image_urls?.[0] ? (
                          <img 
                            src={product.image_urls[0]} 
                            alt="" 
                            className="w-10 h-10 rounded object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{product.name}</p>
                          {!product.is_active && (
                            <Badge variant="outline" className="text-xs">Inactive</Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{product.category}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      ₹{product.price.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <span className="text-xl font-bold">
                        {product.stock_quantity === null ? '∞' : product.stock_quantity}
                      </span>
                    </TableCell>
                    <TableCell>
                      {getStockBadge(product.stock_quantity)}
                    </TableCell>
                    <TableCell>
                      {product.stock_quantity !== null && (
                        <div className="flex items-center gap-1">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => quickAdjust(product.id, -1)}
                            disabled={product.stock_quantity <= 0}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => quickAdjust(product.id, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => openAdjustDialog(product)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Adjust Stock Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock - {selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Current Stock</p>
              <p className="text-3xl font-bold">
                {selectedProduct?.stock_quantity === null ? '∞' : selectedProduct?.stock_quantity}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Adjustment Type</Label>
              <Select value={adjustType} onValueChange={(v) => setAdjustType(v as 'add' | 'subtract' | 'set')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add to stock</SelectItem>
                  <SelectItem value="subtract">Subtract from stock</SelectItem>
                  <SelectItem value="set">Set exact amount</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">
                {adjustType === 'set' ? 'New Stock Level' : 'Quantity'}
              </Label>
              <Input
                id="amount"
                type="number"
                min="0"
                placeholder="Enter amount"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
              />
            </div>

            {adjustAmount && (
              <div className="p-4 bg-primary/10 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">New Stock Level</p>
                <p className="text-3xl font-bold text-primary">
                  {(() => {
                    const amount = parseInt(adjustAmount) || 0;
                    const current = selectedProduct?.stock_quantity || 0;
                    switch (adjustType) {
                      case 'add': return current + amount;
                      case 'subtract': return Math.max(0, current - amount);
                      case 'set': return amount;
                    }
                  })()}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialogOpen(false)}>Cancel</Button>
            <Button onClick={adjustStock}>Update Stock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}