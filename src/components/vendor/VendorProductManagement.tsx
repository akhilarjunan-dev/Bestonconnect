import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Loader2, Package, Search, ImagePlus, Clock } from 'lucide-react';
import { ProductBulkActions } from '@/components/admin/ProductBulkActions';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  mrp: number | null;
  category: string;
  stock_quantity: number | null;
  is_active: boolean;
  commission_rate: number;
  promoter_code_discount: number | null;
  image_urls: string[] | null;
  is_digital: boolean;
  unit: string | null;
  unit_quantity: number | null;
}

interface Category {
  id: string;
  name: string;
}

interface VendorProductManagementProps {
  onProductChange?: () => void;
}

export function VendorProductManagement({ onProductChange }: VendorProductManagementProps) {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    mrp: '',
    category: '',
    stock_quantity: '',
    is_active: true,
    commission_rate: '10',
    promoter_code_discount: '5',
    platform_commission: '0',
    is_digital: false,
    unit: 'piece',
    unit_quantity: '1',
    available_from: '',
    available_to: '',
    weight_grams: '500',
    product_type: 'default'
  });
  const [availabilitySlots, setAvailabilitySlots] = useState<{ from: string; to: string }[]>([]);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [user]);

  const fetchProducts = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('vendor_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to fetch products');
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('id, name')
      .eq('is_active', true)
      .order('display_order')
      .order('name');
    
    setCategories(data || []);
  };

  const isFoodCategory = (cat: string) => cat.toLowerCase().includes('food');

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      mrp: '',
      category: '',
      stock_quantity: '',
      is_active: true,
      commission_rate: '10',
      promoter_code_discount: '5',
      platform_commission: '0',
      is_digital: false,
      unit: 'piece',
      unit_quantity: '1',
      available_from: '',
      available_to: '',
      weight_grams: '500',
      product_type: 'default'
    });
    setAvailabilitySlots([]);
    setSelectedProduct(null);
  };

  const openEditDialog = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      mrp: product.mrp?.toString() || '',
      category: product.category,
      stock_quantity: product.stock_quantity?.toString() || '',
      is_active: product.is_active,
      commission_rate: product.commission_rate.toString(),
      promoter_code_discount: product.promoter_code_discount?.toString() || '5',
      platform_commission: (product as any).platform_commission?.toString() || '0',
      is_digital: product.is_digital || false,
      unit: product.unit || 'piece',
      unit_quantity: product.unit_quantity?.toString() || '1',
      available_from: (product as any).available_from || '',
      available_to: (product as any).available_to || '',
      weight_grams: (product as any).weight_grams?.toString() || '500',
      product_type: (product as any).product_type || 'default'
    });
    const slots = (product as any).availability_slots;
    if (Array.isArray(slots) && slots.length > 0) {
      setAvailabilitySlots(slots);
    } else if ((product as any).available_from && (product as any).available_to) {
      setAvailabilitySlots([{ from: (product as any).available_from, to: (product as any).available_to }]);
    } else {
      setAvailabilitySlots([]);
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.price || !formData.category) {
      toast.error('Please fill in required fields');
      return;
    }

    setSaving(true);

    const productData = {
      name: formData.name,
      description: formData.description || null,
      price: parseFloat(formData.price),
      mrp: formData.mrp ? parseFloat(formData.mrp) : null,
      category: formData.category,
      stock_quantity: formData.stock_quantity ? parseInt(formData.stock_quantity) : null,
      is_active: formData.is_active,
      commission_rate: parseFloat(formData.commission_rate),
      promoter_code_discount: formData.promoter_code_discount ? parseFloat(formData.promoter_code_discount) : 0,
      platform_commission: formData.platform_commission ? parseFloat(formData.platform_commission) : 0,
      is_digital: formData.is_digital,
      unit: formData.unit,
      unit_quantity: parseFloat(formData.unit_quantity),
      vendor_id: user?.id,
      weight_grams: formData.weight_grams ? parseInt(formData.weight_grams) : 500,
      product_type: formData.product_type,
      available_from: availabilitySlots.length > 0 ? availabilitySlots[0].from : (formData.available_from || null),
      available_to: availabilitySlots.length > 0 ? availabilitySlots[0].to : (formData.available_to || null),
      availability_slots: availabilitySlots.length > 0 ? availabilitySlots : null
    };

    if (selectedProduct) {
      const { error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', selectedProduct.id);

      if (error) {
        toast.error('Failed to update product');
      } else {
        toast.success('Product updated');
        fetchProducts();
        onProductChange?.();
        setDialogOpen(false);
        resetForm();
      }
    } else {
      const { error } = await supabase
        .from('products')
        .insert(productData);

      if (error) {
        toast.error('Failed to create product');
      } else {
        toast.success('Product created');
        fetchProducts();
        onProductChange?.();
        setDialogOpen(false);
        resetForm();
      }
    }

    setSaving(false);
  };

  const handleDelete = async () => {
    if (!selectedProduct) return;

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', selectedProduct.id);

    if (error) {
      toast.error('Failed to delete product');
    } else {
      toast.success('Product deleted');
      fetchProducts();
      onProductChange?.();
      setDeleteDialogOpen(false);
      setSelectedProduct(null);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              My Products
            </CardTitle>
            <CardDescription>Manage your product catalog</CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{selectedProduct ? 'Edit Product' : 'Add Product'}</DialogTitle>
                <DialogDescription>
                  {selectedProduct ? 'Update your product details' : 'Create a new product in your catalog'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="name">Product Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter product name"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Enter product description"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="price">Selling Price *</Label>
                    <Input
                      id="price"
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="mrp">MRP</Label>
                    <Input
                      id="mrp"
                      type="number"
                      value={formData.mrp}
                      onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Category *</Label>
                    <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="product_type">Product Type</Label>
                    <Select value={formData.product_type} onValueChange={(v) => setFormData({ ...formData, product_type: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default (Buy Now)</SelectItem>
                        <SelectItem value="custom_order">Custom Order</SelectItem>
                        <SelectItem value="enquiry">Enquiry Only</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formData.product_type === 'custom_order' && 'Customers fill a custom form'}
                      {formData.product_type === 'enquiry' && 'Customers enquire via WhatsApp'}
                      {formData.product_type === 'default' && 'Standard purchase flow'}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="stock">Stock Quantity</Label>
                    <Input
                      id="stock"
                      type="number"
                      value={formData.stock_quantity}
                      onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  {!formData.is_digital && (
                    <div>
                      <Label htmlFor="weight_grams">Weight (grams) *</Label>
                      <Input
                        id="weight_grams"
                        type="number"
                        min="1"
                        value={formData.weight_grams}
                        onChange={(e) => setFormData({ ...formData, weight_grams: e.target.value })}
                        placeholder="500"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Used for delivery charge calculation</p>
                    </div>
                  )}
                  <div>
                    <Label htmlFor="unit">Unit</Label>
                    <Select value={formData.unit} onValueChange={(v) => setFormData({ ...formData, unit: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="piece">Piece</SelectItem>
                        <SelectItem value="kg">Kilogram</SelectItem>
                        <SelectItem value="g">Gram</SelectItem>
                        <SelectItem value="l">Liter</SelectItem>
                        <SelectItem value="ml">Milliliter</SelectItem>
                        <SelectItem value="box">Box</SelectItem>
                        <SelectItem value="pack">Pack</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="unit_quantity">Unit Quantity</Label>
                    <Input
                      id="unit_quantity"
                      type="number"
                      value={formData.unit_quantity}
                      onChange={(e) => setFormData({ ...formData, unit_quantity: e.target.value })}
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="promoter_code_discount">Shopper Discount (%)</Label>
                    <Input
                      id="promoter_code_discount"
                      type="number"
                      value={formData.promoter_code_discount}
                      onChange={(e) => setFormData({ ...formData, promoter_code_discount: e.target.value })}
                      placeholder="5"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Discount for shoppers using promoter code</p>
                  </div>
                  <div>
                    <Label htmlFor="commission">Promoter Commission (%)</Label>
                    <Input
                      id="commission"
                      type="number"
                      value={formData.commission_rate}
                      onChange={(e) => setFormData({ ...formData, commission_rate: e.target.value })}
                      placeholder="10"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Commission promoters earn</p>
                  </div>
                  <div>
                    <Label htmlFor="platform_commission">Platform Commission (%)</Label>
                    <Input
                      id="platform_commission"
                      type="number"
                      value={formData.platform_commission}
                      onChange={(e) => setFormData({ ...formData, platform_commission: e.target.value })}
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Platform's commission from each sale</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                      />
                      <Label htmlFor="is_active">Active</Label>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="is_digital"
                      checked={formData.is_digital}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_digital: checked })}
                    />
                    <Label htmlFor="is_digital">Digital Product</Label>
                  </div>
                </div>

                {/* Food Availability Time Slots */}
                {isFoodCategory(formData.category) && (
                  <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg space-y-4 col-span-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Availability Time Slots
                      </h4>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAvailabilitySlots(prev => [...prev, { from: '', to: '' }])}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Slot
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Add multiple time windows when this food product is available. Leave empty for all-day availability.</p>
                    {availabilitySlots.length === 0 && (
                      <p className="text-sm text-muted-foreground italic">No time slots added — available all day.</p>
                    )}
                    {availabilitySlots.map((slot, index) => (
                      <div key={index} className="flex items-end gap-3">
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">Slot {index + 1} — From</Label>
                          <Input
                            type="time"
                            value={slot.from}
                            onChange={(e) => {
                              const updated = [...availabilitySlots];
                              updated[index] = { ...updated[index], from: e.target.value };
                              setAvailabilitySlots(updated);
                            }}
                          />
                        </div>
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">To</Label>
                          <Input
                            type="time"
                            value={slot.to}
                            onChange={(e) => {
                              const updated = [...availabilitySlots];
                              updated[index] = { ...updated[index], to: e.target.value };
                              setAvailabilitySlots(updated);
                            }}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => setAvailabilitySlots(prev => prev.filter((_, i) => i !== index))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {selectedProduct ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
          <ProductBulkActions products={products} onRefresh={fetchProducts} />
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No products found</p>
            <Button className="mt-4" onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Product
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {product.image_urls?.[0] ? (
                          <img src={product.image_urls[0]} alt={product.name} className="w-10 h-10 rounded object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                            <ImagePlus className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{product.name}</p>
                          {product.is_digital && <Badge variant="secondary" className="text-xs">Digital</Badge>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">${product.price}</p>
                        {product.mrp && product.mrp > product.price && (
                          <p className="text-sm text-muted-foreground line-through">${product.mrp}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {product.is_digital ? (
                        <Badge variant="secondary">∞</Badge>
                      ) : (
                        <span className={product.stock_quantity && product.stock_quantity < 10 ? 'text-warning' : ''}>
                          {product.stock_quantity ?? 'N/A'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.is_active ? 'default' : 'secondary'}>
                        {product.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => openEditDialog(product)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => { setSelectedProduct(product); setDeleteDialogOpen(true); }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedProduct?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
