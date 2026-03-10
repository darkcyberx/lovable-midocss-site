import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Cpu, Plus, Trash2, ShieldOff, Copy } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export default function BlockedHwids() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newHwid, setNewHwid] = useState("");
  const [newReason, setNewReason] = useState("");
  const [adding, setAdding] = useState(false);

  const { data: blockedHwids, isLoading } = useQuery({
    queryKey: ["blocked_hwids"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocked_hwids")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async ({ hwid, reason }: { hwid: string; reason: string }) => {
      const { error } = await supabase
        .from("blocked_hwids")
        .insert({ hwid: hwid.trim(), reason: reason.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocked_hwids"] });
      setNewHwid("");
      setNewReason("");
      setAdding(false);
      toast({ title: "✅ تم حجب الجهاز", description: "سيتم رفض أي محاولة تفعيل من هذا الجهاز فوراً" });
    },
    onError: (e: Error) => {
      toast({ title: "خطأ", description: e.message.includes("unique") ? "هذا الـ HWID محجوب بالفعل" : e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("blocked_hwids").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocked_hwids"] });
      toast({ title: "تم رفع الحجب عن الجهاز" });
    },
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-destructive/10 rounded-lg">
            <Cpu className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">حجب الأجهزة (HWID)</h1>
            <p className="text-sm text-muted-foreground">حجب الأجهزة على مستوى الهاردوير — يُوقف الأداة فوراً بغض النظر عن المفتاح</p>
          </div>
        </div>
        <Button onClick={() => setAdding(!adding)} variant={adding ? "outline" : "destructive"} className="gap-2">
          <Plus className="h-4 w-4" />
          حجب جهاز جديد
        </Button>
      </div>

      {adding && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-base text-destructive flex items-center gap-2">
              <ShieldOff className="h-4 w-4" />
              إضافة HWID للقائمة السوداء
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">HWID الجهاز *</label>
              <Input
                placeholder="مثال: 64e6c764e10edc7d905d449f48f9ac8dbac67cd..."
                value={newHwid}
                onChange={(e) => setNewHwid(e.target.value)}
                className="font-mono text-sm"
                dir="ltr"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">سبب الحجب (اختياري)</label>
              <Input
                placeholder="مثال: بسام محمد - استخدام غير مصرح"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                variant="destructive"
                className="gap-2"
                disabled={!newHwid.trim() || addMutation.isPending}
                onClick={() => addMutation.mutate({ hwid: newHwid, reason: newReason })}
              >
                <ShieldOff className="h-4 w-4" />
                {addMutation.isPending ? "جاري الحجب..." : "حجب الجهاز"}
              </Button>
              <Button variant="outline" onClick={() => setAdding(false)}>إلغاء</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>الأجهزة المحجوبة</span>
            <Badge variant="destructive">{blockedHwids?.length ?? 0} جهاز</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
          ) : !blockedHwids?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <Cpu className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>لا توجد أجهزة محجوبة</p>
            </div>
          ) : (
            <div className="space-y-3">
              {blockedHwids.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border bg-destructive/5 border-destructive/20 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Cpu className="h-5 w-5 text-destructive shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-foreground truncate max-w-xs block" dir="ltr">
                          {item.hwid}
                        </code>
                        <button
                          onClick={() => { navigator.clipboard.writeText(item.hwid); toast({ title: "تم النسخ" }); }}
                          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                      {item.reason && <p className="text-xs text-muted-foreground mt-0.5">{item.reason}</p>}
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        {format(new Date(item.created_at), "d MMM yyyy - HH:mm", { locale: ar })}
                      </p>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>رفع الحجب عن الجهاز؟</AlertDialogTitle>
                        <AlertDialogDescription>
                          سيتمكن هذا الجهاز من محاولة التفعيل مرة أخرى. هل أنت متأكد؟
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(item.id)}>
                          رفع الحجب
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
