const Index = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center max-w-2xl">
        <h1 className="mb-6 text-4xl font-bold">Välkommen till PunchEase</h1>
        <p className="mb-8 text-xl text-muted-foreground">Välj ditt företag för att fortsätta</p>
        
        <div className="text-muted-foreground">
          <p>Navigera till din företagsspecifika URL:</p>
          <p className="mt-2 text-sm">Exempel: /sanmarinogjoevik/auth</p>
        </div>
      </div>
    </div>
  );
};

export default Index;
