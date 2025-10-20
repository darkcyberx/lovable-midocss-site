import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, FileText, UserPlus, Edit, Trash, Check, X } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type Log = Tables<"logs">;

const Logs = () => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    filterLogs();
  }, [searchTerm, actionFilter, logs]);

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from("logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterLogs = () => {
    let filtered = logs;

    if (searchTerm) {
      filtered = filtered.filter(
        (log) =>
          log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.entity_type.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (actionFilter !== "all") {
      filtered = filtered.filter((log) => log.action === actionFilter);
    }

    setFilteredLogs(filtered);
  };

  const getActionIcon = (action: string) => {
    const icons: Record<string, any> = {
      created: FileText,
      updated: Edit,
      deleted: Trash,
      verified: Check,
      activated: UserPlus,
      deactivated: X,
    };
    const Icon = icons[action] || FileText;
    return <Icon className="h-4 w-4" />;
  };

  const getActionBadge = (action: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      created: "default",
      updated: "secondary",
      deleted: "destructive",
      verified: "outline",
      activated: "default",
      deactivated: "destructive",
    };

    const labels: Record<string, string> = {
      created: "إنشاء",
      updated: "تحديث",
      deleted: "حذف",
      verified: "تحقق",
      activated: "تفعيل",
      deactivated: "تعطيل",
    };

    return (
      <Badge variant={variants[action] || "default"}>
        <span className="flex items-center gap-1">
          {getActionIcon(action)}
          {labels[action] || action}
        </span>
      </Badge>
    );
  };

  const getEntityTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      license: "ترخيص",
      customer: "عميل",
      product: "منتج",
      device: "جهاز",
      api_key: "مفتاح API",
      user: "مستخدم",
      system: "النظام",
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold mb-2">السجلات</h1>
        <p className="text-muted-foreground">تتبع جميع الأنشطة والعمليات في النظام</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>البحث والفلترة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ابحث في السجلات..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 ml-2" />
                <SelectValue placeholder="نوع الإجراء" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الإجراءات</SelectItem>
                <SelectItem value="created">إنشاء</SelectItem>
                <SelectItem value="updated">تحديث</SelectItem>
                <SelectItem value="deleted">حذف</SelectItem>
                <SelectItem value="verified">تحقق</SelectItem>
                <SelectItem value="activated">تفعيل</SelectItem>
                <SelectItem value="deactivated">تعطيل</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ والوقت</TableHead>
                <TableHead>الإجراء</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>الوصف</TableHead>
                <TableHead>عنوان IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    جاري التحميل...
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    لا توجد سجلات
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-sm">
                      {format(new Date(log.created_at), "dd MMM yyyy، HH:mm:ss", {
                        locale: ar,
                      })}
                    </TableCell>
                    <TableCell>{getActionBadge(log.action)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getEntityTypeLabel(log.entity_type)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="truncate">{log.description}</p>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {log.ip_address || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>الإحصائيات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">
                {logs.length}
              </p>
              <p className="text-sm text-muted-foreground">إجمالي السجلات</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-success">
                {logs.filter((l) => l.action === "created").length}
              </p>
              <p className="text-sm text-muted-foreground">عمليات إنشاء</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-info">
                {logs.filter((l) => l.action === "updated").length}
              </p>
              <p className="text-sm text-muted-foreground">عمليات تحديث</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-destructive">
                {logs.filter((l) => l.action === "deleted").length}
              </p>
              <p className="text-sm text-muted-foreground">عمليات حذف</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Logs;
