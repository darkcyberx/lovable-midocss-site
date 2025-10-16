import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, Plus, Trash2, Eye, EyeOff } from "lucide-react";
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
  key: string;
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
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
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

      const { error: insertError } = await supabase
        .from('api_keys')
        .insert({
          user_id: user.id,
          name: newKeyName,
          key: keyData
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

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys(prev => {
      const newSet = new Set(prev);
      if (newSet.has(keyId)) {
        newSet.delete(keyId);
      } else {
        newSet.add(keyId);
      }
      return newSet;
    });
  };

  const maskKey = (key: string) => {
    return key.substring(0, 8) + '...' + key.substring(key.length - 4);
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
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium">{key.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-sm text-muted-foreground">
                        {visibleKeys.has(key.id) ? key.key : maskKey(key.key)}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleKeyVisibility(key.id)}
                      >
                        {visibleKeys.has(key.id) ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      آخر استخدام: {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString('ar-SA') : 'لم يستخدم بعد'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(key.key, key.id)}
                    >
                      {copiedLang === key.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteKeyId(key.id)}
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