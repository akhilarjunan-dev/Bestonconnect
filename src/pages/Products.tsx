import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header, Footer } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, SlidersHorizontal, X, ShoppingCart, Zap, Star, MapPin, Clock } from "lucide-react";
import { ProductGridSkeleton } from "@/components/skeletons/ProductCardSkeleton";
import { FadeIn } from "@/components/skeletons/FadeIn";
import { toast } from "sonner";
import { useCart } from "@/hooks/useCart";
import { useDeliveryCoverage } from "@/hooks/useDeliveryCoverage";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  mrp: number | null;
  category: string;
  image_urls: string[] | null;
  is_digital: boolean;
  commission_rate: number;
  stock_quantity: number | null;
  vendor_id: string | null;
  available_from: string | null;
  available_to: string | null;
  availability_slots: { from: string; to: string }[] | null;
  vendor_name?: string | null;
}

export default function Products() {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isProductAvailable, getVendorDeliveryType } = useDeliveryCoverage();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showPromoterView, setShowPromoterView] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, description, price, mrp, category, image_urls, is_digital, commission_rate, stock_quantity, vendor_id, available_from, available_to, availability_slots')
      .eq('is_active', true)
      .order('name');

    if (error) {
      toast.error('Failed to load products');
      setLoading(false);
      return;
    }

    // Fetch vendor names separately to avoid RLS issues for anonymous users
    const vendorIds = [...new Set((data || []).map(p => p.vendor_id).filter(Boolean))];
    let vendorMap: Record<string, string> = {};
    if (vendorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', vendorIds);
      if (profiles) {
        vendorMap = Object.fromEntries(
          profiles.map(p => [p.id, p.full_name?.split(' ')[0] || ''])
        );
      }
    }

    const productsWithVendor = (data || []).map((p: any) => ({
      ...p,
      vendor_name: p.vendor_id ? vendorMap[p.vendor_id] || null : null,
    }));

    setProducts(productsWithVendor);
    
    // Extract unique categories
    const uniqueCategories = [...new Set(productsWithVendor.map((p: Product) => p.category))];
    setCategories(uniqueCategories);
    setLoading(false);
  };

  const isTimeAvailable = (product: Product) => {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const slots = product.availability_slots as { from: string; to: string }[] | null;
    if (slots && slots.length > 0) {
      return slots.some(slot => currentTime >= slot.from.slice(0, 5) && currentTime <= slot.to.slice(0, 5));
    }
    if (!product.available_from || !product.available_to) return true;
    return currentTime >= product.available_from.slice(0, 5) && currentTime <= product.available_to.slice(0, 5);
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesCategory = selectedCategory === "All" || product.category === selectedCategory;
    const matchesTime = isTimeAvailable(product);
    return matchesSearch && matchesCategory && matchesTime;
  });

  const handleAddToCart = (product: Product) => {
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image_urls: product.image_urls,
      is_digital: product.is_digital || false,
      commission_rate: product.commission_rate,
    });
    toast.success(`${product.name} added to cart`);
  };

  const handleViewProduct = (productId: string) => {
    navigate(`/product/${productId}`);
  };

  const getDiscount = (price: number, mrp: number | null) => {
    if (!mrp || mrp <= price) return 0;
    return Math.round(((mrp - price) / mrp) * 100);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="border-b border-border bg-gradient-to-br from-muted to-background py-12">
          <div className="container">
            <div className="max-w-2xl mx-auto text-center space-y-4">
              <h1 className="text-3xl md:text-4xl font-bold font-display text-foreground">
                Discover Amazing Products
              </h1>
              <p className="text-muted-foreground">
                Browse our curated collection of quality products from trusted brands
              </p>
            </div>

            {/* Search */}
            <div className="max-w-xl mx-auto mt-8">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-12 rounded-2xl bg-card border-border"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Filters & Products */}
        <section className="container py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            {/* Categories */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === "All" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory("All")}
              >
                All
              </Button>
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Button>
              ))}
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-3">
              <Button
                variant={showPromoterView ? "hero" : "outline"}
                size="sm"
                onClick={() => setShowPromoterView(!showPromoterView)}
                className="gap-2"
              >
                {showPromoterView ? "Promoter View" : "Buyer View"}
              </Button>
              <Button variant="outline" size="icon">
                <SlidersHorizontal className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Results Count */}
          <div className="flex items-center gap-2 mb-6">
            <Badge variant="glass">{filteredProducts.length} products</Badge>
            {selectedCategory !== "All" && (
              <Badge variant="secondary" className="gap-1">
                {selectedCategory}
                <button onClick={() => setSelectedCategory("All")}>
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
          </div>

          {loading ? (
            <ProductGridSkeleton count={8} />
          ) : (
            <>
              {/* Products Grid */}
              <FadeIn>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                {filteredProducts.map((product) => {
                  const discount = getDiscount(product.price, product.mrp);
                  const inStock = product.stock_quantity === null || product.stock_quantity > 0;
                  const available = isProductAvailable(product.vendor_id);
                  
                  return (
                    <Card key={product.id} variant="interactive" className={`overflow-hidden group ${!available ? 'opacity-60 grayscale' : ''}`}>
                      <div 
                        className="relative aspect-square overflow-hidden bg-muted cursor-pointer"
                        onClick={() => handleViewProduct(product.id)}
                      >
                        <img
                          src={product.image_urls?.[0] || 'https://via.placeholder.com/400'}
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        {discount > 0 && (
                          <Badge variant="destructive" className="absolute top-3 left-3">
                            -{discount}%
                          </Badge>
                        )}
                        {product.is_digital && (
                          <Badge variant="info" className="absolute top-3 right-3">
                            Digital
                          </Badge>
                        )}
                        {!available && (
                          <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-10">
                            <Badge variant="secondary" className="text-sm px-3 py-1">
                              <MapPin className="h-3 w-3 mr-1" />
                              Not in your area
                            </Badge>
                          </div>
                        )}
                      </div>

                      <CardHeader className="pb-2">
                        <div className="space-y-1">
                          {product.vendor_name && (
                            <p className="text-xs font-medium text-primary">
                              {product.vendor_name}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">
                            {product.category}
                          </p>
                          <CardTitle 
                            className="text-base line-clamp-2 cursor-pointer hover:text-primary"
                            onClick={() => handleViewProduct(product.id)}
                          >
                            {product.name}
                          </CardTitle>
                          {product.available_from && product.available_to && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Clock className="h-3 w-3" />
                              {product.available_from.slice(0, 5)} - {product.available_to.slice(0, 5)}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xl font-bold font-display text-foreground">
                            ₹{product.price.toFixed(2)}
                          </span>
                          {product.mrp && product.mrp > product.price && (
                            <span className="text-sm text-muted-foreground line-through">
                              ₹{product.mrp.toFixed(2)}
                            </span>
                          )}
                        </div>

                        {showPromoterView && (
                          <div className="flex items-center gap-2 p-2 rounded-lg bg-earnings/10 border border-earnings/20">
                            <Zap className="w-4 h-4 text-earnings" />
                            <span className="text-sm font-medium text-earnings">
                              {product.commission_rate}% Commission
                            </span>
                          </div>
                        )}

                        <div className="flex gap-2">
                          {showPromoterView ? (
                            <Button 
                              variant="earnings" 
                              className="w-full gap-2"
                              onClick={() => navigate('/promoter/links')}
                            >
                              <Zap className="w-4 h-4" />
                              Get Link
                            </Button>
                          ) : (
                            <Button 
                              variant="default" 
                              className="w-full gap-2"
                              onClick={() => handleAddToCart(product)}
                              disabled={!inStock || !available}
                            >
                              <ShoppingCart className="w-4 h-4" />
                              {!available ? "Unavailable" : inStock ? "Add to Cart" : "Out of Stock"}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              </FadeIn>

              {filteredProducts.length === 0 && (
                <div className="text-center py-16">
                  <p className="text-muted-foreground">No products found matching your criteria.</p>
                  <Button 
                    variant="link" 
                    onClick={() => { setSearchQuery(""); setSelectedCategory("All"); }}
                  >
                    Clear filters
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
