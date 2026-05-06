import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, GripVertical, LayoutDashboard, Save, Plus, Trash2, Image, Tags } from 'lucide-react';
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
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface HomeSection {
  id: string;
  section_key: string;
  title: string;
  emoji: string | null;
  is_enabled: boolean;
  display_order: number;
  image_url: string | null;
  selected_category_ids: string[] | null;
}

interface Category {
  id: string;
  name: string;
  image_url: string | null;
}

function SortableSectionRow({
  section,
  onToggle,
  onUpdateTitle,
  onUpdateEmoji,
  onDelete,
  onOpenImage,
  onOpenCategories,
}: {
  section: HomeSection;
  onToggle: (s: HomeSection) => void;
  onUpdateTitle: (s: HomeSection, title: string) => void;
  onUpdateEmoji: (s: HomeSection, emoji: string) => void;
  onDelete: (s: HomeSection) => void;
  onOpenImage: (s: HomeSection) => void;
  onOpenCategories: (s: HomeSection) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell className="w-10">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell className="w-16">
        <Input
          value={section.emoji || ''}
          onChange={(e) => onUpdateEmoji(section, e.target.value)}
          className="w-14 text-center text-lg"
          maxLength={4}
        />
      </TableCell>
      <TableCell>
        <Input
          value={section.title}
          onChange={(e) => onUpdateTitle(section, e.target.value)}
          className="max-w-xs"
        />
      </TableCell>
      <TableCell>
        {section.image_url ? (
          <img src={section.image_url} alt="" className="h-8 w-12 object-cover rounded cursor-pointer" onClick={() => onOpenImage(section)} />
        ) : (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onOpenImage(section)}>
            <Image className="h-3 w-3 mr-1" /> Add
          </Button>
        )}
      </TableCell>
      <TableCell>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onOpenCategories(section)}>
          <Tags className="h-3 w-3 mr-1" /> {(section.selected_category_ids?.length || 0)} selected
        </Button>
      </TableCell>
      <TableCell>
        <Switch
          checked={section.is_enabled}
          onCheckedChange={() => onToggle(section)}
        />
      </TableCell>
      <TableCell>
        <Button size="sm" variant="destructive" className="h-7 w-7 p-0" onClick={() => onDelete(section)}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function HomeSectionManagement() {
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Add section dialog
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newEmoji, setNewEmoji] = useState('📦');
  const [adding, setAdding] = useState(false);

  // Image dialog
  const [imageSection, setImageSection] = useState<HomeSection | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  // Category selection dialog
  const [catSection, setCatSection] = useState<HomeSection | null>(null);
  const [selectedCatIds, setSelectedCatIds] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    fetchSections();
    fetchCategories();
  }, []);

  const fetchSections = async () => {
    const { data, error } = await supabase
      .from('home_sections')
      .select('*')
      .order('display_order');

    if (error) {
      toast.error('Failed to fetch home sections');
      return;
    }

    setSections((data || []).map((d: any) => ({
      ...d,
      selected_category_ids: d.selected_category_ids || [],
    })) as HomeSection[]);
    setLoading(false);
  };

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('id, name, image_url')
      .eq('is_active', true)
      .order('name');
    if (data) setCategories(data);
  };

  const handleToggle = (section: HomeSection) => {
    setSections(prev =>
      prev.map(s => s.id === section.id ? { ...s, is_enabled: !s.is_enabled } : s)
    );
    setHasChanges(true);
  };

  const handleUpdateTitle = (section: HomeSection, title: string) => {
    setSections(prev =>
      prev.map(s => s.id === section.id ? { ...s, title } : s)
    );
    setHasChanges(true);
  };

  const handleUpdateEmoji = (section: HomeSection, emoji: string) => {
    setSections(prev =>
      prev.map(s => s.id === section.id ? { ...s, emoji } : s)
    );
    setHasChanges(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex(s => s.id === active.id);
    const newIndex = sections.findIndex(s => s.id === over.id);
    setSections(arrayMove(sections, oldIndex, newIndex));
    setHasChanges(true);
  };

  const handleAddSection = async () => {
    if (!newTitle.trim()) return;
    setAdding(true);
    const sectionKey = newTitle.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const { error } = await supabase.from('home_sections').insert({
      title: newTitle.trim(),
      section_key: sectionKey || `section_${Date.now()}`,
      emoji: newEmoji || '📦',
      display_order: sections.length,
      is_enabled: true,
    });
    if (error) {
      toast.error('Failed to add section');
    } else {
      toast.success('Section added');
      setNewTitle('');
      setNewEmoji('📦');
      setAddOpen(false);
      fetchSections();
    }
    setAdding(false);
  };

  const handleDeleteSection = async (section: HomeSection) => {
    if (!confirm(`Delete "${section.title}"?`)) return;
    const { error } = await supabase.from('home_sections').delete().eq('id', section.id);
    if (error) {
      toast.error('Failed to delete section');
    } else {
      setSections(prev => prev.filter(s => s.id !== section.id));
      toast.success('Section deleted');
    }
  };

  // Image handling
  const handleOpenImage = (section: HomeSection) => {
    setImageSection(section);
    setImageUrl(section.image_url || '');
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !imageSection) return;
    setUploadingImage(true);
    const ext = file.name.split('.').pop();
    const path = `section-images/${imageSection.id}.${ext}`;
    const { error } = await supabase.storage.from('category-images').upload(path, file, { upsert: true });
    if (error) {
      toast.error('Upload failed');
      setUploadingImage(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('category-images').getPublicUrl(path);
    const url = urlData.publicUrl;
    setImageUrl(url);
    setSections(prev => prev.map(s => s.id === imageSection.id ? { ...s, image_url: url } : s));
    setHasChanges(true);
    setUploadingImage(false);
  };

  const handleSaveImageUrl = () => {
    if (!imageSection) return;
    setSections(prev => prev.map(s => s.id === imageSection.id ? { ...s, image_url: imageUrl || null } : s));
    setHasChanges(true);
    setImageSection(null);
  };

  // Category selection
  const handleOpenCategories = (section: HomeSection) => {
    setCatSection(section);
    setSelectedCatIds(section.selected_category_ids || []);
  };

  const handleToggleCat = (catId: string) => {
    setSelectedCatIds(prev => prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]);
  };

  const handleSaveCategories = () => {
    if (!catSection) return;
    setSections(prev => prev.map(s => s.id === catSection.id ? { ...s, selected_category_ids: selectedCatIds } : s));
    setHasChanges(true);
    setCatSection(null);
  };

  const saveAll = async () => {
    setSaving(true);

    const updates = sections.map((section, index) =>
      supabase
        .from('home_sections')
        .update({
          display_order: index,
          is_enabled: section.is_enabled,
          title: section.title,
          emoji: section.emoji,
          image_url: section.image_url,
          selected_category_ids: section.selected_category_ids,
        } as any)
        .eq('id', section.id)
    );

    const results = await Promise.all(updates);
    const hasError = results.some(r => r.error);

    if (hasError) {
      toast.error('Failed to save some sections');
    } else {
      toast.success('Home sections saved');
      setHasChanges(false);
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LayoutDashboard className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Home Page Sections</CardTitle>
                <CardDescription>Add, remove, reorder sections. Assign images & categories.</CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Section
              </Button>
              <Button onClick={saveAll} disabled={saving || !hasChanges}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sections.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No home sections configured. Click "Add Section" to create one.
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="w-16">Emoji</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Image</TableHead>
                      <TableHead>Categories</TableHead>
                      <TableHead>Enabled</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sections.map((section) => (
                      <SortableSectionRow
                        key={section.id}
                        section={section}
                        onToggle={handleToggle}
                        onUpdateTitle={handleUpdateTitle}
                        onUpdateEmoji={handleUpdateEmoji}
                        onDelete={handleDeleteSection}
                        onOpenImage={handleOpenImage}
                        onOpenCategories={handleOpenCategories}
                      />
                    ))}
                  </TableBody>
                </Table>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Add Section Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add New Section</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Trending Now" />
            </div>
            <div>
              <Label>Emoji</Label>
              <Input value={newEmoji} onChange={(e) => setNewEmoji(e.target.value)} className="w-20 text-lg" maxLength={4} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddSection} disabled={adding || !newTitle.trim()}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Dialog */}
      <Dialog open={!!imageSection} onOpenChange={() => setImageSection(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Section Image</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {imageUrl && <img src={imageUrl} alt="" className="w-full h-32 object-cover rounded" />}
            <div>
              <Label>Upload Image</Label>
              <Input type="file" accept="image/*" onChange={handleUploadImage} disabled={uploadingImage} />
              {uploadingImage && <Loader2 className="h-4 w-4 animate-spin mt-1" />}
            </div>
            <div>
              <Label>Or paste URL</Label>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImageUrl(''); handleSaveImageUrl(); }}>Remove</Button>
            <Button onClick={handleSaveImageUrl}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Selection Dialog */}
      <Dialog open={!!catSection} onOpenChange={() => setCatSection(null)}>
        <DialogContent className="max-w-sm max-h-[70vh]">
          <DialogHeader>
            <DialogTitle>Select Categories for "{catSection?.title}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[40vh] overflow-y-auto">
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No categories found.</p>
            ) : (
              categories.map(cat => (
                <label key={cat.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer">
                  <Checkbox
                    checked={selectedCatIds.includes(cat.id)}
                    onCheckedChange={() => handleToggleCat(cat.id)}
                  />
                  {cat.image_url && <img src={cat.image_url} alt="" className="h-6 w-6 rounded object-cover" />}
                  <span className="text-sm">{cat.name}</span>
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedCatIds([])}>Clear All</Button>
            <Button onClick={handleSaveCategories}>Save ({selectedCatIds.length})</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
