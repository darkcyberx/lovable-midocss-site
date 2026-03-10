import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ThemeToggle } from "./ThemeToggle";
import { AiAssistant } from "@/components/ai/AiAssistant";
import { NotificationBell } from "./NotificationBell";
import { User } from "@supabase/supabase-js";

export const DashboardLayout = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const navigate = useNavigate();

  const checkAdminRole = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .single();
    
    if (!data) {
      await supabase.auth.signOut();
      navigate("/auth");
      return false;
    }
    return true;
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (!session) {
          setIsAdmin(null);
          navigate("/auth");
        } else {
          setTimeout(() => {
            checkAdminRole(session.user.id).then(setIsAdmin);
          }, 0);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) {
        setIsAdmin(null);
        navigate("/auth");
      } else {
        checkAdminRole(session.user.id).then(setIsAdmin);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (!user || isAdmin === null) {
    return null;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          <header className="h-16 border-b bg-card/50 backdrop-blur-sm flex items-center px-6 gap-4 sticky top-0 z-10 transition-colors">
            <SidebarTrigger />
            <div className="flex-1" />
            <NotificationBell />
            <ThemeToggle />
          </header>
          <div className="flex-1 p-6 transition-colors">
            <Outlet />
          </div>
        </main>
      </div>
      <AiAssistant />
    </SidebarProvider>
  );
};
