import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const codeExamples = {
  csharp: `using System;
using System.Net.Http;
using System.Threading.Tasks;

public class LicenseValidator
{
    private const string API_URL = "YOUR_API_URL";
    private const string API_KEY = "YOUR_API_KEY";
    
    public async Task<bool> ValidateLicense(string licenseKey)
    {
        using (var client = new HttpClient())
        {
            client.DefaultRequestHeaders.Add("Authorization", $"Bearer {API_KEY}");
            
            var response = await client.GetAsync(
                $"{API_URL}/validate?key={licenseKey}"
            );
            
            return response.IsSuccessStatusCode;
        }
    }
}`,
  cpp: `#include <iostream>
#include <curl/curl.h>

class LicenseValidator {
private:
    const char* API_URL = "YOUR_API_URL";
    const char* API_KEY = "YOUR_API_KEY";
    
public:
    bool validateLicense(const char* licenseKey) {
        CURL *curl;
        CURLcode res;
        bool isValid = false;
        
        curl = curl_easy_init();
        if(curl) {
            char url[256];
            sprintf(url, "%s/validate?key=%s", API_URL, licenseKey);
            
            struct curl_slist *headers = NULL;
            char auth[256];
            sprintf(auth, "Authorization: Bearer %s", API_KEY);
            headers = curl_slist_append(headers, auth);
            
            curl_easy_setopt(curl, CURLOPT_URL, url);
            curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
            
            res = curl_easy_perform(curl);
            isValid = (res == CURLE_OK);
            
            curl_easy_cleanup(curl);
        }
        return isValid;
    }
};`,
  python: `import requests

class LicenseValidator:
    def __init__(self):
        self.api_url = "YOUR_API_URL"
        self.api_key = "YOUR_API_KEY"
    
    def validate_license(self, license_key):
        headers = {
            "Authorization": f"Bearer {self.api_key}"
        }
        
        try:
            response = requests.get(
                f"{self.api_url}/validate",
                params={"key": license_key},
                headers=headers
            )
            return response.status_code == 200
        except Exception as e:
            print(f"Error: {e}")
            return False

# Usage
validator = LicenseValidator()
is_valid = validator.validate_license("XXXX-XXXX-XXXX-XXXX")`,
  php: `<?php

class LicenseValidator {
    private $apiUrl = "YOUR_API_URL";
    private $apiKey = "YOUR_API_KEY";
    
    public function validateLicense($licenseKey) {
        $url = $this->apiUrl . "/validate?key=" . urlencode($licenseKey);
        
        $options = [
            "http" => [
                "header" => "Authorization: Bearer " . $this->apiKey
            ]
        ];
        
        $context = stream_context_create($options);
        $response = file_get_contents($url, false, $context);
        
        return $response !== false;
    }
}

// Usage
$validator = new LicenseValidator();
$isValid = $validator->validateLicense("XXXX-XXXX-XXXX-XXXX");
?>`,
  javascript: `class LicenseValidator {
    constructor() {
        this.apiUrl = "YOUR_API_URL";
        this.apiKey = "YOUR_API_KEY";
    }
    
    async validateLicense(licenseKey) {
        try {
            const response = await fetch(
                \`\${this.apiUrl}/validate?key=\${licenseKey}\`,
                {
                    headers: {
                        'Authorization': \`Bearer \${this.apiKey}\`
                    }
                }
            );
            
            return response.ok;
        } catch (error) {
            console.error('Error:', error);
            return false;
        }
    }
}

// Usage
const validator = new LicenseValidator();
const isValid = await validator.validateLicense("XXXX-XXXX-XXXX-XXXX");`,
  java: `import java.net.HttpURLConnection;
import java.net.URL;

public class LicenseValidator {
    private static final String API_URL = "YOUR_API_URL";
    private static final String API_KEY = "YOUR_API_KEY";
    
    public boolean validateLicense(String licenseKey) {
        try {
            URL url = new URL(API_URL + "/validate?key=" + licenseKey);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + API_KEY);
            
            int responseCode = conn.getResponseCode();
            return responseCode == 200;
            
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }
    
    public static void main(String[] args) {
        LicenseValidator validator = new LicenseValidator();
        boolean isValid = validator.validateLicense("XXXX-XXXX-XXXX-XXXX");
    }
}`,
  vbnet: `Imports System.Net.Http
Imports System.Threading.Tasks

Public Class LicenseValidator
    Private Const API_URL As String = "YOUR_API_URL"
    Private Const API_KEY As String = "YOUR_API_KEY"
    
    Public Async Function ValidateLicense(licenseKey As String) As Task(Of Boolean)
        Using client As New HttpClient()
            client.DefaultRequestHeaders.Add("Authorization", $"Bearer {API_KEY}")
            
            Dim response = Await client.GetAsync(
                $"{API_URL}/validate?key={licenseKey}"
            )
            
            Return response.IsSuccessStatusCode
        End Using
    End Function
End Class

' Usage
Dim validator As New LicenseValidator()
Dim isValid = Await validator.ValidateLicense("XXXX-XXXX-XXXX-XXXX")`
};

const languages = [
  { key: "csharp", label: "C#" },
  { key: "cpp", label: "C++" },
  { key: "python", label: "Python" },
  { key: "php", label: "PHP" },
  { key: "javascript", label: "JavaScript" },
  { key: "java", label: "Java" },
  { key: "vbnet", label: "VB.Net" }
];

export default function ApiCredentials() {
  const [copiedLang, setCopiedLang] = useState<string | null>(null);
  const { toast } = useToast();

  const copyToClipboard = (code: string, lang: string) => {
    navigator.clipboard.writeText(code);
    setCopiedLang(lang);
    toast({
      title: "تم النسخ",
      description: "تم نسخ الكود بنجاح",
    });
    setTimeout(() => setCopiedLang(null), 2000);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">بيانات اعتماد التطبيق</h1>
        <p className="text-muted-foreground">
          استخدم هذه الأمثلة للتكامل مع نظام التراخيص في تطبيقك
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>أمثلة الكود</CardTitle>
          <CardDescription>
            ببساطة استبدل الكود النموذجي بالقيم الخاصة بك (YOUR_API_URL و YOUR_API_KEY)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="csharp" dir="rtl">
            <TabsList className="grid grid-cols-7 w-full">
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
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
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
          <p>• استبدل YOUR_API_URL بعنوان API الخاص بك</p>
          <p>• استبدل YOUR_API_KEY بمفتاح API الخاص بك</p>
          <p>• احتفظ بمفتاح API في مكان آمن ولا تشاركه مع الآخرين</p>
          <p>• استخدم HTTPS دائماً عند الاتصال بـ API</p>
        </CardContent>
      </Card>
    </div>
  );
}