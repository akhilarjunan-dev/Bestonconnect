import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Image, Plus, Edit2, Trash2, ArrowUp, ArrowDown, Upload, Loader2, Video, LayoutTemplate } from 'lucide-react';

interface Banner {
  id: string;
  title: string;
  image_url: string;
  link_type: 'product' | 'category' | 'external';
  link_value: string;
  is_active: boolean;
  display_order: number;
  position: 'top' | 'center';
  media_type: 'image' | 'video';
}

interface Product {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

export function BannerManagement() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: '',
    image_url: '',
    link_type: 'product' as 'product' | 'category' | 'external',
    link_value: '',
    is_active: true,
    position: 'top' as 'top' | 'center',
    media_type: 'image' as 'image' | 'video',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [bannersRes, productsRes, categoriesRes] = await Promise.all([
      supabase.from('banners').select('*').order('display_order'),
      supabase.from('products').select('id, name').eq('is_active', true).order('name'),
      supabase.from('categories').select('id, name').eq('is_active', true).order('name')
    ]);

    if (!bannersRes.error) setBanners(bannersRes.data as Banner[]);
    if (!productsRes.error) setProducts(productsRes.data || []);
    if (!categoriesRes.error) setCategories(categoriesRes.data || []);
    setLoading(false);
  };

  const handleOpenDialog = (banner?: Banner) => {
    if (banner) {
      setEditingBanner(banner);
      setForm({
        title: banner.title,
        image_url: banner.image_url,
        link_type: banner.link_type,
        link_value: banner.link_value,
        is_active: banner.is_active,
        position: banner.position || 'top',
        media_type: banner.media_type || 'image',
      });
    } else {
      setEditingBanner(null);
      setForm({
        title: '',
        image_url: '',
        link_type: 'product',
        link_value: '',
        is_active: true,
        position: 'top',
        media_type: 'image',
      });
    }
    setDialogOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024; // 50MB video, 10MB image

    if (file.size > maxSize) {
      toast.error(`File too large. Max ${isVideo ? '50MB' : '10MB'}.`);
      return;
    }

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `banner_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, file);

    if (uploadError) {
      toast.error('Failed to upload file');
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);

    setForm({ ...form, image_url: publicUrl, media_type: isVideo ? 'video' : 'image' });
    setUploading(false);
    toast.success(`${isVideo ? 'Video' : 'Image'} uploaded`);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.image_url.trim() || !form.link_value.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setSaving(true);

    const bannerData = {
      title: form.title,
      image_url: form.image_url,
      link_type: form.link_type,
      link_value: form.link_value,
      is_active: form.is_active,
      position: form.position,
      media_type: form.media_type,
    };

    if (editingBanner) {
      const { error } = await supabase
        .from('banners')
        .update(bannerData)
        .eq('id', editingBanner.id);

      if (error) {
        toast.error('Failed to update banner');
      } else {
        toast.success('Banner updated');
        setDialogOpen(false);
        fetchData();
      }
    } else {
      const maxOrder = banners.length > 0 ? Math.max(...banners.map(b => b.display_order)) + 1 : 0;
      
      const { error } = await supabase
        .from('banners')
        .insert({ ...bannerData, display_order: maxOrder });

      if (error) {
        toast.error('Failed to create banner');
      } else {
        toast.success('Banner created');
        setDialogOpen(false);
        fetchData();
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this banner?')) return;

    const { error } = await supabase.from('banners').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete banner');
    } else {
      toast.success('Banner deleted');
      fetchData();
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from('banners')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update banner');
    } else {
      fetchData();
    }
  };

  const handleMoveOrder = async (id: string, direction: 'up' | 'down') => {
    const idx = banners.findIndex(b => b.id === id);
    if (idx === -1) return;
    
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= banners.length) return;

    const currentOrder = banners[idx].display_order;
    const swapOrder = banners[swapIdx].display_order;

    await Promise.all([
      supabase.from('banners').update({ display_order: swapOrder }).eq('id', banners[idx].id),
      supabase.from('banners').update({ display_order: currentOrder }).eq('id', banners[swapIdx].id)
    ]);

    fetchData();
  };

  const getLinkDisplay = (banner: Banner) => {
    if (banner.link_type === 'product') {
      const product = products.find(p => p.id === banner.link_value);
      return product?.name || 'Unknown Product';
    }
    if (banner.link_type === 'category') {
      return banner.link_value;
    }
    return banner.link_value;
  };

  const topBanners = banners.filter(b => b.position === 'top' || !b.position);
  const centerBanners = banners.filter(b => b.position === 'center');

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading banners...</div>;
  }

  const renderBannerTable = (bannerList: Banner[], label: string) => (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <LayoutTemplate className="h-4 w-4 text-primary" />
        {label} ({bannerList.length})
      </h3>
      {bannerList.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No {label.toLowerCase()} yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Preview</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Links To</TableHead>
              <TableHead>Media</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bannerList.map((banner, idx) => (
              <TableRow key={banner.id}>
                <TableCell>
                  {banner.media_type === 'video' ? (
                    <video src={banner.image_url} className="w-20 h-12 object-cover rounded" muted />
                  ) : (
                    <img src={banner.image_url} alt={banner.title} className="w-20 h-12 object-cover rounded" />
                  )}
                </TableCell>
                <TableCell className="font-medium">{banner.title}</TableCell>
                <TableCell>
                  <Badge variant="outline">{banner.link_type}</Badge>
                </TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {getLinkDisplay(banner)}
                </TableCell>
                <TableCell>
                  <Badge variant={banner.media_type === 'video' ? 'secondary' : 'outline'}>
                    {banner.media_type === 'video' ? '🎥 Video' : '🖼️ Image'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={banner.is_active}
                    onCheckedChange={(checked) => handleToggleActive(banner.id, checked)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" disabled={idx === 0} onClick={() => handleMoveOrder(banner.id, 'up')}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" disabled={idx === bannerList.length - 1} onClick={() => handleMoveOrder(banner.id, 'down')}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(banner)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(banner.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5 text-primary" />
              Banner Management
            </CardTitle>
            <CardDescription>Create banners/posters for the home screen — images or videos</CardDescription>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Banner
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {renderBannerTable(topBanners, 'Top Banners (Hero Area)')}
        {renderBannerTable(centerBanners, 'Center Banners (Product Area)')}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingBanner ? 'Edit Banner' : 'Create Banner'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Banner title"
                />
              </div>

              {/* Position Selector */}
              <div className="space-y-2">
                <Label>Banner Position</Label>
                <Select
                  value={form.position}
                  onValueChange={(v) => setForm({ ...form, position: v as 'top' | 'center' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top">🔝 Top of Home Screen (Hero)</SelectItem>
                    <SelectItem value="center">📍 Center of Page (Product Area)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {form.position === 'top'
                    ? 'This banner will appear at the very top of the home screen as a hero banner.'
                    : 'This banner will appear in the middle of the product listing area.'}
                </p>
              </div>

              {/* Media Upload */}
              <div className="space-y-2">
                <Label>Banner Media (Image or Video)</Label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*,video/mp4,video/webm,video/quicktime"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex-1"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Image / Video
                      </>
                    )}
                  </Button>
                </div>
                {form.image_url && (
                  <div className="mt-2">
                    {form.media_type === 'video' ? (
                      <video
                        src={form.image_url}
                        controls
                        className="w-full h-32 object-cover rounded"
                      />
                    ) : (
                      <img
                        src={form.image_url}
                        alt="Preview"
                        className="w-full h-32 object-cover rounded"
                      />
                    )}
                    <Badge variant="secondary" className="mt-1">
                      {form.media_type === 'video' ? '🎥 Video' : '🖼️ Image'}
                    </Badge>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Link Type</Label>
                <Select
                  value={form.link_type}
                  onValueChange={(v) => setForm({ ...form, link_type: v as any, link_value: '' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">Product</SelectItem>
                    <SelectItem value="category">Category</SelectItem>
                    <SelectItem value="external">External URL</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>
                  {form.link_type === 'product' ? 'Select Product' : 
                   form.link_type === 'category' ? 'Select Category' : 'External URL'}
                </Label>
                {form.link_type === 'product' ? (
                  <Select
                    value={form.link_value}
                    onValueChange={(v) => setForm({ ...form, link_value: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : form.link_type === 'category' ? (
                  <Select
                    value={form.link_value}
                    onValueChange={(v) => setForm({ ...form, link_value: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(c => (
                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={form.link_value}
                    onChange={(e) => setForm({ ...form, link_value: e.target.value })}
                    placeholder="https://example.com"
                  />
                )}
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                />
                <Label>Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
