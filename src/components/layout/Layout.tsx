import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useRazorpayPreload } from "@/hooks/useRazorpay";
import logoImage from "@/assets/logo.png";
import { 
  Zap, 
  ShoppingBag, 
  LayoutDashboard, 
  Settings,
  LogOut,
  Shield,
  User,
  Package,
  Banknote,
  Heart,
  ShoppingCart,
  Grid3X3,
  FileText,
  Info,
  MessageCircle,
  ClipboardList,
  Bell,
  Store
} from "lucide-react";
import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const publicNavItems: NavItem[] = [
  { label: "Shop", href: "/shop", icon: ShoppingBag },
  { label: "Become a Promoter", href: "/promoter/apply", icon: Zap },
];

const promoterNavItems: NavItem[] = [
  { label: "Dashboard", href: "/promoter/dashboard", icon: LayoutDashboard },
  { label: "Products", href: "/promoter/products", icon: Package },
  { label: "Withdrawals", href: "/promoter/withdrawals", icon: Banknote },
  { label: "Shop", href: "/shop", icon: ShoppingBag },
];

export function Header() {
  const location = useLocation();
  const { user, roles, signOut, hasRole } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  
  // Preload Razorpay script early for faster checkout
  useRazorpayPreload();

  // Track cart count for mobile menu
  useEffect(() => {
    const updateCount = () => {
      const saved = localStorage.getItem('bestonconnect_cart');
      if (saved) {
        const items = JSON.parse(saved);
        setCartCount(items.length);
      } else {
        setCartCount(0);
      }
    };
    updateCount();
    window.addEventListener('cartUpdated', updateCount as EventListener);
    window.addEventListener('storage', updateCount);
    return () => {
      window.removeEventListener('cartUpdated', updateCount as EventListener);
      window.removeEventListener('storage', updateCount);
    };
  }, []);

  const handleSignOut = async () => {
    await signOut();
  };
  
  // Determine nav items based on role
  const navItems = hasRole('promoter') || hasRole('manager') || hasRole('admin')
    ? promoterNavItems 
    : publicNavItems;

  const userInitials = user?.email?.slice(0, 2).toUpperCase() || 'U';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group" onClick={(e) => {
          if (location.pathname === '/' || location.pathname === '/shop') {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}>
          <img 
            src={logoImage} 
            alt="Bestonconnect Logo" 
            className="w-10 h-10 rounded-xl transition-all group-hover:scale-105"
          />
          <span className="font-display font-bold text-xl text-foreground">
            Beston<span className="text-gradient-hero">connect</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link key={item.href} to={item.href}>
              <Button
                variant={location.pathname === item.href ? "default" : "ghost"}
                size="sm"
                className="gap-2"
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Button>
            </Link>
          ))}
          {(hasRole('manager') || hasRole('admin')) && (
            <Link to="/manager/dashboard">
              <Button
                variant={location.pathname === '/manager/dashboard' ? "default" : "ghost"}
                size="sm"
                className="gap-2"
              >
                <Shield className="w-4 h-4" />
                Manager
              </Button>
            </Link>
          )}
          {hasRole('vendor') && (
            <Link to="/vendor/dashboard">
              <Button
                variant={location.pathname === '/vendor/dashboard' ? "default" : "ghost"}
                size="sm"
                className="gap-2"
              >
                <Store className="w-4 h-4" />
                Vendor
              </Button>
            </Link>
          )}
          {hasRole('admin') && (
            <Link to="/admin/dashboard">
              <Button
                variant={location.pathname === '/admin/dashboard' ? "default" : "ghost"}
                size="sm"
                className="gap-2"
              >
                <Settings className="w-4 h-4" />
                Admin
              </Button>
            </Link>
          )}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Link to="/cart">
            <Button variant="ghost" size="icon" className="relative">
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center font-bold">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </Button>
          </Link>
          {user && <NotificationCenter />}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    <p className="font-medium">{user.email}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {roles.join(', ') || 'Buyer'}
                    </p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/promoter/dashboard" className="cursor-pointer">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Dashboard
                  </Link>
                </DropdownMenuItem>
                {(hasRole('manager') || hasRole('admin')) && (
                  <DropdownMenuItem asChild>
                    <Link to="/manager/dashboard" className="cursor-pointer">
                      <Shield className="mr-2 h-4 w-4" />
                      Manager Dashboard
                    </Link>
                  </DropdownMenuItem>
                )}
                {hasRole('admin') && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin/dashboard" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      Admin Dashboard
                    </Link>
                  </DropdownMenuItem>
                )}
                {hasRole('vendor') && (
                  <DropdownMenuItem asChild>
                    <Link to="/vendor/dashboard" className="cursor-pointer">
                      <Store className="mr-2 h-4 w-4" />
                      Vendor Dashboard
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link to="/auth">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link to="/auth">
                <Button variant="hero" size="sm">
                  Get Started
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Header Right - Cart & Profile */}
        <div className="md:hidden flex items-center gap-1">
          <Link to="/cart">
            <Button variant="ghost" size="icon" className="relative">
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center font-bold">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </Button>
          </Link>
          <Link to={user ? "/profile" : "/auth"}>
            <Button variant="ghost" size="icon">
              <User className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-card animate-slide-up">
          <nav className="container py-4 space-y-2">
            {/* Main Nav Items */}
            {navItems.map((item) => (
              <Link 
                key={item.href} 
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Button
                  variant={location.pathname === item.href ? "default" : "ghost"}
                  className="w-full justify-start gap-2"
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Button>
              </Link>
            ))}
            
            {/* Shopper-specific menu items */}
            {!hasRole('promoter') && !hasRole('manager') && !hasRole('admin') && (
              <>
                <div className="border-t border-border my-2 pt-2">
                  <p className="text-xs text-muted-foreground px-2 mb-2">Shopping</p>
                </div>
                <Link to="/categories" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant={location.pathname === '/categories' ? "default" : "ghost"} className="w-full justify-start gap-2">
                    <Grid3X3 className="w-4 h-4" />
                    Categories
                  </Button>
                </Link>
                <Link to="/cart" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant={location.pathname === '/cart' ? "default" : "ghost"} className="w-full justify-start gap-2">
                    <ShoppingCart className="w-4 h-4" />
                    Cart
                    {cartCount > 0 && <span className="ml-auto text-xs bg-primary text-primary-foreground px-1.5 rounded">{cartCount}</span>}
                  </Button>
                </Link>
                <Link to="/wishlist" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant={location.pathname === '/wishlist' ? "default" : "ghost"} className="w-full justify-start gap-2">
                    <Heart className="w-4 h-4" />
                    Wishlist
                  </Button>
                </Link>
                <Link to="/my-orders" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant={location.pathname === '/my-orders' ? "default" : "ghost"} className="w-full justify-start gap-2">
                    <ClipboardList className="w-4 h-4" />
                    My Orders
                  </Button>
                </Link>
                <Link to="/notifications" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant={location.pathname === '/notifications' ? "default" : "ghost"} className="w-full justify-start gap-2">
                    <Bell className="w-4 h-4" />
                    Notifications
                  </Button>
                </Link>
                
                <div className="border-t border-border my-2 pt-2">
                  <p className="text-xs text-muted-foreground px-2 mb-2">Help & Info</p>
                </div>
                <Link to="/contact" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant={location.pathname === '/contact' ? "default" : "ghost"} className="w-full justify-start gap-2">
                    <MessageCircle className="w-4 h-4" />
                    Contact Support
                  </Button>
                </Link>
                <Link to="/about" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant={location.pathname === '/about' ? "default" : "ghost"} className="w-full justify-start gap-2">
                    <Info className="w-4 h-4" />
                    About Us
                  </Button>
                </Link>
                <Link to="/terms" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant={location.pathname === '/terms' ? "default" : "ghost"} className="w-full justify-start gap-2">
                    <FileText className="w-4 h-4" />
                    Terms & Conditions
                  </Button>
                </Link>
              </>
            )}

            {(hasRole('manager') || hasRole('admin')) && (
              <Link to="/manager/dashboard" onClick={() => setMobileMenuOpen(false)}>
                <Button
                  variant={location.pathname === '/manager/dashboard' ? "default" : "ghost"}
                  className="w-full justify-start gap-2"
                >
                  <Shield className="w-4 h-4" />
                  Manager Dashboard
                </Button>
              </Link>
            )}
            {user ? (
              <Button variant="destructive" className="w-full mt-4" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            ) : (
              <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="hero" className="w-full mt-4">
                  Sign In / Get Started
                </Button>
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const location = useLocation();
  return (
    <footer className="border-t border-border bg-secondary text-secondary-foreground">
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2" onClick={(e) => {
              if (location.pathname === '/' || location.pathname === '/shop') {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}>
              <img 
                src={logoImage} 
                alt="Bestonconnect Logo" 
                className="w-10 h-10 rounded-xl"
              />
              <span className="font-display font-bold text-xl">
                Bestonconnect
              </span>
            </Link>
            <p className="text-sm text-secondary-foreground/70">
              Empowering promoters to earn fairly, transparently, and consistently.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">For Buyers</h4>
            <ul className="space-y-2 text-sm text-secondary-foreground/70">
              <li><Link to="/products" className="hover:text-primary transition-colors">All Products</Link></li>
              <li><Link to="/categories" className="hover:text-primary transition-colors">Categories</Link></li>
              <li><Link to="/my-orders" className="hover:text-primary transition-colors">My Orders</Link></li>
              <li><Link to="/wishlist" className="hover:text-primary transition-colors">Wishlist</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">For Promoters</h4>
            <ul className="space-y-2 text-sm text-secondary-foreground/70">
              <li><Link to="/promoter/apply" className="hover:text-primary transition-colors">Become a Promoter</Link></li>
              <li><Link to="/landing" className="hover:text-primary transition-colors">How It Works</Link></li>
              <li><Link to="/promoter/dashboard" className="hover:text-primary transition-colors">Earning System</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">For Vendors</h4>
            <ul className="space-y-2 text-sm text-secondary-foreground/70">
              <li><Link to="/vendor/apply" className="hover:text-primary transition-colors">Become a Vendor</Link></li>
              <li><Link to="/vendor/dashboard" className="hover:text-primary transition-colors">Vendor Dashboard</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Support</h4>
            <ul className="space-y-2 text-sm text-secondary-foreground/70">
              <li><Link to="/contact" className="hover:text-primary transition-colors">Contact Us</Link></li>
              <li><Link to="/about" className="hover:text-primary transition-colors">About Us</Link></li>
              <li><Link to="/terms" className="hover:text-primary transition-colors">Terms & Conditions</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-sidebar-border mt-8 pt-8 text-center text-sm text-secondary-foreground/60">
          <p>© 2024 Bestonconnect. Built with transparency and fairness in mind.</p>
        </div>
      </div>
    </footer>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
