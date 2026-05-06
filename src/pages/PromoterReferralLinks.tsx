import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { PromoterNavFooter } from '@/components/navigation/PromoterNavFooter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ReferralAnalytics } from '@/components/promoter/ReferralAnalytics';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { 
  Link as LinkIcon, Copy, Share2, ExternalLink, MousePointerClick, 
  TrendingUp, Percent, Search, BarChart3, Loader2, Package, Tag
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  commission_rate: number;
  promoter_code_discount: number | null;
  image_urls: string[] | null;
}

export default function PromoterReferralLinks() {
  const { user, hasRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [promoterTier, setPromoterTier] = useState<'free' | 'premium'>('free');
  const [promoterCode, setPromoterCode] = useState<string>('');
  const [stats, setStats] = useState({ totalClicks: 0, totalConversions: 0 });

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
    setLoading(true);
    await Promise.all([fetchPromoterData(), fetchProducts()]);
    setLoading(false);
  };

  const generateNameBasedCode = (name: string): string => {
    // Remove special chars, spaces, make uppercase
    const slug = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    // Use first 12 chars, minimum 3
    return slug.length >= 3 ? slug.substring(0, 12) : slug + user!.id.substring(0, 8 - slug.length).toUpperCase();
  };

  const fetchPromoterData = async () => {
    if (!user) return;
    
    // Fetch profile for tier and name
    const { data: profile } = await supabase
      .from('profiles')
      .select('promoter_tier, full_name')
      .eq('id', user.id)
      .maybeSingle();
    
    if (profile?.promoter_tier) {
      setPromoterTier(profile.promoter_tier as 'free' | 'premium');
    }

    // Check if promoter already has a referral link
    const { data: existingLink } = await supabase
      .from('referral_links')
      .select('id, link_code')
      .eq('promoter_id', user.id)
      .is('product_id', null)
      .maybeSingle();

    if (existingLink) {
      setPromoterCode(existingLink.link_code);
    } else {
      // Generate name-based code, fallback to UUID
      const baseName = profile?.full_name?.trim();
      const code = baseName ? generateNameBasedCode(baseName) : user.id.substring(0, 8).toUpperCase();
      
      // Ensure uniqueness
      const uniqueCode = await ensureUniqueCode(code);
      setPromoterCode(uniqueCode);

      // Create the generic promoter code link
      await supabase.from('referral_links').insert({
        promoter_id: user.id,
        link_code: uniqueCode,
        product_id: null,
      });
    }

    // Fetch stats from referral_links
    const { data: linkData } = await supabase
      .from('referral_links')
      .select('clicks, conversions')
      .eq('promoter_id', user.id)
      .is('product_id', null)
      .maybeSingle();

    if (linkData) {
      setStats({
        totalClicks: linkData.clicks || 0,
        totalConversions: linkData.conversions || 0,
      });
    }
  };

  const ensureUniqueCode = async (baseCode: string): Promise<string> => {
    let code = baseCode;
    let attempt = 0;
    while (true) {
      const { data } = await supabase
        .from('referral_links')
        .select('id')
        .ilike('link_code', code)
        .maybeSingle();
      
      if (!data) return code;
      attempt++;
      code = `${baseCode}${attempt}`;
    }
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, price, commission_rate, promoter_code_discount, image_urls')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      toast.error('Failed to fetch products');
      return;
    }
    setProducts(data || []);
  };

  const buildProductUrl = (productId: string) => {
    return `${window.location.origin}/r/${promoterCode}?product=${productId}`;
  };

  const fallbackCopy = (text: string) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      return false;
    }
  };

  const safeCopy = async (text: string, successMsg: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        fallbackCopy(text);
      }
      toast.success(successMsg);
    } catch {
      if (fallbackCopy(text)) {
        toast.success(successMsg);
      } else {
        toast.error('Copy failed. Please copy manually: ' + text);
      }
    }
  };

  const copyProductLink = (productId: string) => {
    safeCopy(buildProductUrl(productId), 'Product link copied!');
  };

  const copyPromoterCode = () => {
    safeCopy(promoterCode, 'Your unique promoter code copied!');
  };

  const shareProductLink = async (product: Product) => {
    const url = buildProductUrl(product.id);
    const discountText = promoterTier === 'premium' && product.promoter_code_discount 
      ? ` Use my code "${promoterCode}" for ${product.promoter_code_discount}% off!`
      : ` Use my code "${promoterCode}" at checkout!`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: `Check out ${product.name}!${discountText}`,
          url,
        });
      } catch {
        copyProductLink(product.id);
      }
    } else {
      copyProductLink(product.id);
    }
  };

  const sharePromoterCode = async () => {
    const text = promoterTier === 'premium'
      ? `Use my promoter code "${promoterCode}" for discounts on your purchase!`
      : `Use my promoter code "${promoterCode}" when you shop!`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Promoter Code',
          text,
        });
      } catch {
        copyPromoterCode();
      }
    } else {
      copyPromoterCode();
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const avgConversionRate = stats.totalClicks > 0 
    ? ((stats.totalConversions / stats.totalClicks) * 100).toFixed(1) 
    : '0.0';

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4 pb-24">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <LinkIcon className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold font-display">Product Links</h1>
              <p className="text-muted-foreground text-sm">Share products with your unique code</p>
            </div>
          </div>
        </div>

        {/* Your Unique Promoter Code */}
        <Card className="mb-6 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary" />
              Your Unique Promoter Code
            </CardTitle>
            <CardDescription>
              This code works for ALL products. Share it with shoppers to earn commissions!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <code className="flex-1 px-4 py-3 rounded-lg bg-background border-2 border-primary/30 text-xl font-bold text-center tracking-widest text-primary">
                {promoterCode}
              </code>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 sm:flex-none gap-2" onClick={copyPromoterCode}>
                  <Copy className="w-4 h-4" />
                  Copy Code
                </Button>
                <Button className="flex-1 sm:flex-none gap-2" onClick={sharePromoterCode}>
                  <Share2 className="w-4 h-4" />
                  Share
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              {promoterTier === 'premium' 
                ? '✨ Premium: Shoppers get discounts when using your code!' 
                : 'ℹ️ Free tier: Your code tracks sales for commission (no shopper discount)'}
            </p>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <MousePointerClick className="h-5 w-5 text-info" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalClicks}</p>
                  <p className="text-sm text-muted-foreground">Total Clicks</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-earnings" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalConversions}</p>
                  <p className="text-sm text-muted-foreground">Conversions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-surge" />
                <div>
                  <p className="text-2xl font-bold">{avgConversionRate}%</p>
                  <p className="text-sm text-muted-foreground">CVR</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Products Table */}
        <Card>
          <CardHeader>
            <CardTitle>Products</CardTitle>
            <CardDescription>Copy product-specific links using your unique code</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredProducts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No products found</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-center">Commission</TableHead>
                      <TableHead className="text-center">Discount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {product.image_urls?.[0] ? (
                              <img
                                src={product.image_urls[0]}
                                alt={product.name}
                                className="w-10 h-10 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                <Package className="w-5 h-5 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium line-clamp-1">{product.name}</p>
                              <p className="text-sm text-muted-foreground">₹{product.price.toLocaleString()}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-earnings/10 text-earnings border-earnings/30">
                            <Percent className="w-3 h-3 mr-1" />
                            {product.commission_rate}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {product.promoter_code_discount && promoterTier === 'premium' ? (
                            <Badge variant="secondary" className="bg-primary/10 text-primary">
                              {product.promoter_code_discount}% off
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => copyProductLink(product.id)}
                              title="Copy product link"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => shareProductLink(product)}
                              title="Share product link"
                            >
                              <Share2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => window.open(buildProductUrl(product.id), '_blank')}
                              title="Open link"
                            >
                              <ExternalLink className="w-4 h-4" />
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
        </Card>

        {/* Analytics Section */}
        {user && (
          <ReferralAnalytics userId={user.id} referralLinks={[]} />
        )}
      </div>
      <PromoterNavFooter />
    </Layout>
  );
}
