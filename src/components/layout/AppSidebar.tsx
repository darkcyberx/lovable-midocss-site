import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  KeyRound,
  Users,
  Package,
  Monitor,
  ScrollText,
  BarChart3,
  Settings,
  LogOut,
  KeySquare,
  Code2,
  Bell,
  Bot,
  ShoppingCart,
  Shield,
  MonitorPlay,
  ShieldAlert,
  Cpu,
  RadioTower,
  PackageOpen,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

const menuItems = [
  { title: "لوحة التحكم", url: "/dashboard", icon: LayoutDashboard },
  { title: "التراخيص", url: "/licenses", icon: KeyRound },
  { title: "العملاء", url: "/customers", icon: Users },
  { title: "المنتجات", url: "/products", icon: Package },
  { title: "الأجهزة", url: "/devices", icon: Monitor },
  { title: "RustDesk IDs", url: "/rustdesk-ids", icon: MonitorPlay },
  { title: "التقارير", url: "/reports", icon: BarChart3 },
  { title: "السجلات", url: "/logs", icon: ScrollText },
  { title: "بيانات الاعتماد", url: "/api-credentials", icon: Code2 },
  { title: "إعدادات الإشعارات", url: "/notification-settings", icon: Bell },
  { title: "بوت التليجرام", url: "/telegram-settings", icon: Bot },
  { title: "الطلبات", url: "/renewal-orders", icon: ShoppingCart },
  { title: "إدارة الـ IP", url: "/ip-management", icon: Shield },
  { title: "حجب الأجهزة (HWID)", url: "/blocked-hwids", icon: Cpu },
  { title: "التنبيهات الأمنية", url: "/alerts", icon: ShieldAlert },
  { title: "مراقبة الأداة القديمة", url: "/legacy-monitor", icon: RadioTower },
  { title: "الإعدادات", url: "/settings", icon: Settings },
  { title: "دليل نقل المشروع", url: "/migration-guide", icon: PackageOpen },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isCollapsed = state === "collapsed";

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "تم تسجيل الخروج",
        description: "إلى اللقاء!",
      });
      navigate("/auth");
    } catch (error) {
      toast({
        title: "حدث خطأ",
        description: "فشل تسجيل الخروج",
        variant: "destructive",
      });
    }
  };

  return (
    <Sidebar className={isCollapsed ? "w-16" : "w-64"}>
      <SidebarContent>
        <div className="p-4 flex items-center gap-3">
          <div className="p-2 bg-gradient-primary rounded-lg">
            <KeySquare className="h-6 w-6 text-white" />
          </div>
          {!isCollapsed && (
            <div>
              <h2 className="font-bold text-lg text-sidebar-foreground">License Manager</h2>
              <p className="text-xs text-sidebar-foreground/60">نظام إدارة التراخيص</p>
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>القائمة الرئيسية</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "hover:bg-sidebar-accent/50"
                        }`
                      }
                    >
                      <item.icon className="h-5 w-5" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          {!isCollapsed && <span>تسجيل الخروج</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
