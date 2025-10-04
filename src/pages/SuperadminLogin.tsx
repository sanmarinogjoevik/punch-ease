import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, ArrowLeft } from "lucide-react";

const SuperadminLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Sign in with email/password
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        toast.error("Inloggning misslyckades", {
          description: authError.message,
        });
        setLoading(false);
        return;
      }

      // Check if user has superadmin role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authData.user.id)
        .single();

      if (roleError || !roleData || roleData.role !== "superadmin") {
        // Sign out user if not superadmin
        await supabase.auth.signOut();
        toast.error("Åtkomst nekad", {
          description: "Du har inte superadmin-behörighet",
        });
        setLoading(false);
        return;
      }

      // Success - redirect to superadmin page
      toast.success("Inloggad som superadmin");
      navigate("/superadmin");
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Ett oväntat fel uppstod");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-4 left-4"
        onClick={() => navigate("/")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Tillbaka
      </Button>

      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Superadmin-inloggning</CardTitle>
          <CardDescription className="text-center">
            Endast för systemadministratörer
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-postadress</Label>
              <Input
                id="email"
                type="email"
                placeholder="superadmin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Lösenord</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Loggar in..." : "Logga in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperadminLogin;
