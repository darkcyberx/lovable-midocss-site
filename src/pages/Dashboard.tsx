import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { KeyRound, Users, Package, Monitor, TrendingUp, AlertCircle } from "lucide-react";
import { StatCard } from "@/components/DashboardStats";
import { LicenseChart } from "@/components/LicenseChart";
import { RecentActivity } from "@/components/RecentActivity";

interface Stats {
  totalLicenses: number;
  activeLicenses: number;
  expiredLicenses: number;
  pendingLicenses: number;
  suspendedLicenses: number;
  totalCustomers: number;
  totalProducts: number;
  totalDevices: number;
  expiringSoon: number;
}

interface Log {
  id: string;
  action: string;
  description: string;
  created_at: string;
  entity_type: string;
}

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalLicenses: 0,
    activeLicenses: 0,
    expiredLicenses: 0,
    pendingLicenses: 0,
    suspendedLicenses: 0,
    totalCustomers: 0,
    totalProducts: 0,
    totalDevices: 0,
    expiringSoon: 0,
  });
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [licenses, customers, products, devices, recentLogs] = await Promise.all([
        supabase.from("licenses").select("*"),
        supabase.from("customers").select("id"),
        supabase.from("products").select("id"),
        supabase.from("devices").select("id"),
        supabase.from("logs").select("*").order("created_at", { ascending: false }).limit(10),
      ]);

      const activeLicenses = licenses.data?.filter((l) => l.status === "active").length || 0;
      const expiredLicenses = licenses.data?.filter((l) => l.status === "expired").length || 0;
      const pendingLicenses = licenses.data?.filter((l) => l.status === "pending").length || 0;
      const suspendedLicenses = licenses.data?.filter((l) => l.status === "suspended").length || 0;
      
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const expiringSoon = licenses.data?.filter(
        (l) => l.expire_at && new Date(l.expire_at) <= thirtyDaysFromNow && l.status === "active"
      ).length || 0;

      setStats({
        totalLicenses: licenses.data?.length || 0,
        activeLicenses,
        expiredLicenses,
        pendingLicenses,
        suspendedLicenses,
        totalCustomers: customers.data?.length || 0,
        totalProducts: products.data?.length || 0,
        totalDevices: devices.data?.length || 0,
        expiringSoon,
      });

      setLogs(recentLogs.data || []);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "إجمالي التراخيص",
      value: stats.totalLicenses,
      icon: KeyRound,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "التراخيص النشطة",
      value: stats.activeLicenses,
      icon: TrendingUp,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "العملاء",
      value: stats.totalCustomers,
      icon: Users,
      color: "text-info",
      bgColor: "bg-info/10",
    },
    {
      title: "المنتجات",
      value: stats.totalProducts,
      icon: Package,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "الأجهزة المسجلة",
      value: stats.totalDevices,
      icon: Monitor,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "تنتهي قريباً",
      value: stats.expiringSoon,
      icon: AlertCircle,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold mb-2">لوحة التحكم</h1>
        <p className="text-muted-foreground">نظرة عامة على نظام إدارة التراخيص</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((card, index) => (
          <StatCard
            key={card.title}
            {...card}
            index={index}
            loading={loading}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LicenseChart
          active={stats.activeLicenses}
          expired={stats.expiredLicenses}
          pending={stats.pendingLicenses}
          suspended={stats.suspendedLicenses}
        />
        <RecentActivity logs={logs} loading={loading} />
      </div>
    </div>
  );
};

export default Dashboard;
