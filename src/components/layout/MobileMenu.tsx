import { useState } from "react";
import { Menu, Plus, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { createBrowserSupabaseClient } from "@/db/supabase.browser";

/**
 * Menu hamburger dla urządzeń mobilnych.
 * Pojawia się jako pływający przycisk w prawym dolnym rogu.
 */
export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
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
    setIsOpen(false);
    window.location.href = "/analysis/new";
  };

  return (
    <div className="md:hidden">
      {/* Floating Action Button */}
      <Button
        variant="default"
        size="icon"
        className="fixed bottom-4 right-4 h-14 w-14 rounded-full shadow-lg z-50"
        onClick={() => setIsOpen(true)}
        aria-label="Otwórz menu"
      >
        <Menu className="h-6 w-6" />
      </Button>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="bottom" className="h-auto rounded-t-xl">
          <SheetHeader className="text-left">
            <SheetTitle>Menu</SheetTitle>
            <SheetDescription>Wybierz akcję</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-2 p-4">
            <Button variant="default" className="w-full justify-start" onClick={handleNewAnalysis}>
              <Plus className="h-4 w-4 mr-2" />
              Nowa analiza
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Wylogowywanie...
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4 mr-2" />
                  Wyloguj
                </>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
