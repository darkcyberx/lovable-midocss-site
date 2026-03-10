import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Edit, Trash2, FileSpreadsheet, FileText, Users, Building2, Mail, StickyNote, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { exportToExcel, exportToCSV } from "@/lib/exportUtils";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { customerSchema } from "@/lib/validations";
import { z } from "zod";
import { logActivity } from "@/lib/logger";

type Customer = Tables<"customers">;
type TelegramLink = { customer_id: string };

const Customers = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    notes: ""
  });

  const queryClient = useQueryClient();

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Customer[];
    }
  });

  // Fetch telegram links to show which customers are linked to the bot
  const { data: telegramLinks } = useQuery({
    queryKey: ["telegram-links"],
    queryFn: async () => {
      const { data } = await supabase.from("telegram_links").select("customer_id");
      return (data || []) as TelegramLink[];
    }
  });

  const linkedCustomerIds = new Set(telegramLinks?.map(l => l.customer_id) || []);

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: result, error } = await supabase.from("customers").insert([data]).select().single();
      if (error) throw error;
      return result;
    },
    onSuccess: async (data) => {
      await logActivity({
        action: "created",
        entityType: "customer",
        entityId: data.id,
        description: `تم إضافة عميل جديد: ${data.name}`
      });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("تم إضافة العميل بنجاح");
      handleCloseDialog();
    },
    onError: () => toast.error("فشل إضافة العميل")
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, name }: { id: string; data: typeof formData; name: string }) => {
      const { error } = await supabase.from("customers").update(data).eq("id", id);
      if (error) throw error;
      return name;
    },
    onSuccess: async (name) => {
      await logActivity({
        action: "updated",
        entityType: "customer",
        description: `تم تحديث عميل: ${name}`
      });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("تم تحديث العميل بنجاح");
      handleCloseDialog();
    },
    onError: () => toast.error("فشل تحديث العميل")
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
      return name;
    },
    onSuccess: async (name) => {
      await logActivity({
        action: "deleted",
        entityType: "customer",
        description: `تم حذف عميل: ${name}`
      });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("تم حذف العميل بنجاح");
    },
    onError: () => toast.error("فشل حذف العميل")
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const validated = customerSchema.parse(formData);
      if (editingCustomer) {
        updateMutation.mutate({ id: editingCustomer.id, data: validated as any, name: validated.name });
      } else {
        createMutation.mutate(validated as any);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email,
      phone: customer.phone || "",
      company: customer.company || "",
      notes: customer.notes || ""
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCustomer(null);
    setFormData({ name: "", email: "", phone: "", company: "", notes: "" });
  };

  const filteredCustomers = customers?.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.company?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalCustomers = customers?.length || 0;
  const linkedCount = linkedCustomerIds.size;
  const withCompany = customers?.filter(c => c.company).length || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">العملاء</h1>
          <p className="text-muted-foreground mt-1">إدارة بيانات العملاء</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportToExcel(filteredCustomers, "customers")}>
            <FileSpreadsheet className="ml-2 h-4 w-4" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportToCSV(filteredCustomers, "customers")}>
            <FileText className="ml-2 h-4 w-4" />
            CSV
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingCustomer(null)}>
                <Plus className="ml-2 h-4 w-4" />
                إضافة عميل
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl">
                  {editingCustomer ? "تعديل العميل" : "إضافة عميل جديد"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    الاسم *
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="أدخل اسم العميل"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    البريد الإلكتروني *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="example@email.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes" className="flex items-center gap-2">
                    <StickyNote className="h-4 w-4 text-muted-foreground" />
                    ملاحظات
                  </Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="ملاحظات إضافية..."
                    rows={3}
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="flex-1" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingCustomer ? "تحديث" : "إضافة"}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    إلغاء
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="rounded-xl bg-primary/15 p-3">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">إجمالي العملاء</p>
              <p className="text-2xl font-bold">{totalCustomers}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-gradient-to-br from-green-500/10 to-green-500/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="rounded-xl bg-green-500/15 p-3">
              <MessageCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">مربوطون بالبوت</p>
              <p className="text-2xl font-bold">{linkedCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="ابحث بالاسم أو البريد أو الشركة..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10"
        />
      </div>

      {/* Table */}
      <Card className="border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-semibold">العميل</TableHead>
              <TableHead className="font-semibold">البريد الإلكتروني</TableHead>
              <TableHead className="font-semibold">البوت</TableHead>
              <TableHead className="font-semibold text-left">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  جاري التحميل...
                </TableCell>
              </TableRow>
            ) : filteredCustomers?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Users className="h-10 w-10 opacity-30" />
                    <p>لا توجد عملاء</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredCustomers?.map((customer) => (
                <TableRow key={customer.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                        {customer.name.charAt(0)}
                      </div>
                      <span className="font-medium">{customer.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{customer.email}</TableCell>
                  <TableCell>
                    {linkedCustomerIds.has(customer.id) ? (
                      <Badge variant="default" className="bg-green-500/15 text-green-700 dark:text-green-400 hover:bg-green-500/20 border-none text-xs gap-1">
                        <MessageCircle className="h-3 w-3" />
                        مربوط
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <MessageCircle className="h-3 w-3 opacity-50" />
                        غير مربوط
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => handleEdit(customer)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("هل أنت متأكد من حذف هذا العميل؟")) {
                            deleteMutation.mutate({ id: customer.id, name: customer.name });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default Customers;
