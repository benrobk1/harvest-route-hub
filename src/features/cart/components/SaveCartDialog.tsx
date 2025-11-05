import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';

interface SaveCartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string) => void;
  isSaving: boolean;
}

export const SaveCartDialog = ({ open, onOpenChange, onSave, isSaving }: SaveCartDialogProps) => {
  const [cartName, setCartName] = useState('');

  const handleSave = () => {
    if (cartName.trim()) {
      onSave(cartName.trim());
      setCartName('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save Cart</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="cart-name">Cart Name</Label>
            <Input
              id="cart-name"
              placeholder="e.g., Weekly Favorites, Summer Harvest"
              value={cartName}
              onChange={(e) => setCartName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isSaving) {
                  handleSave();
                }
              }}
              autoFocus
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Save your current cart to easily reorder these items later
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!cartName.trim() || isSaving}>
            {isSaving ? 'Saving...' : 'Save Cart'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
