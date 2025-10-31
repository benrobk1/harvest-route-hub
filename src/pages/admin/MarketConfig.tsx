import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Pencil, Save, X, ArrowLeft } from "lucide-react";
import { formatMoney } from "@/lib/formatMoney";
import { useNavigate } from "react-router-dom";

interface MarketConfig {
  id: string;
  zip_code: string;
  delivery_fee: number;
  minimum_order: number;
  cutoff_time: string;
  delivery_days: string[];
  active: boolean;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function MarketConfig() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const queryClient = useQueryClient();

  const { data: configs, isLoading } = useQuery({
    queryKey: ["market-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("market_configs")
        .select("*")
        .order("zip_code");

      if (error) throw error;
      return data as MarketConfig[];
    },
  });

  const updateConfig = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<MarketConfig> }) => {
      const { error } = await supabase
        .from("market_configs")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["market-configs"] });
      toast.success("Market config updated");
      setEditingId(null);
    },
    onError: () => {
      toast.error("Failed to update market config");
    },
  });

  const createConfig = useMutation({
    mutationFn: async (newConfig: Omit<MarketConfig, "id">) => {
      const { error } = await supabase.from("market_configs").insert(newConfig);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["market-configs"] });
      toast.success("Market config created");
      setIsAdding(false);
    },
    onError: () => {
      toast.error("Failed to create market config");
    },
  });

  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-earth">
      <header className="bg-white border-b shadow-soft">
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin/dashboard")}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Market Configuration</h1>
              <p className="text-sm text-muted-foreground">
                Manage ZIP codes, delivery fees, and schedules
              </p>
            </div>
            <Button onClick={() => setIsAdding(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Market
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Active Markets</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {configs?.map((config) => (
                  <ConfigCard
                    key={config.id}
                    config={config}
                    isEditing={editingId === config.id}
                    onEdit={() => setEditingId(config.id)}
                    onSave={(updates) => {
                      updateConfig.mutate({ id: config.id, updates });
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                ))}
                {configs?.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No markets configured yet
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {isAdding && (
          <NewConfigCard
            onSave={(newConfig) => createConfig.mutate(newConfig)}
            onCancel={() => setIsAdding(false)}
          />
        )}
      </main>
    </div>
  );
}

function ConfigCard({
  config,
  isEditing,
  onEdit,
  onSave,
  onCancel,
}: {
  config: MarketConfig;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (updates: Partial<MarketConfig>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState(config);

  if (!isEditing) {
    return (
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-lg">ZIP {config.zip_code}</h3>
            <Badge variant={config.active ? "default" : "secondary"}>
              {config.active ? "Active" : "Inactive"}
            </Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Delivery Fee:</span>
              <p className="font-medium">{formatMoney(config.delivery_fee)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Minimum Order:</span>
              <p className="font-medium">{formatMoney(config.minimum_order)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Cutoff Time:</span>
              <p className="font-medium">{config.cutoff_time}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Delivery Days:</span>
              <p className="font-medium">{config.delivery_days.join(", ")}</p>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg space-y-4 bg-muted/20">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>ZIP Code</Label>
          <Input
            value={formData.zip_code}
            onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
          />
        </div>
        <div>
          <Label>Delivery Fee</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.delivery_fee}
            onChange={(e) =>
              setFormData({ ...formData, delivery_fee: parseFloat(e.target.value) })
            }
          />
        </div>
        <div>
          <Label>Minimum Order</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.minimum_order}
            onChange={(e) =>
              setFormData({ ...formData, minimum_order: parseFloat(e.target.value) })
            }
          />
        </div>
        <div>
          <Label>Cutoff Time</Label>
          <Input
            type="time"
            value={formData.cutoff_time}
            onChange={(e) => setFormData({ ...formData, cutoff_time: e.target.value })}
          />
        </div>
      </div>

      <div>
        <Label>Delivery Days</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {DAYS.map((day) => (
            <Badge
              key={day}
              variant={formData.delivery_days.includes(day) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => {
                const days = formData.delivery_days.includes(day)
                  ? formData.delivery_days.filter((d) => d !== day)
                  : [...formData.delivery_days, day];
                setFormData({ ...formData, delivery_days: days });
              }}
            >
              {day}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={formData.active}
          onCheckedChange={(active) => setFormData({ ...formData, active })}
        />
        <Label>Active</Label>
      </div>

      <div className="flex gap-2">
        <Button onClick={() => onSave(formData)}>
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
        <Button variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
      </div>
    </div>
  );
}

function NewConfigCard({
  onSave,
  onCancel,
}: {
  onSave: (config: Omit<MarketConfig, "id">) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<Omit<MarketConfig, "id">>({
    zip_code: "",
    delivery_fee: 5.99,
    minimum_order: 25,
    cutoff_time: "00:00",
    delivery_days: [],
    active: true,
  });

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>New Market Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>ZIP Code</Label>
            <Input
              value={formData.zip_code}
              onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
              placeholder="10001"
            />
          </div>
          <div>
            <Label>Delivery Fee</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.delivery_fee}
              onChange={(e) =>
                setFormData({ ...formData, delivery_fee: parseFloat(e.target.value) })
              }
            />
          </div>
          <div>
            <Label>Minimum Order</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.minimum_order}
              onChange={(e) =>
                setFormData({ ...formData, minimum_order: parseFloat(e.target.value) })
              }
            />
          </div>
          <div>
            <Label>Cutoff Time</Label>
            <Input
              type="time"
              value={formData.cutoff_time}
              onChange={(e) => setFormData({ ...formData, cutoff_time: e.target.value })}
            />
          </div>
        </div>

        <div>
          <Label>Delivery Days</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {DAYS.map((day) => (
              <Badge
                key={day}
                variant={formData.delivery_days.includes(day) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => {
                  const days = formData.delivery_days.includes(day)
                    ? formData.delivery_days.filter((d) => d !== day)
                    : [...formData.delivery_days, day];
                  setFormData({ ...formData, delivery_days: days });
                }}
              >
                {day}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => onSave(formData)}>
            <Save className="h-4 w-4 mr-2" />
            Create Market
          </Button>
          <Button variant="outline" onClick={onCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
