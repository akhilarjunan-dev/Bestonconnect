import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Play, Megaphone, Bell, Menu } from 'lucide-react';
import logoImage from '@/assets/logo.png';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

export function ShopperNavFooter() {
  const location = useLocation();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const [menuOpen, setMenuOpen] = useState(false);

  const menuItems = [
    { label: 'Profile', href: user ? '/profile' : '/auth', icon: '👤' },
    { label: 'Cart', href: '/cart', icon: '🛒' },
    { label: 'Notifications', href: '/notifications', icon: '🔔' },
    { label: 'My Orders', href: '/my-orders', icon: '📦' },
    { label: 'Wishlist', href: '/wishlist', icon: '❤️' },
    { label: 'Categories', href: '/categories', icon: '📂' },
    { label: 'All Products', href: '/products', icon: '🛍️' },
    { label: 'Contact Support', href: '/contact', icon: '💬' },
    { label: 'About Us', href: '/about', icon: 'ℹ️' },
    { label: 'Terms & Conditions', href: '/terms', icon: '📋' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="mx-0">
        <div className="bg-card/95 backdrop-blur-xl shadow-xl border-t border-border/50 px-2 py-2">
          <div className="flex items-center justify-between">
            {/* Left side: Menu & Videos */}
            <div className="flex items-center">
              {/* Menu */}
              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger asChild>
                  <button
                    className={cn(
                      "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all",
                      "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Menu className="w-5 h-5" />
                    <span className="text-xs font-medium">Menu</span>
                  </button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px]">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <img src={logoImage} alt="Bestonconnect" className="w-8 h-8 rounded-lg" />
                      Menu
                    </SheetTitle>
                  </SheetHeader>
                  <ScrollArea className="h-[calc(100vh-100px)] mt-4">
                    <div className="space-y-1">
                      {menuItems.map((item) => (
                        <Link
                          key={item.href}
                          to={item.href}
                          onClick={() => setMenuOpen(false)}
                        >
                          <Button
                            variant={location.pathname === item.href ? 'default' : 'ghost'}
                            className="w-full justify-start gap-3"
                          >
                            <span>{item.icon}</span>
                            {item.label}
                          </Button>
                        </Link>
                      ))}
                      <div className="border-t border-border my-4" />
                      <Link to="/promoter/apply" onClick={() => setMenuOpen(false)}>
                        <Button variant="hero" className="w-full">
                          Become a Promoter
                        </Button>
                      </Link>
                    </div>
                  </ScrollArea>
                </SheetContent>
              </Sheet>

              {/* Videos */}
              <Link
                to="/videos"
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all",
                  location.pathname === '/videos' 
                    ? "text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Play className={cn("w-5 h-5", location.pathname === '/videos' && "text-primary")} />
                <span className="text-xs font-medium">Videos</span>
              </Link>
            </div>

            {/* Center: Logo with Shop */}
            <Link to="/" className="relative -mt-8 flex flex-col items-center" onClick={(e) => {
              if (location.pathname === '/' || location.pathname === '/shop') {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}>
              <div className="w-16 h-16 rounded-full gradient-hero shadow-glow flex items-center justify-center ring-4 ring-background">
                <img src={logoImage} alt="Bestonconnect" className="w-10 h-10 rounded-full" />
              </div>
              <span className="text-xs font-semibold text-primary mt-1">Shop</span>
            </Link>

            {/* Right side: Alerts & Promote */}
            <div className="flex items-center">
              {/* Notifications/Alerts */}
              <Link
                to="/notifications"
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all relative",
                  location.pathname === '/notifications' 
                    ? "text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="relative">
                  <Bell className={cn("w-5 h-5", location.pathname === '/notifications' && "text-primary")} />
                  {user && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full flex items-center justify-center text-[8px] text-destructive-foreground font-bold">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium">Alerts</span>
              </Link>

              {/* Become a Promoter */}
              <Link
                to="/promoter/apply"
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all",
                  location.pathname === '/promoter/apply' 
                    ? "text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Megaphone className={cn("w-5 h-5", location.pathname === '/promoter/apply' && "text-primary")} />
                <span className="text-xs font-medium">Promote</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}