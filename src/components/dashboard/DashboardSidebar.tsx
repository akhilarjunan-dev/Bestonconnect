import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Menu, ChevronLeft, ChevronRight, Star, GripVertical, X, LucideIcon } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

interface DashboardSidebarProps {
  items: NavItem[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  title: string;
  titleIcon: LucideIcon;
  subtitle?: string;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  favoritesKey?: string; // localStorage key for persisting favorites
}

const MAX_FAVORITES = 5;

export function DashboardSidebar({
  items,
  activeTab,
  onTabChange,
  title,
  titleIcon: TitleIcon,
  subtitle,
  collapsed = false,
  onCollapsedChange,
  favoritesKey = 'admin-sidebar-favorites'
}: DashboardSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [editingFavorites, setEditingFavorites] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // Load favorites from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(favoritesKey);
      if (stored) setFavoriteIds(JSON.parse(stored));
    } catch {}
  }, [favoritesKey]);

  // Save favorites to localStorage
  const saveFavorites = (ids: string[]) => {
    setFavoriteIds(ids);
    localStorage.setItem(favoritesKey, JSON.stringify(ids));
  };

  const toggleFavorite = (id: string) => {
    if (favoriteIds.includes(id)) {
      saveFavorites(favoriteIds.filter(f => f !== id));
    } else if (favoriteIds.length < MAX_FAVORITES) {
      saveFavorites([...favoriteIds, id]);
    }
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (!draggedId) return;
    const currentIndex = favoriteIds.indexOf(draggedId);
    if (currentIndex === -1) return;
    const newFavs = [...favoriteIds];
    newFavs.splice(currentIndex, 1);
    newFavs.splice(targetIndex, 0, draggedId);
    saveFavorites(newFavs);
    setDraggedId(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverIndex(null);
  };

  const handleNavClick = (id: string) => {
    onTabChange(id);
    setMobileOpen(false);
  };

  const toggleCollapsed = () => {
    onCollapsedChange?.(!collapsed);
  };

  const favoriteItems = favoriteIds
    .map(id => items.find(i => i.id === id))
    .filter(Boolean) as NavItem[];

  const remainingItems = items.filter(i => !favoriteIds.includes(i.id));

  const renderNavButton = (item: NavItem, isCollapsed: boolean, isActive: boolean) => (
    <button
      key={item.id}
      onClick={() => handleNavClick(item.id)}
      className={cn(
        "w-full flex items-center rounded-lg text-sm font-medium transition-colors text-left",
        isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <item.icon className="w-4 h-4 flex-shrink-0" />
      {!isCollapsed && (
        <>
          <span className="truncate flex-1">{item.label}</span>
          {item.badge && item.badge > 0 && (
            <Badge
              variant={isActive ? "secondary" : "destructive"}
              className="ml-auto h-5 px-1.5 text-xs"
            >
              {item.badge}
            </Badge>
          )}
        </>
      )}
      {isCollapsed && item.badge && item.badge > 0 && (
        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] flex items-center justify-center text-destructive-foreground">
          {item.badge}
        </span>
      )}
    </button>
  );

  const renderItem = (item: NavItem, isCollapsed: boolean) => {
    const isActive = activeTab === item.id;
    const navButton = renderNavButton(item, isCollapsed, isActive);

    if (isCollapsed) {
      return (
        <Tooltip key={item.id}>
          <TooltipTrigger asChild>
            <div className="relative">{navButton}</div>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-2">
            {item.label}
            {item.badge && item.badge > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                {item.badge}
              </Badge>
            )}
          </TooltipContent>
        </Tooltip>
      );
    }

    return navButton;
  };

  const NavContent = ({ isCollapsed = false }: { isCollapsed?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={cn("p-4 border-b border-border", isCollapsed && "px-2")}>
        <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-3")}>
          <div className={cn(
            "flex items-center justify-center rounded-xl bg-primary/10",
            isCollapsed ? "w-8 h-8" : "w-10 h-10"
          )}>
            <TitleIcon className={cn("text-primary", isCollapsed ? "w-4 h-4" : "w-5 h-5")} />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <h2 className="font-bold font-display text-foreground truncate">{title}</h2>
              {subtitle && (
                <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className={cn("flex-1", isCollapsed ? "p-2" : "p-3")}>
        <nav className="space-y-1">
          <TooltipProvider delayDuration={0}>
            {/* Favorites Section */}
            {favoriteItems.length > 0 && (
              <>
                {!isCollapsed && (
                  <div className="flex items-center justify-between px-2 pt-1 pb-2">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1">
                      <Star className="w-3 h-3 fill-current" /> Favorites
                    </span>
                    <button
                      onClick={() => setEditingFavorites(!editingFavorites)}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {editingFavorites ? 'Done' : 'Edit'}
                    </button>
                  </div>
                )}
                {favoriteItems.map((item, index) => (
                  <div
                    key={item.id}
                    draggable={editingFavorites && !isCollapsed}
                    onDragStart={(e) => handleDragStart(e, item.id)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "relative group",
                      editingFavorites && !isCollapsed && "cursor-grab active:cursor-grabbing",
                      dragOverIndex === index && draggedId !== item.id && "border-t-2 border-primary"
                    )}
                  >
                    {editingFavorites && !isCollapsed && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 z-10 flex items-center gap-0.5">
                        <GripVertical className="w-3 h-3 text-muted-foreground" />
                      </div>
                    )}
                    <div className={cn(editingFavorites && !isCollapsed && "pl-4")}>
                      {renderItem(item, isCollapsed)}
                    </div>
                    {editingFavorites && !isCollapsed && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
                {!isCollapsed && (
                  <div className="border-b border-border my-2" />
                )}
                {isCollapsed && (
                  <div className="border-b border-border my-1" />
                )}
              </>
            )}

            {/* All / Remaining Items */}
            {!isCollapsed && favoriteItems.length > 0 && (
              <div className="px-2 pt-1 pb-2">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">All</span>
              </div>
            )}
            {(favoriteItems.length > 0 ? remainingItems : items).map((item) => (
              <div key={item.id} className="relative group">
                {renderItem(item, isCollapsed)}
                {!isCollapsed && !editingFavorites && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}
                    className={cn(
                      "absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity",
                      favoriteIds.includes(item.id)
                        ? "text-primary hover:bg-primary/10"
                        : favoriteIds.length >= MAX_FAVORITES
                          ? "text-muted-foreground/30 cursor-not-allowed"
                          : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                    )}
                    disabled={!favoriteIds.includes(item.id) && favoriteIds.length >= MAX_FAVORITES}
                    title={
                      favoriteIds.includes(item.id)
                        ? 'Remove from favorites'
                        : favoriteIds.length >= MAX_FAVORITES
                          ? `Max ${MAX_FAVORITES} favorites`
                          : 'Add to favorites'
                    }
                  >
                    <Star className={cn("w-3 h-3", favoriteIds.includes(item.id) && "fill-current")} />
                  </button>
                )}
              </div>
            ))}
          </TooltipProvider>
        </nav>
      </ScrollArea>

      {/* Collapse Toggle for Desktop */}
      {onCollapsedChange && (
        <div className={cn("p-2 border-t border-border", isCollapsed && "flex justify-center")}>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleCollapsed}
            className={cn("w-full", isCollapsed && "w-auto p-2")}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Collapse
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile Header with Hamburger */}
      <div className="lg:hidden flex items-center gap-3 p-4 border-b border-border bg-background sticky top-0 z-40">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0">
              <Menu className="w-5 h-5" />
              <span className="sr-only">Toggle navigation</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <NavContent isCollapsed={false} />
          </SheetContent>
        </Sheet>
        
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0">
            <TitleIcon className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold font-display text-lg truncate">{title}</h1>
          </div>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden lg:flex lg:flex-col lg:border-r lg:border-border lg:bg-card lg:shrink-0 transition-all duration-300",
        collapsed ? "lg:w-16" : "lg:w-64"
      )}>
        <NavContent isCollapsed={collapsed} />
      </aside>
    </>
  );
}
