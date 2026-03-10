import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Filter, FileText, UserPlus, Edit, Trash, Check, X, FileSpreadsheet } from "lucide-react";
import { exportToExcel, exportToCSV } from "@/lib/exportUtils";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Log = Tables<"logs">;

const Logs = () => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    filterLogs();
    // Clear selection when filter changes
    setSelectedIds(new Set());
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

  const allVisibleSelected =
    filteredLogs.length > 0 && filteredLogs.every((log) => selectedIds.has(log.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLogs.map((l) => l.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    setDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from("logs").delete().in("id", ids);
      if (error) throw error;
      toast.success(`تم حذف ${ids.length} سجل بنجاح`);
      setSelectedIds(new Set());
      setShowDeleteDialog(false);
      await fetchLogs();
    } catch (error: any) {
      toast.error("فشل حذف السجلات");
      console.error(error);
    } finally {
      setDeleting(false);
    }
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
          <div className="flex justify-between items-center">
            <CardTitle>البحث والفلترة</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToExcel(filteredLogs, "logs")}
              >
                <FileSpreadsheet className="ml-2 h-4 w-4" />
                Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCSV(filteredLogs, "logs")}
              >
                <FileText className="ml-2 h-4 w-4" />
                CSV
              </Button>
            </div>
          </div>
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
        {/* Bulk action bar */}
        {someSelected && (
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50">
            <span className="text-sm font-medium">
              تم تحديد <strong>{selectedIds.size}</strong> سجل
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash className="ml-2 h-4 w-4" />
              حذف المحدد
            </Button>
          </div>
        )}

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="تحديد الكل"
                  />
                </TableHead>
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
                  <TableCell colSpan={6} className="text-center py-8">
                    جاري التحميل...
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    لا توجد سجلات
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow
                    key={log.id}
                    className={selectedIds.has(log.id) ? "bg-muted/40" : ""}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(log.id)}
                        onCheckedChange={() => toggleSelect(log.id)}
                        aria-label="تحديد السجل"
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {format(new Date(log.created_at!), "dd MMM yyyy، HH:mm:ss", {
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
              <p className="text-2xl font-bold text-primary">{logs.length}</p>
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

      {/* Confirm delete dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف <strong>{selectedIds.size}</strong> سجل؟ هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelected}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "جاري الحذف..." : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Logs;
