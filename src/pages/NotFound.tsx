import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { companySlug } = useParams<{ companySlug: string }>();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const handleGoBack = () => {
    if (companySlug) {
      navigate(`/${companySlug}/auth`);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Sidan hittades inte</p>
        <Button onClick={handleGoBack}>
          Gå tillbaka
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
