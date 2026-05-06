import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Heart, Star, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  rating: number;
  reviews: number;
  commission: number;
  isDigital?: boolean;
  inStock: boolean;
}

interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product) => void;
  onPromote?: (product: Product) => void;
  showPromoterActions?: boolean;
  className?: string;
}

export function ProductCard({ 
  product, 
  onAddToCart, 
  onPromote,
  showPromoterActions = false,
  className 
}: ProductCardProps) {
  const discount = product.originalPrice 
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  return (
    <Card variant="interactive" className={cn("overflow-hidden group", className)}>
      <div className="relative aspect-square overflow-hidden bg-muted">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {discount > 0 && (
          <Badge variant="destructive" className="absolute top-3 left-3">
            -{discount}%
          </Badge>
        )}
        {product.isDigital && (
          <Badge variant="info" className="absolute top-3 right-3">
            Digital
          </Badge>
        )}
        <button className="absolute top-3 right-3 p-2 rounded-full bg-card/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-card hover:scale-110">
          <Heart className="w-4 h-4 text-foreground" />
        </button>
      </div>

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {product.category}
            </p>
            <CardTitle className="text-base line-clamp-2">{product.name}</CardTitle>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 fill-warning text-warning" />
            <span className="text-sm font-medium">{product.rating}</span>
          </div>
          <span className="text-xs text-muted-foreground">
            ({product.reviews} reviews)
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold font-display text-foreground">
            ${product.price.toFixed(2)}
          </span>
          {product.originalPrice && (
            <span className="text-sm text-muted-foreground line-through">
              ${product.originalPrice.toFixed(2)}
            </span>
          )}
        </div>

        {showPromoterActions && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-earnings/10 border border-earnings/20">
            <Zap className="w-4 h-4 text-earnings" />
            <span className="text-sm font-medium text-earnings">
              {product.commission}% Commission
            </span>
          </div>
        )}

        <div className="flex gap-2">
          {showPromoterActions ? (
            <Button 
              variant="earnings" 
              className="w-full gap-2"
              onClick={() => onPromote?.(product)}
            >
              <Zap className="w-4 h-4" />
              Get Link
            </Button>
          ) : (
            <Button 
              variant="default" 
              className="w-full gap-2"
              onClick={() => onAddToCart?.(product)}
              disabled={!product.inStock}
            >
              <ShoppingCart className="w-4 h-4" />
              {product.inStock ? "Add to Cart" : "Out of Stock"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface ProductGridProps {
  products: Product[];
  showPromoterActions?: boolean;
  onAddToCart?: (product: Product) => void;
  onPromote?: (product: Product) => void;
}

export function ProductGrid({ 
  products, 
  showPromoterActions = false,
  onAddToCart,
  onPromote 
}: ProductGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 stagger-children">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          showPromoterActions={showPromoterActions}
          onAddToCart={onAddToCart}
          onPromote={onPromote}
        />
      ))}
    </div>
  );
}
