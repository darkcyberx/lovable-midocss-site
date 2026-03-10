import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, Plus, Trash2, Power, PowerOff, ShieldOff, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

const codeExamples = {
  csharp: `using System;
using System.Net.Http;
using System.Threading.Tasks;
using System.Text.Json;

public class LicenseValidator
{
    private const string API_URL = "${window.location.origin.replace('5173', '54321')}/functions/v1/validate-license";
    private readonly string apiKey;
    
    public LicenseValidator(string apiKey)
    {
        this.apiKey = apiKey;
    }
    
    public async Task<bool> ValidateLicense(string licenseKey, string hwid = null)
    {
        using (var client = new HttpClient())
        {
            client.DefaultRequestHeaders.Add("x-api-key", apiKey);
            
            var payload = new { license_key = licenseKey, hwid = hwid };
            var content = new StringContent(
                JsonSerializer.Serialize(payload),
                System.Text.Encoding.UTF8,
                "application/json"
            );
            
            var response = await client.PostAsync(API_URL, content);
            var result = await response.Content.ReadAsStringAsync();
            var data = JsonSerializer.Deserialize<ValidationResponse>(result);
            
            return data?.valid ?? false;
        }
    }
}

public class ValidationResponse
{
    public bool valid { get; set; }
    public string error { get; set; }
}`,
  python: `import requests

class LicenseValidator:
    def __init__(self, api_key):
        self.api_url = "${window.location.origin.replace('5173', '54321')}/functions/v1/validate-license"
        self.api_key = api_key
    
    def validate_license(self, license_key, hwid=None):
        headers = {
            "x-api-key": self.api_key,
            "Content-Type": "application/json"
        }
        
        payload = {
            "license_key": license_key
        }
        if hwid:
            payload["hwid"] = hwid
        
        try:
            response = requests.post(
                self.api_url,
                json=payload,
                headers=headers
            )
            data = response.json()
            return data.get("valid", False)
        except Exception as e:
            print(f"Error: {e}")
            return False

# Usage
validator = LicenseValidator("YOUR_API_KEY")
is_valid = validator.validate_license("XXXX-XXXX-XXXX-XXXX", hwid="device123")`,
  javascript: `class LicenseValidator {
    constructor(apiKey) {
        this.apiUrl = "${window.location.origin.replace('5173', '54321')}/functions/v1/validate-license";
        this.apiKey = apiKey;
    }
    
    async validateLicense(licenseKey, hwid = null) {
        try {
            const payload = { license_key: licenseKey };
            if (hwid) payload.hwid = hwid;
            
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'x-api-key': this.apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            return data.valid || false;
        } catch (error) {
            console.error('Error:', error);
            return false;
        }
    }
}

// Usage
const validator = new LicenseValidator("YOUR_API_KEY");
const isValid = await validator.validateLicense("XXXX-XXXX-XXXX-XXXX", "device123");`,
  php: `<?php

class LicenseValidator {
    private $apiUrl = "${window.location.origin.replace('5173', '54321')}/functions/v1/validate-license";
    private $apiKey;
    
    public function __construct($apiKey) {
        $this->apiKey = $apiKey;
    }
    
    public function validateLicense($licenseKey, $hwid = null) {
        $payload = array("license_key" => $licenseKey);
        if ($hwid) {
            $payload["hwid"] = $hwid;
        }
        
        $options = array(
            "http" => array(
                "method" => "POST",
                "header" => "x-api-key: " . $this->apiKey . "\\r\\n" .
                           "Content-Type: application/json\\r\\n",
                "content" => json_encode($payload)
            )
        );
        
        $context = stream_context_create($options);
        $response = file_get_contents($this->apiUrl, false, $context);
        
        if ($response !== false) {
            $data = json_decode($response, true);
            return $data["valid"] ?? false;
        }
        return false;
    }
}

// Usage
$validator = new LicenseValidator("YOUR_API_KEY");
$isValid = $validator->validateLicense("XXXX-XXXX-XXXX-XXXX", "device123");
?>`,
};

const languages = [
  { key: "csharp", label: "C#" },
  { key: "python", label: "Python" },
  { key: "javascript", label: "JavaScript" },
  { key: "php", label: "PHP" }
];

interface ApiKey {
  id: string;
  name: string;
  key_masked: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export default function ApiCredentials() {
  const [copiedLang, setCopiedLang] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);
  const [killOldEndpoint, setKillOldEndpoint] = useState(false);
  const [killSwitchLoading, setKillSwitchLoading] = useState(false);
  const [killSwitchResponse, setKillSwitchResponse] = useState('{"valid":false,"error":"License not found","force_shutdown":true}');
  const [killSwitchResponseSaving, setKillSwitchResponseSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchApiKeys();
    fetchKillSwitch();
    const interval = setInterval(fetchApiKeys, 30000);
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchApiKeys();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const fetchApiKeys = async () => {
    try {
      // Use the safe view that only shows masked keys
      const { data, error } = await supabase
        .from('api_keys_safe')
        .select('id, user_id, name, key_masked, is_active, created_at, last_used_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApiKeys(data || []);
    } catch (error) {
      console.error('Error fetching API keys:', error);
      toast({
        title: "خطأ",
        description: "فشل تحميل مفاتيح API",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createApiKey = async () => {
    if (!newKeyName.trim()) {
      toast({
        title: "خطأ",
        description: "الرجاء إدخال اسم للمفتاح",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: keyData, error: keyError } = await supabase
        .rpc('generate_api_key');

      if (keyError) throw keyError;

      // Store only the hash (via trigger), not the plaintext key
      // The trigger hash_api_key() will hash it and then we clear it
      const { error: insertError } = await supabase
        .from('api_keys')
        .insert({
          user_id: user.id,
          name: newKeyName,
          key: keyData  // trigger will hash → key_hash, we rely on hash for validation
        });

      if (insertError) throw insertError;

      setCreatedKey(keyData);
      setNewKeyName("");
      fetchApiKeys();
      
      toast({
        title: "تم الإنشاء",
        description: "تم إنشاء مفتاح API بنجاح",
      });
    } catch (error) {
      console.error('Error creating API key:', error);
      toast({
        title: "خطأ",
        description: "فشل إنشاء مفتاح API",
        variant: "destructive",
      });
    }
  };

  const deleteApiKey = async (id: string) => {
    try {
      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', id);

      if (error) throw error;

      fetchApiKeys();
      toast({
        title: "تم الحذف",
        description: "تم حذف مفتاح API بنجاح",
      });
    } catch (error) {
      console.error('Error deleting API key:', error);
      toast({
        title: "خطأ",
        description: "فشل حذف مفتاح API",
        variant: "destructive",
      });
    } finally {
      setDeleteKeyId(null);
    }
  };

  const toggleApiKey = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('api_keys')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      fetchApiKeys();
      toast({
        title: currentStatus ? "تم التعطيل" : "تم التفعيل",
        description: currentStatus
          ? "مفتاح API معطّل — أي أداة تستخدمه ستحصل على force_shutdown"
          : "مفتاح API نشط الآن",
      });
    } catch (error) {
      console.error('Error toggling API key:', error);
      toast({
        title: "خطأ",
        description: "فشل تغيير حالة المفتاح",
        variant: "destructive",
      });
    }
  };

  // Keys are now always masked from the database for security

  const fetchKillSwitch = async () => {
    const { data } = await supabase
      .from('notification_settings')
      .select('kill_old_endpoint, kill_switch_response')
      .limit(1)
      .single();
    if (data) {
      setKillOldEndpoint(data.kill_old_endpoint ?? false);
      if (data.kill_switch_response) setKillSwitchResponse(data.kill_switch_response);
    }
  };

  const toggleKillSwitch = async (value: boolean) => {
    setKillSwitchLoading(true);
    try {
      const { error } = await supabase
        .from('notification_settings')
        .update({ kill_old_endpoint: value })
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      setKillOldEndpoint(value);
      toast({
        title: value ? "🔴 تم إيقاف الـ Endpoint القديم" : "🟢 تم تشغيل الـ Endpoint القديم",
        description: value
          ? "أي طلب للأداة القديمة سيحصل على الرد المخصص"
          : "الـ Endpoint القديم يعمل مجدداً",
      });
    } catch (error) {
      toast({ title: "خطأ", description: "فشل تغيير الإعداد", variant: "destructive" });
    } finally {
      setKillSwitchLoading(false);
    }
  };

  const saveKillSwitchResponse = async () => {
    // Validate JSON first
    try { JSON.parse(killSwitchResponse); } catch {
      toast({ title: "خطأ", description: "الرد المخصص ليس JSON صالح", variant: "destructive" });
      return;
    }
    setKillSwitchResponseSaving(true);
    try {
      const { error } = await supabase
        .from('notification_settings')
        .update({ kill_switch_response: killSwitchResponse })
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      toast({ title: "✅ تم الحفظ", description: "تم حفظ الرد المخصص بنجاح" });
    } catch {
      toast({ title: "خطأ", description: "فشل حفظ الرد المخصص", variant: "destructive" });
    } finally {
      setKillSwitchResponseSaving(false);
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLang(type);
    toast({
      title: "تم النسخ",
      description: "تم نسخ المحتوى بنجاح",
    });
    setTimeout(() => setCopiedLang(null), 2000);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">بيانات اعتماد التطبيق</h1>
          <p className="text-muted-foreground">
            إدارة مفاتيح API وأمثلة التكامل
          </p>
        </div>
        <Dialog open={showNewKeyDialog} onOpenChange={setShowNewKeyDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 ml-2" />
              إنشاء مفتاح جديد
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إنشاء مفتاح API جديد</DialogTitle>
              <DialogDescription>
                أدخل اسماً وصفياً لهذا المفتاح
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="keyName">اسم المفتاح</Label>
                <Input
                  id="keyName"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="مثال: تطبيق سطح المكتب"
                />
              </div>
              {createdKey && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">المفتاح الجديد:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 bg-background rounded text-sm break-all">
                      {createdKey}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(createdKey, 'new-key')}
                    >
                      {copiedLang === 'new-key' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-sm text-destructive mt-2">
                    ⚠️ احفظ هذا المفتاح الآن! لن تتمكن من رؤيته مرة أخرى
                  </p>
                </div>
              )}
              <Button onClick={createApiKey} className="w-full">
                إنشاء المفتاح
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Kill Switch Card */}
      <Card className={killOldEndpoint ? "border-destructive" : "border-border"}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {killOldEndpoint
                ? <ShieldOff className="h-5 w-5 text-destructive" />
                : <Shield className="h-5 w-5 text-primary" />
              }
              <div>
                <CardTitle className="text-base">مفتاح إيقاف الـ Endpoint القديم</CardTitle>
                <CardDescription className="mt-1">
                  {killOldEndpoint
                    ? "🔴 الـ Endpoint القديم موقوف — أي أداة قديمة تحصل على الرد المخصص فوراً"
                    : "🟢 الـ Endpoint القديم يعمل — يمكن للأدوات القديمة الاتصال به حالياً"
                  }
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {killOldEndpoint ? "موقوف" : "يعمل"}
              </span>
              <Switch
                checked={killOldEndpoint}
                onCheckedChange={toggleKillSwitch}
                disabled={killSwitchLoading}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium mb-1">🔴 Endpoint قديم (للأداة القديمة)</p>
              <code className="text-xs text-muted-foreground break-all">.../functions/v1/validate-license</code>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium mb-1">🟢 Endpoint جديد (للأداة الجديدة)</p>
              <code className="text-xs text-muted-foreground break-all">.../functions/v1/validate-v2</code>
            </div>
          </div>
          {/* Custom kill switch response */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">الرد المخصص عند الإيقاف (JSON)</Label>
            <p className="text-xs text-muted-foreground">
              هذا الرد هو اللي بيرجع للأداة القديمة لما تحاول تتصل — اكتب أي رد يخليها توقف (مثل: License not found أو Invalid key).
            </p>
            <div className="flex gap-2">
              <textarea
                className="flex-1 min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                value={killSwitchResponse}
                onChange={(e) => setKillSwitchResponse(e.target.value)}
                placeholder='{"valid":false,"error":"License not found"}'
                dir="ltr"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => setKillSwitchResponse('{"valid":false,"error":"License not found"}')}>
                License not found
              </Button>
              <Button size="sm" variant="outline" onClick={() => setKillSwitchResponse('{"valid":false,"error":"Invalid license key","force_shutdown":true}')}>
                Invalid + Shutdown
              </Button>
              <Button size="sm" variant="outline" onClick={() => setKillSwitchResponse('{"valid":false}')}>
                فقط valid: false
              </Button>
              <Button
                size="sm"
                onClick={saveKillSwitchResponse}
                disabled={killSwitchResponseSaving}
                className="mr-auto"
              >
                {killSwitchResponseSaving ? "جاري الحفظ..." : "حفظ الرد"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>مفاتيح API الخاصة بك</CardTitle>
          <CardDescription>
            استخدم هذه المفاتيح للتكامل مع نظام التراخيص
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground">جاري التحميل...</p>
          ) : apiKeys.length === 0 ? (
            <p className="text-center text-muted-foreground">لا توجد مفاتيح API. أنشئ مفتاحاً للبدء</p>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((apiKey) => (
                <div
                  key={apiKey.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{apiKey.name}</p>
                      <Badge variant={apiKey.is_active ? "default" : "destructive"} className="text-xs">
                        {apiKey.is_active ? "نشط" : "معطّل"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-sm text-muted-foreground">
                        {apiKey.key_masked}
                      </code>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      آخر استخدام: {apiKey.last_used_at ? new Date(apiKey.last_used_at).toLocaleDateString('ar-SA') : 'لم يستخدم بعد'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={apiKey.is_active ? "outline" : "outline"}
                      className={apiKey.is_active
                        ? "border-yellow-500 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-950"
                        : "border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                      }
                      onClick={() => toggleApiKey(apiKey.id, apiKey.is_active ?? true)}
                    >
                      {apiKey.is_active ? (
                        <><PowerOff className="h-4 w-4 ml-1" /> تعطيل</>
                      ) : (
                        <><Power className="h-4 w-4 ml-1" /> تفعيل</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteKeyId(apiKey.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>عنوان API</CardTitle>
          <CardDescription>استخدم هذا العنوان للتحقق من التراخيص</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-3 bg-muted rounded-lg text-sm break-all">
              {window.location.origin.replace('5173', '54321')}/functions/v1/validate-license
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(
                `${window.location.origin.replace('5173', '54321')}/functions/v1/validate-license`,
                'api-url'
              )}
            >
              {copiedLang === 'api-url' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>أمثلة الكود</CardTitle>
          <CardDescription>
            استبدل YOUR_API_KEY بمفتاح API الخاص بك
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="csharp" dir="rtl">
            <TabsList className="grid grid-cols-4 w-full">
              {languages.map((lang) => (
                <TabsTrigger key={lang.key} value={lang.key}>
                  {lang.label}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {languages.map((lang) => (
              <TabsContent key={lang.key} value={lang.key} className="relative">
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-2 left-2 z-10"
                    onClick={() => copyToClipboard(codeExamples[lang.key as keyof typeof codeExamples], lang.key)}
                  >
                    {copiedLang === lang.key ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm max-h-96">
                    <code>{codeExamples[lang.key as keyof typeof codeExamples]}</code>
                  </pre>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ملاحظات هامة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• احتفظ بمفتاح API في مكان آمن ولا تشاركه مع الآخرين</p>
          <p>• استخدم HTTPS دائماً عند الاتصال بـ API</p>
          <p>• يتم التحقق تلقائياً من التراخيص وتسجيل الأجهزة</p>
          <p>• يمكنك تمرير HWID للتحقق من الأجهزة المسموح بها</p>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteKeyId} onOpenChange={() => setDeleteKeyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف هذا المفتاح نهائياً ولن يعمل في أي تطبيقات تستخدمه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteKeyId && deleteApiKey(deleteKeyId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}