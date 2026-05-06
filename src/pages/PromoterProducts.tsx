import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { PromoterNavFooter } from '@/components/navigation/PromoterNavFooter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ImageGallery } from '@/components/ui/image-gallery';
import { toast } from 'sonner';
import { 
  Package, Search, Link as LinkIcon, Copy, Share2, 
  ExternalLink, Percent, TrendingUp, MousePointerClick 
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  commission_rate: number;
  category: string;
  image_urls: string[] | null;
  is_digital: boolean;
}

interface ReferralLink {
  id: string;
  product_id: string | null;
  link_code: string;
  clicks: number;
  conversions: number;
}

const CATEGORIES = [
  'All Categories',
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

export default function PromoterProducts() {
  const { user, hasRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [referralLinks, setReferralLinks] = useState<ReferralLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || !hasRole('promoter'))) {
      navigate('/');
      return;
    }
    if (user && hasRole('promoter')) {
      fetchData();
    }
  }, [user, authLoading, hasRole, navigate]);

  const fetchData = async () => {
    await Promise.all([fetchProducts(), fetchReferralLinks()]);
    setLoading(false);
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, description, price, commission_rate, category, image_urls, is_digital')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      toast.error('Failed to fetch products');
      return;
    }

    setProducts(data || []);
  };

  const fetchReferralLinks = async () => {
    const { data, error } = await supabase
      .from('referral_links')
      .select('*')
      .eq('promoter_id', user?.id);

    if (error) {
      toast.error('Failed to fetch referral links');
      return;
    }

    setReferralLinks(data || []);
  };

  const generateLinkCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleGenerateLink = async (product: Product) => {
    // Check if link already exists for this product
    const existingLink = referralLinks.find(l => l.product_id === product.id);
    
    if (existingLink) {
      const linkUrl = `${window.location.origin}/shop?ref=${existingLink.link_code}`;
      setGeneratedLink(linkUrl);
      setSelectedProduct(product);
      setDialogOpen(true);
      return;
    }

    const linkCode = generateLinkCode();
    
    const { error } = await supabase
      .from('referral_links')
      .insert({
        promoter_id: user?.id,
        product_id: product.id,
        link_code: linkCode
      });

    if (error) {
      toast.error('Failed to generate link');
      return;
    }

    const linkUrl = `${window.location.origin}/shop?ref=${linkCode}`;
    setGeneratedLink(linkUrl);
    setSelectedProduct(product);
    setDialogOpen(true);
    
    // Refresh links
    fetchReferralLinks();
    toast.success('Referral link generated!');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Link copied to clipboard!');
  };

  const shareLink = async (url: string, productName: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: productName,
          text: `Check out this product: ${productName}`,
          url: url
        });
      } catch (err) {
        copyToClipboard(url);
      }
    } else {
      copyToClipboard(url);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.description?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'All Categories' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getLinkStats = (productId: string) => {
    return referralLinks.find(l => l.product_id === productId);
  };

  const getProductImage = (product: Product) => {
    return product.image_urls && product.image_urls.length > 0 ? product.image_urls[0] : null;
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-xl bg-primary/10">
            <Package className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-display">Products</h1>
            <p className="text-muted-foreground">Browse products and generate referral links</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{products.length}</p>
                  <p className="text-sm text-muted-foreground">Products</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <LinkIcon className="h-5 w-5 text-earnings" />
                <div>
                  <p className="text-2xl font-bold">{referralLinks.length}</p>
                  <p className="text-sm text-muted-foreground">My Links</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <MousePointerClick className="h-5 w-5 text-info" />
                <div>
                  <p className="text-2xl font-bold">
                    {referralLinks.reduce((sum, l) => sum + (l.clicks || 0), 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Clicks</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-surge" />
                <div>
                  <p className="text-2xl font-bold">
                    {referralLinks.reduce((sum, l) => sum + (l.conversions || 0), 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Conversions</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No products found matching your criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => {
              const linkStats = getLinkStats(product.id);
              return (
                <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="relative bg-muted">
                    {product.image_urls && product.image_urls.length > 0 ? (
                      <ImageGallery
                        images={product.image_urls}
                        alt={product.name}
                        className="p-0"
                        thumbnailClassName="px-2 pb-2"
                      />
                    ) : (
                      <div className="aspect-square w-full flex items-center justify-center">
                        <Package className="h-16 w-16 text-muted-foreground/30" />
                      </div>
                    )}
                    {product.is_digital && (
                      <Badge className="absolute top-2 right-2 bg-info z-10">Digital</Badge>
                    )}
                    <div className="absolute bottom-2 left-2 z-10">
                      <Badge variant="secondary" className="bg-earnings/90 text-earnings-foreground">
                        <Percent className="h-3 w-3 mr-1" />
                        {product.commission_rate}% commission
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="mb-2">
                      <Badge variant="outline" className="text-xs">{product.category}</Badge>
                    </div>
                    <h3 className="font-semibold text-lg mb-1 line-clamp-1">{product.name}</h3>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {product.description || 'No description available'}
                    </p>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xl font-bold">₹{product.price.toLocaleString()}</span>
                      <span className="text-sm text-earnings font-medium">
                        Earn ₹{Math.round(product.price * product.commission_rate / 100).toLocaleString()}
                      </span>
                    </div>
                    
                    {linkStats && (
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3 p-2 bg-muted/50 rounded-lg">
                        <span className="flex items-center gap-1">
                          <MousePointerClick className="h-3 w-3" />
                          {linkStats.clicks} clicks
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {linkStats.conversions} sales
                        </span>
                      </div>
                    )}
                    
                    <Button 
                      className="w-full gap-2" 
                      onClick={() => handleGenerateLink(product)}
                    >
                      <LinkIcon className="h-4 w-4" />
                      {linkStats ? 'View Link' : 'Get Referral Link'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Link Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Your Referral Link</DialogTitle>
              <DialogDescription>
                Share this link to earn commission on sales of {selectedProduct?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {selectedProduct && (
                <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                  {getProductImage(selectedProduct) ? (
                    <img
                      src={getProductImage(selectedProduct)!}
                      alt={selectedProduct.name}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                      <Package className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <h4 className="font-semibold">{selectedProduct.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      ₹{selectedProduct.price.toLocaleString()} · {selectedProduct.commission_rate}% commission
                    </p>
                    <p className="text-sm text-earnings font-medium">
                      Potential earning: ₹{Math.round(selectedProduct.price * selectedProduct.commission_rate / 100).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Referral Link</label>
                <div className="flex gap-2">
                  <Input
                    value={generatedLink || ''}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => generatedLink && copyToClipboard(generatedLink)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  className="flex-1 gap-2"
                  onClick={() => generatedLink && selectedProduct && shareLink(generatedLink, selectedProduct.name)}
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 gap-2"
                  onClick={() => generatedLink && window.open(generatedLink, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                  Preview
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <PromoterNavFooter />
    </Layout>
  );
}
