import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Package, Plus, Edit2, Trash2, Image, Percent, Upload, X, Loader2, GripVertical, FileUp, File, Clock, Search } from 'lucide-react';
import { ProductBulkActions } from './ProductBulkActions';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  mrp: number | null;
  unit: string | null;
  unit_quantity: number | null;
  discount_type: string | null;
  discount_value: number | null;
  digital_file_url: string | null;
  commission_rate: number;
  promoter_code_discount: number | null;
  platform_commission: number | null;
  category: string;
  image_urls: string[] | null;
  is_active: boolean;
  is_digital: boolean;
  is_featured: boolean;
  is_hot_deal: boolean;
  stock_quantity: number | null;
  shipping_charge: number | null;
  tax_rate: number | null;
  created_at: string;
}

const DEFAULT_CATEGORIES = [
  'Electronics',
  'Fashion',
  'Health & Beauty',
  'Home & Living',
  'Sports & Outdoors',
  'Books & Media',
  'Food & Beverages',
  'Digital Products',
  'Services',
  'Other'
];

const UNITS = [
  'piece',
  'kg',
  'g',
  'mg',
  'l',
  'ml',
  'pack',
  'set',
  'box',
  'dozen'
];

// Sortable Image Item Component
function SortableImageItem({ 
  id, 
  url, 
  index, 
  onRemove 
}: { 
  id: string; 
  url: string; 
  index: number; 
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("relative group", isDragging && "z-50 opacity-80")}
    >
      <div className={cn(
        "relative rounded-lg overflow-hidden border-2 transition-all",
        isDragging ? "border-primary shadow-lg" : "border-border"
      )}>
        <img
          src={url}
          alt={`Product image ${index + 1}`}
          className="w-full h-20 object-cover"
        />
        
        <button
          {...attributes}
          {...listeners}
          type="button"
          className="absolute top-1 left-1 p-1 rounded bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-3 w-3 text-foreground" />
        </button>

        <button
          type="button"
          onClick={onRemove}
          className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
        >
          <X className="h-3 w-3" />
        </button>

        {index === 0 && (
          <span className="absolute bottom-1 left-1 text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
            Main
          </span>
        )}
      </div>
    </div>
  );
}

// Image Upload Section with Drag & Drop
function ImageUploadSection({
  imageUrls,
  setImageUrls,
  uploading,
  setUploading,
  fileInputRef,
  handleImageUpload
}: {
  imageUrls: string[];
  setImageUrls: React.Dispatch<React.SetStateAction<string[]>>;
  uploading: boolean;
  setUploading: React.Dispatch<React.SetStateAction<boolean>>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setImageUrls((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const removeImage = (indexToRemove: number) => {
    setImageUrls(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className="space-y-3">
      <Label>Product Images (drag to reorder)</Label>
      
      {imageUrls.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={imageUrls} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-4 gap-3">
              {imageUrls.map((url, index) => (
                <SortableImageItem
                  key={url}
                  id={url}
                  url={url}
                  index={index}
                  onRemove={() => removeImage(index)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageUpload}
          className="hidden"
          id="image-upload"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="gap-2"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {uploading ? 'Uploading...' : 'Upload Images'}
        </Button>
        <span className="text-sm text-muted-foreground">
          Max 5MB per image. Drag to reorder. First = main.
        </span>
      </div>
    </div>
  );
}

export function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingDigital, setUploadingDigital] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [digitalFileUrl, setDigitalFileUrl] = useState<string>('');
  const [digitalFileName, setDigitalFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const digitalFileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['Other']);
  
  // Product list search & filter
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('all');
  const [productStatusFilter, setProductStatusFilter] = useState<string>('all');
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    mrp: '',
    unit: 'piece',
    unit_quantity: '1',
    discount_type: 'percentage',
    discount_value: '0',
    commission_rate: '10',
    promoter_code_discount: '5',
    platform_commission: '0',
    category: 'Other',
    product_type: 'default',
    is_active: true,
    is_digital: false,
    is_featured: false,
    is_hot_deal: false,
    stock_quantity: '',
    shipping_charge: '0',
    tax_rate: '0',
    weight_grams: '500',
    available_from: '',
    available_to: ''
  });
  const [availabilitySlots, setAvailabilitySlots] = useState<{ from: string; to: string }[]>([]);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  // Calculate sale price based on MRP and discount
  useEffect(() => {
    if (formData.mrp && formData.discount_value) {
      const mrp = parseFloat(formData.mrp);
      const discountValue = parseFloat(formData.discount_value);
      
      if (formData.discount_type === 'percentage') {
        const salePrice = mrp - (mrp * discountValue / 100);
        setFormData(prev => ({ ...prev, price: salePrice.toFixed(2) }));
      } else {
        const salePrice = mrp - discountValue;
        setFormData(prev => ({ ...prev, price: Math.max(0, salePrice).toFixed(2) }));
      }
    }
  }, [formData.mrp, formData.discount_type, formData.discount_value]);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('name')
      .eq('is_active', true)
      .order('display_order')
      .order('name');

    if (!error && data) {
      const categoryNames = data.map(c => c.name);
      setCategories(categoryNames.length > 0 ? categoryNames : DEFAULT_CATEGORIES);
    }
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to fetch products');
      return;
    }

    setProducts(data || []);
    setLoading(false);
  };

  const handleAddCategory = async () => {
    const trimmedCategory = newCategory.trim();
    if (!trimmedCategory) {
      toast.error('Please enter a category name');
      return;
    }
    if (categories.includes(trimmedCategory)) {
      toast.error('Category already exists');
      return;
    }

    // Save to database
    const { error } = await supabase
      .from('categories')
      .insert({ name: trimmedCategory });

    if (error) {
      if (error.code === '23505') {
        toast.error('Category already exists in database');
      } else {
        toast.error('Failed to create category');
      }
      return;
    }

    setCategories(prev => [...prev, trimmedCategory]);
    setSelectedCategories(prev => [...prev, trimmedCategory]);
    setNewCategory('');
    setCategoryDialogOpen(false);
    toast.success(`Category "${trimmedCategory}" added`);
  };

  const isFoodCategory = (cat: string) => cat.toLowerCase().includes('food');

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      mrp: '',
      unit: 'piece',
      unit_quantity: '1',
      discount_type: 'percentage',
      discount_value: '0',
      commission_rate: '10',
      promoter_code_discount: '5',
      platform_commission: '0',
      category: 'Other',
      product_type: 'default',
      is_active: true,
      is_digital: false,
      is_featured: false,
      is_hot_deal: false,
      stock_quantity: '',
      shipping_charge: '0',
      tax_rate: '0',
      weight_grams: '500',
      available_from: '',
      available_to: ''
    });
    setAvailabilitySlots([]);
    setImageUrls([]);
    setDigitalFileUrl('');
    setDigitalFileName('');
    setEditingProduct(null);
    setSelectedCategories(['Other']);
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      mrp: product.mrp?.toString() || '',
      unit: product.unit || 'piece',
      unit_quantity: product.unit_quantity?.toString() || '1',
      discount_type: product.discount_type || 'percentage',
      discount_value: product.discount_value?.toString() || '0',
      commission_rate: product.commission_rate.toString(),
      promoter_code_discount: product.promoter_code_discount?.toString() || '5',
      platform_commission: (product as any).platform_commission?.toString() || '0',
      category: product.category,
      product_type: (product as any).product_type || 'default',
      is_active: product.is_active,
      is_digital: product.is_digital,
      is_featured: product.is_featured || false,
      is_hot_deal: product.is_hot_deal || false,
      stock_quantity: product.stock_quantity?.toString() || '',
      shipping_charge: product.shipping_charge?.toString() || '0',
      tax_rate: product.tax_rate?.toString() || '0',
      weight_grams: (product as any).weight_grams?.toString() || '500',
      available_from: (product as any).available_from || '',
      available_to: (product as any).available_to || ''
    });
    // Load availability slots
    const slots = (product as any).availability_slots;
    if (Array.isArray(slots) && slots.length > 0) {
      setAvailabilitySlots(slots);
    } else if ((product as any).available_from && (product as any).available_to) {
      setAvailabilitySlots([{ from: (product as any).available_from, to: (product as any).available_to }]);
    } else {
      setAvailabilitySlots([]);
    }
    // Load selected categories from comma-separated category field
    const cats = product.category.split(',').map(c => c.trim()).filter(Boolean);
    setSelectedCategories(cats.length > 0 ? cats : ['Other']);
    setImageUrls(product.image_urls || []);
    setDigitalFileUrl(product.digital_file_url || '');
    if (product.digital_file_url) {
      const fileName = product.digital_file_url.split('/').pop() || 'Digital File';
      setDigitalFileName(fileName);
    }
    setDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newUrls: string[] = [];

    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} is not an image`);
          continue;
        }

        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 5MB)`);
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `products/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, file);

        if (uploadError) {
          toast.error(`Failed to upload ${file.name}`);
          console.error(uploadError);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        newUrls.push(publicUrl);
      }

      if (newUrls.length > 0) {
        setImageUrls(prev => [...prev, ...newUrls]);
        toast.success(`${newUrls.length} image(s) uploaded`);
      }
    } catch (error) {
      toast.error('Upload failed');
      console.error(error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDigitalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error('File is too large (max 50MB)');
      return;
    }

    setUploadingDigital(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `digital/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('digital-products')
        .upload(filePath, file);

      if (uploadError) {
        toast.error('Failed to upload digital file');
        console.error(uploadError);
        return;
      }

      // Store the path (not public URL since bucket is private)
      setDigitalFileUrl(filePath);
      setDigitalFileName(file.name);
      toast.success('Digital file uploaded');
    } catch (error) {
      toast.error('Upload failed');
      console.error(error);
    } finally {
      setUploadingDigital(false);
      if (digitalFileInputRef.current) {
        digitalFileInputRef.current.value = '';
      }
    }
  };

  const removeDigitalFile = () => {
    setDigitalFileUrl('');
    setDigitalFileName('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const productData = {
      name: formData.name,
      description: formData.description || null,
      price: parseFloat(formData.price),
      mrp: formData.mrp ? parseFloat(formData.mrp) : null,
      unit: formData.unit,
      unit_quantity: formData.unit_quantity ? parseFloat(formData.unit_quantity) : 1,
      discount_type: formData.discount_type,
      discount_value: formData.discount_value ? parseFloat(formData.discount_value) : 0,
      commission_rate: parseFloat(formData.commission_rate),
      promoter_code_discount: formData.promoter_code_discount ? parseFloat(formData.promoter_code_discount) : 0,
      platform_commission: formData.platform_commission ? parseFloat(formData.platform_commission) : 0,
      category: selectedCategories.join(', '),
      product_type: formData.product_type,
      image_urls: imageUrls,
      is_active: formData.is_active,
      is_digital: formData.is_digital,
      is_featured: formData.is_featured,
      is_hot_deal: formData.is_hot_deal,
      digital_file_url: formData.is_digital ? digitalFileUrl : null,
      stock_quantity: formData.stock_quantity ? parseInt(formData.stock_quantity) : null,
      shipping_charge: formData.shipping_charge ? parseFloat(formData.shipping_charge) : 0,
      tax_rate: formData.tax_rate ? parseFloat(formData.tax_rate) : 0,
      weight_grams: formData.weight_grams ? parseInt(formData.weight_grams) : 500,
      available_from: availabilitySlots.length > 0 ? availabilitySlots[0].from : (formData.available_from || null),
      available_to: availabilitySlots.length > 0 ? availabilitySlots[0].to : (formData.available_to || null),
      availability_slots: availabilitySlots.length > 0 ? availabilitySlots : null
    };

    if (editingProduct) {
      const { error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', editingProduct.id);

      if (error) {
        toast.error('Failed to update product');
        return;
      }
      toast.success('Product updated');
    } else {
      const { error } = await supabase
        .from('products')
        .insert(productData);

      if (error) {
        toast.error('Failed to create product');
        return;
      }
      toast.success('Product created');
    }

    setDialogOpen(false);
    resetForm();
    fetchProducts();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete product');
      return;
    }

    toast.success('Product deleted');
    fetchProducts();
  };

  const toggleActive = async (product: Product) => {
    const { error } = await supabase
      .from('products')
      .update({ is_active: !product.is_active })
      .eq('id', product.id);

    if (error) {
      toast.error('Failed to update product');
      return;
    }

    fetchProducts();
  };

  if (loading) {
    return <div className="animate-pulse text-muted-foreground p-8">Loading products...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Product Management
          </CardTitle>
          <CardDescription>Create and manage products with commission rates</CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product_type">Product Type</Label>
                  <Select
                    value={formData.product_type}
                    onValueChange={(v) => setFormData({ ...formData, product_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default (Buy Now)</SelectItem>
                      <SelectItem value="custom_order">Custom Order (Form)</SelectItem>
                      <SelectItem value="enquiry">Enquiry (WhatsApp)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {formData.product_type === 'custom_order' && 'Customers fill a form to place custom orders'}
                    {formData.product_type === 'enquiry' && 'Customers enquire via WhatsApp'}
                    {formData.product_type === 'default' && 'Standard buy/cart flow'}
                  </p>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Categories * (select one or more)</Label>
                  <div className="flex gap-2 items-start">
                    <div className="flex-1 border border-input rounded-md p-3 max-h-40 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {categories.map(cat => (
                        <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                          <input
                            type="checkbox"
                            checked={selectedCategories.includes(cat)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCategories(prev => [...prev, cat]);
                              } else {
                                setSelectedCategories(prev => prev.filter(c => c !== cat));
                              }
                            }}
                            className="rounded border-input"
                          />
                          {cat}
                        </label>
                      ))}
                    </div>
                    <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
                      <DialogTrigger asChild>
                        <Button type="button" variant="outline" size="icon">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-sm">
                        <DialogHeader>
                          <DialogTitle>Add New Category</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="newCategory">Category Name</Label>
                            <Input
                              id="newCategory"
                              value={newCategory}
                              onChange={(e) => setNewCategory(e.target.value)}
                              placeholder="e.g., Toys & Games"
                            />
                          </div>
                          <Button type="button" onClick={() => {
                            handleAddCategory();
                          }} className="w-full">
                            Add Category
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  {selectedCategories.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selectedCategories.map(cat => (
                        <Badge key={cat} variant="secondary" className="gap-1">
                          {cat}
                          <button type="button" onClick={() => setSelectedCategories(prev => prev.filter(c => c !== cat))}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              {/* Unit and Quantity Section */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Select
                    value={formData.unit}
                    onValueChange={(v) => setFormData({ ...formData, unit: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map(unit => (
                        <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit_quantity">Unit Quantity</Label>
                  <Input
                    id="unit_quantity"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.unit_quantity}
                    onChange={(e) => setFormData({ ...formData, unit_quantity: e.target.value })}
                    placeholder="e.g., 500 for 500g"
                  />
                </div>
              </div>

              {/* Pricing Section */}
              <div className="p-4 bg-muted/50 rounded-lg space-y-4">
                <h4 className="font-medium">Pricing</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mrp">MRP (₹)</Label>
                    <Input
                      id="mrp"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.mrp}
                      onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
                      placeholder="Original price"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discount_type">Discount Type</Label>
                    <Select
                      value={formData.discount_type}
                      onValueChange={(v) => setFormData({ ...formData, discount_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                        <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="discount_value">
                      Discount {formData.discount_type === 'percentage' ? '(%)' : '(₹)'}
                    </Label>
                    <Input
                      id="discount_value"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.discount_value}
                      onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Sale Price (₹) *</Label>
                    <Input
                      id="price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                      className="font-bold text-primary"
                    />
                    <p className="text-xs text-muted-foreground">Auto-calculated from MRP and discount</p>
                  </div>
                </div>
              </div>

              {/* Promoter Commission Section */}
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  Promoter Code Settings
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="promoter_code_discount">Shopper Discount (%)</Label>
                    <Input
                      id="promoter_code_discount"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={formData.promoter_code_discount}
                      onChange={(e) => setFormData({ ...formData, promoter_code_discount: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Discount shoppers get when using a promoter code</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="commission_rate">Promoter Commission (%) *</Label>
                    <Input
                      id="commission_rate"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={formData.commission_rate}
                      onChange={(e) => setFormData({ ...formData, commission_rate: e.target.value })}
                      required
                    />
                    <p className="text-xs text-muted-foreground">Commission promoters earn when their code is used</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="platform_commission">Platform Commission (%)</Label>
                    <Input
                      id="platform_commission"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={formData.platform_commission}
                      onChange={(e) => setFormData({ ...formData, platform_commission: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Platform's commission from each sale</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stock">Stock Quantity</Label>
                  <Input
                    id="stock"
                    type="number"
                    min="0"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                    placeholder="Leave empty for unlimited"
                  />
                </div>
              </div>

              {/* Shipping and Tax Section */}
              <div className="p-4 bg-muted/50 rounded-lg space-y-4">
                <h4 className="font-medium">Shipping & Tax</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="weight_grams">Weight (grams) *</Label>
                    <Input
                      id="weight_grams"
                      type="number"
                      min="1"
                      step="1"
                      value={formData.weight_grams}
                      onChange={(e) => setFormData({ ...formData, weight_grams: e.target.value })}
                      placeholder="e.g., 500"
                    />
                    <p className="text-xs text-muted-foreground">Used for delivery charge calculation</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shipping_charge">Shipping Charge (₹)</Label>
                    <Input
                      id="shipping_charge"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.shipping_charge}
                      onChange={(e) => setFormData({ ...formData, shipping_charge: e.target.value })}
                      placeholder="0 for free shipping"
                    />
                    <p className="text-xs text-muted-foreground">Enter 0 for free shipping</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tax_rate">Tax Rate (%)</Label>
                    <Input
                      id="tax_rate"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={formData.tax_rate}
                      onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
                      placeholder="e.g., 18 for 18% GST"
                    />
                    <p className="text-xs text-muted-foreground">GST or applicable tax percentage</p>
                  </div>
                </div>
              </div>

              {/* Image Upload Section with Drag & Drop */}
              <ImageUploadSection
                imageUrls={imageUrls}
                setImageUrls={setImageUrls}
                uploading={uploading}
                setUploading={setUploading}
                fileInputRef={fileInputRef}
                handleImageUpload={handleImageUpload}
              />

              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_digital"
                    checked={formData.is_digital}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_digital: checked })}
                  />
                  <Label htmlFor="is_digital">Digital Product</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_featured"
                    checked={formData.is_featured}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })}
                  />
                  <Label htmlFor="is_featured">⭐ Featured</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_hot_deal"
                    checked={formData.is_hot_deal}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_hot_deal: checked })}
                  />
                  <Label htmlFor="is_hot_deal">🔥 Hot Deal</Label>
                </div>
              </div>

              {/* Food Availability Time Slots */}
              {isFoodCategory(formData.category) && (
                <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg space-y-4">
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
                      <Plus className="h-3 w-3 mr-1" />
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
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Digital File Upload Section */}
              {formData.is_digital && (
                <div className="p-4 bg-info/10 border border-info/20 rounded-lg space-y-3">
                  <Label className="flex items-center gap-2">
                    <FileUp className="h-4 w-4" />
                    Digital Product File
                  </Label>
                  
                  {digitalFileUrl ? (
                    <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
                      <File className="h-8 w-8 text-info" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{digitalFileName}</p>
                        <p className="text-xs text-muted-foreground">File uploaded and ready for delivery</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={removeDigitalFile}
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <input
                        ref={digitalFileInputRef}
                        type="file"
                        onChange={handleDigitalFileUpload}
                        className="hidden"
                        id="digital-file-upload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => digitalFileInputRef.current?.click()}
                        disabled={uploadingDigital}
                        className="gap-2"
                      >
                        {uploadingDigital ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileUp className="h-4 w-4" />
                        )}
                        {uploadingDigital ? 'Uploading...' : 'Upload Digital File'}
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Max 50MB. This file will be sent to buyers after purchase.
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingProduct ? 'Update Product' : 'Create Product'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {/* Bulk Actions */}
        <div className="mb-4">
          <ProductBulkActions products={products} onRefresh={fetchProducts} showVendorAssign={true} />
        </div>
        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={productSearchQuery}
              onChange={(e) => setProductSearchQuery(e.target.value)}
              className="pl-9 max-w-sm"
            />
          </div>
          <Select value={productCategoryFilter} onValueChange={setProductCategoryFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={productStatusFilter} onValueChange={setProductStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No products yet. Create your first product to get started.</p>
          </div>
        ) : (() => {
          const filteredProducts = products.filter(p => {
            const matchesSearch = !productSearchQuery || 
              p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
              p.category.toLowerCase().includes(productSearchQuery.toLowerCase());
            const matchesCategory = productCategoryFilter === 'all' || 
              p.category.split(',').map(c => c.trim()).includes(productCategoryFilter);
            const matchesStatus = productStatusFilter === 'all' ||
              (productStatusFilter === 'active' ? p.is_active : !p.is_active);
            return matchesSearch && matchesCategory && matchesStatus;
          });
          
          return filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No products match your filters.</div>
          ) : (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>MRP / Price</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {product.image_urls && product.image_urls.length > 0 ? (
                        <div className="relative">
                          <img
                            src={product.image_urls[0]}
                            alt={product.name}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                          {product.image_urls.length > 1 && (
                            <span className="absolute -bottom-1 -right-1 bg-muted text-muted-foreground text-xs px-1 rounded">
                              +{product.image_urls.length - 1}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                          <Image className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {product.unit_quantity} {product.unit}
                          {product.is_digital && <Badge variant="outline" className="ml-2 text-xs">Digital</Badge>}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{product.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      {product.mrp && product.mrp > product.price && (
                        <span className="text-sm text-muted-foreground line-through mr-2">
                          ₹{product.mrp.toLocaleString()}
                        </span>
                      )}
                      <span className="font-medium">₹{product.price.toLocaleString()}</span>
                      {product.discount_value && product.discount_value > 0 && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {product.discount_type === 'percentage' 
                            ? `${product.discount_value}% off` 
                            : `₹${product.discount_value} off`}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-earnings">
                      <Percent className="h-3 w-3" />
                      {product.commission_rate}%
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {product.is_featured && <Badge className="text-xs bg-primary/20 text-primary border-primary/30">⭐ Featured</Badge>}
                      {product.is_hot_deal && <Badge className="text-xs bg-destructive/20 text-destructive border-destructive/30">🔥 Hot Deal</Badge>}
                      {!product.is_featured && !product.is_hot_deal && <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={product.is_active}
                      onCheckedChange={() => toggleActive(product)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditDialog(product)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(product.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}