import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { FileText, TrendingUp, Users, Package, HardDrive, Activity } from "lucide-react";

interface Stats {
  totalLicenses: number;
  activeLicenses: number;
  expiredLicenses: number;
  suspendedLicenses: number;
  totalCustomers: number;
  totalProducts: number;
  totalDevices: number;
  activeDevices: number;
}

const Reports = () => {
  const [stats, setStats] = useState<Stats>({
    totalLicenses: 0,
    activeLicenses: 0,
    expiredLicenses: 0,
    suspendedLicenses: 0,
    totalCustomers: 0,
    totalProducts: 0,
    totalDevices: 0,
    activeDevices: 0
  });
  const [licensesByProduct, setLicensesByProduct] = useState<any[]>([]);
  const [licensesByStatus, setLicensesByStatus] = useState<any[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<any[]>([]);

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    try {
      // إحصائيات التراخيص
      const { data: licenses } = await supabase.from("licenses").select("status, product_id, created_at");
      
      // إحصائيات العملاء
      const { data: customers } = await supabase.from("customers").select("id");
      
      // إحصائيات المنتجات
      const { data: products } = await supabase.from("products").select("id, name");
      
      // إحصائيات الأجهزة
      const { data: devices } = await supabase.from("devices").select("is_active");

      if (licenses) {
        const activeLicenses = licenses.filter(l => l.status === "active").length;
        const expiredLicenses = licenses.filter(l => l.status === "expired").length;
        const suspendedLicenses = licenses.filter(l => l.status === "suspended").length;

        setStats({
          totalLicenses: licenses.length,
          activeLicenses,
          expiredLicenses,
          suspendedLicenses,
          totalCustomers: customers?.length || 0,
          totalProducts: products?.length || 0,
          totalDevices: devices?.length || 0,
          activeDevices: devices?.filter(d => d.is_active).length || 0
        });

        // التراخيص حسب الحالة
        setLicensesByStatus([
          { name: "نشط", value: activeLicenses, color: "#10b981" },
          { name: "منتهي", value: expiredLicenses, color: "#ef4444" },
          { name: "معلق", value: suspendedLicenses, color: "#f59e0b" },
          { name: "قيد الانتظار", value: licenses.filter(l => l.status === "pending").length, color: "#6b7280" }
        ]);

        // التراخيص حسب المنتج
        const productCounts = products?.map(product => ({
          name: product.name,
          count: licenses.filter(l => l.product_id === product.id).length
        })) || [];
        setLicensesByProduct(productCounts);

        // الاتجاه الشهري
        const monthlyData: { [key: string]: number } = {};
        licenses.forEach(license => {
          const month = new Date(license.created_at).toLocaleDateString("ar", { month: "short", year: "numeric" });
          monthlyData[month] = (monthlyData[month] || 0) + 1;
        });
        
        const trendData = Object.entries(monthlyData).map(([month, count]) => ({
          month,
          count
        })).slice(-6);
        setMonthlyTrend(trendData);
      }
    } catch (error) {
      console.error("Error fetching report data:", error);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold mb-2">التقارير والإحصائيات</h1>
        <p className="text-muted-foreground">عرض شامل لإحصائيات النظام</p>
      </div>

      {/* بطاقات الإحصائيات الرئيسية */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي التراخيص</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLicenses}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-success">{stats.activeLicenses} نشط</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">العملاء</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCustomers}</div>
            <p className="text-xs text-muted-foreground mt-1">إجمالي العملاء المسجلين</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">المنتجات</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
            <p className="text-xs text-muted-foreground mt-1">المنتجات المتاحة</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">الأجهزة</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDevices}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-success">{stats.activeDevices} نشط</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* الرسوم البيانية */}
      <Tabs defaultValue="status" className="space-y-4">
        <TabsList>
          <TabsTrigger value="status">حسب الحالة</TabsTrigger>
          <TabsTrigger value="product">حسب المنتج</TabsTrigger>
          <TabsTrigger value="trend">الاتجاه الشهري</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>توزيع التراخيص حسب الحالة</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={licensesByStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {licensesByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              
              <div className="flex flex-wrap gap-4 mt-6 justify-center">
                {licensesByStatus.map((status, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }} />
                    <span className="text-sm">{status.name}: {status.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="product" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>التراخيص حسب المنتج</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={licensesByProduct}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="hsl(var(--primary))" name="عدد التراخيص" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trend" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>اتجاه إنشاء التراخيص (آخر 6 أشهر)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} name="التراخيص الجديدة" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ملخص الحالات */}
      <Card>
        <CardHeader>
          <CardTitle>ملخص حالات التراخيص</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-success" />
                <span className="font-medium">تراخيص نشطة</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default">{stats.activeLicenses}</Badge>
                <span className="text-sm text-muted-foreground">
                  {stats.totalLicenses > 0 ? ((stats.activeLicenses / stats.totalLicenses) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-destructive" />
                <span className="font-medium">تراخيص منتهية</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="destructive">{stats.expiredLicenses}</Badge>
                <span className="text-sm text-muted-foreground">
                  {stats.totalLicenses > 0 ? ((stats.expiredLicenses / stats.totalLicenses) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-yellow-500" />
                <span className="font-medium">تراخيص معلقة</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{stats.suspendedLicenses}</Badge>
                <span className="text-sm text-muted-foreground">
                  {stats.totalLicenses > 0 ? ((stats.suspendedLicenses / stats.totalLicenses) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
