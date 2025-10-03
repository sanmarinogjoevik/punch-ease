import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Shield, Lock } from "lucide-react";

const SuperAdminAuth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, user, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect if already logged in as superadmin
  if (user && isSuperAdmin) {
    navigate("/superadmin");
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await signIn(email, password);

      if (error) {
        toast({
          title: "Inloggning misslyckades",
          description: error.message || "Kontrollera dina uppgifter",
          variant: "destructive",
        });
      } else {
        // Wait a moment to check if user is superadmin
        setTimeout(() => {
          // The auth context will update, and redirect will happen automatically
        }, 500);
      }
    } catch (error: any) {
      toast({
        title: "Ett fel uppstod",
        description: error.message || "Försök igen senare",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <Card className="w-full max-w-md border-2 shadow-xl">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-primary/10 rounded-full">
              <Shield className="h-12 w-12 text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">SuperAdmin</CardTitle>
          <CardDescription className="text-base">
            Logga in med dina superadmin-uppgifter
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Lösenord
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="h-11"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-base font-medium"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                  Loggar in...
                </div>
              ) : (
                "Logga in"
              )}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground text-center">
              Endast superadministratörer har tillgång till detta område.
              <br />
              Kontakta systemadministratören om du behöver åtkomst.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperAdminAuth;
