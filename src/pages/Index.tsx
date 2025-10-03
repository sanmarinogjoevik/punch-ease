import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const Index = () => {
  const navigate = useNavigate();
  const [companySlug, setCompanySlug] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCompanyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from("companies")
        .select("slug")
        .eq("slug", companySlug.toLowerCase().trim())
        .eq("access_code", accessCode)
        .maybeSingle();

      if (error) {
        console.error("Error validating company:", error);
        toast.error("Ett fel uppstod");
        return;
      }

      if (!data) {
        toast.error("Ogiltigt företagsnamn eller kod");
        return;
      }

      toast.success("Företag verifierat!");
      navigate(`/${data.slug}/auth`);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Ett fel uppstod");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Välkommen till PunchEase</CardTitle>
          <CardDescription>Logga in med ditt företags uppgifter</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCompanyLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companySlug">Företagsnamn</Label>
              <Input
                id="companySlug"
                type="text"
                placeholder="t.ex. sanmarino"
                value={companySlug}
                onChange={(e) => setCompanySlug(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accessCode">Företagskod</Label>
              <Input
                id="accessCode"
                type="password"
                placeholder="****"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Verifierar..." : "Fortsätt"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
