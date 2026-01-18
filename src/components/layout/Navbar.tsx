import { useState } from "react";
import { Plus, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createBrowserSupabaseClient } from "@/db/supabase.browser";

/**
 * Górny pasek nawigacji widoczny na desktop i tablet.
 * Zawiera logo, przycisk nawigacji do nowej analizy i wylogowania.
 */
export function Navbar() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const supabase = createBrowserSupabaseClient();
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout error:", error);
      setIsLoggingOut(false);
    }
  };

  const handleNewAnalysis = () => {
    window.location.href = "/analysis/new";
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 max-w-6xl flex h-14 items-center justify-between">
        <a href="/" className="flex items-center gap-2 font-semibold">
          <span className="text-xl">📊</span>
          <span className="hidden sm:inline">Diff Explainer</span>
        </a>

        <nav className="hidden md:flex items-center gap-2">
          <Button variant="default" size="sm" onClick={handleNewAnalysis}>
            <Plus className="h-4 w-4 mr-1" />
            Nowa analiza
          </Button>
          <Button variant="outline" size="sm" onClick={handleLogout} disabled={isLoggingOut}>
            {isLoggingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <LogOut className="h-4 w-4 mr-1" />
                Wyloguj
              </>
            )}
          </Button>
        </nav>
      </div>
    </header>
  );
}
