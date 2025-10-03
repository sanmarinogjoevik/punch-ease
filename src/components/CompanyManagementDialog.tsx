import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, Edit, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface Company {
  id: string;
  name: string;
  slug: string;
  access_code: string;
  org_number: string | null;
}

interface CompanyManagementDialogProps {
  companies: Company[];
}

export function CompanyManagementDialog({ companies }: CompanyManagementDialogProps) {
  const [open, setOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    access_code: "",
    org_number: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setFormData({
      name: company.name,
      slug: company.slug,
      access_code: company.access_code,
      org_number: company.org_number || "",
    });
    setIsCreating(false);
  };

  const handleCreate = () => {
    setEditingCompany(null);
    setFormData({
      name: "",
      slug: "",
      access_code: "",
      org_number: "",
    });
    setIsCreating(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.slug || !formData.access_code) {
      toast.error("Fyll i alla obligatoriska fält");
      return;
    }

    setIsSaving(true);
    try {
      if (editingCompany) {
        // Update existing company
        const { error } = await supabase
          .from("companies")
          .update({
            name: formData.name,
            slug: formData.slug.toLowerCase().trim(),
            access_code: formData.access_code,
            org_number: formData.org_number || null,
          })
          .eq("id", editingCompany.id);

        if (error) throw error;
        toast.success("Företag uppdaterat!");
      } else if (isCreating) {
        // Create new company
        const { error } = await supabase
          .from("companies")
          .insert({
            name: formData.name,
            slug: formData.slug.toLowerCase().trim(),
            access_code: formData.access_code,
            org_number: formData.org_number || null,
          });

        if (error) throw error;
        toast.success("Företag skapat!");
      }

      queryClient.invalidateQueries({ queryKey: ["superadmin-companies"] });
      setEditingCompany(null);
      setIsCreating(false);
      setFormData({ name: "", slug: "", access_code: "", org_number: "" });
    } catch (error: any) {
      console.error("Error saving company:", error);
      toast.error(error.message || "Kunde inte spara företag");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingCompany(null);
    setIsCreating(false);
    setFormData({ name: "", slug: "", access_code: "", org_number: "" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Building2 className="mr-2 h-4 w-4" />
          Hantera Företag & Inloggningskoder
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Hantera Företag</DialogTitle>
          <DialogDescription>
            Lägg till eller redigera företag och deras inloggningskoder
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!editingCompany && !isCreating ? (
            <>
              <Button onClick={handleCreate} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Skapa Nytt Företag
              </Button>

              <div className="space-y-2">
                {companies.map((company) => (
                  <div
                    key={company.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{company.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Slug: {company.slug} • Kod: {company.access_code}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(company)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Företagsnamn *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="t.ex. San Marino AB"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">
                  Företags-slug * (används i URL och som användarnamn)
                </Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      slug: e.target.value.toLowerCase(),
                    })
                  }
                  placeholder="t.ex. sanmarino"
                />
                <p className="text-xs text-muted-foreground">
                  Företaget loggar in med detta som användarnamn
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="access_code">Företagskod * (pinkod)</Label>
                <Input
                  id="access_code"
                  type="text"
                  value={formData.access_code}
                  onChange={(e) =>
                    setFormData({ ...formData, access_code: e.target.value })
                  }
                  placeholder="t.ex. 1111"
                />
                <p className="text-xs text-muted-foreground">
                  Företaget använder denna kod för att logga in
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="org_number">Organisationsnummer</Label>
                <Input
                  id="org_number"
                  value={formData.org_number}
                  onChange={(e) =>
                    setFormData({ ...formData, org_number: e.target.value })
                  }
                  placeholder="t.ex. 556677-8899"
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleCancel}>
                  Avbryt
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Sparar..." : "Spara"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
