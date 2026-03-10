import { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Trash2, ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Message = { role: "user" | "assistant"; content: string };

const QUICK_SUGGESTIONS = [
  "كم عدد التراخيص التي تنتهي هذا الأسبوع؟",
  "أعطني ملخص حالة النظام",
  "ما هي طلبات التجديد المعلقة؟",
  "كيف أضيف عميلاً جديداً؟",
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isLoading) return;

    const userMsg: Message = { role: "user", content };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("غير مسجل الدخول");

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-assistant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "خطأ غير معروف" }));
        if (resp.status === 429) {
          toast({ title: "تجاوزت الحد", description: err.error, variant: "destructive" });
        } else if (resp.status === 402) {
          toast({ title: "رصيد غير كافٍ", description: err.error, variant: "destructive" });
        } else {
          throw new Error(err.error ?? "فشل الاتصال");
        }
        setIsLoading(false);
        return;
      }

      let assistantContent = "";
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              setMessages(prev => prev.map((m, i) =>
                i === prev.length - 1 ? { ...m, content: assistantContent } : m
              ));
            }
          } catch { /* partial chunk, continue */ }
        }
      }
    } catch (e) {
      console.error(e);
      toast({ title: "خطأ", description: "فشل الاتصال بالمساعد الذكي", variant: "destructive" });
      setMessages(prev => prev.filter((_, i) => i !== prev.length - 1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {/* Floating toggle button */}
      <Button
        onClick={() => setOpen(v => !v)}
        size="icon"
        className={cn(
          "fixed bottom-6 left-6 z-50 h-14 w-14 rounded-full shadow-lg transition-all duration-300",
          "bg-primary hover:bg-primary/90",
          open && "scale-90"
        )}
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </Button>

      {/* Chat panel */}
      <div className={cn(
        "fixed bottom-24 left-6 z-50 w-[360px] flex flex-col rounded-2xl border bg-card shadow-2xl transition-all duration-300 overflow-hidden",
        open ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"
      )}
        style={{ maxHeight: "calc(100vh - 120px)", height: "560px" }}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-primary/5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">المساعد الذكي</p>
            <p className="text-xs text-muted-foreground">إدارة التراخيص والعملاء</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setMessages([])}
            title="مسح المحادثة"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setOpen(false)}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-medium">مرحباً! كيف يمكنني مساعدتك؟</p>
                <p className="text-xs text-muted-foreground mt-1">لديّ وصول لإحصائيات النظام الحالية</p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {QUICK_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-right text-xs rounded-lg border px-3 py-2 hover:bg-accent transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-start" : "justify-end"
              )}
            >
              <div className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted rounded-bl-sm"
              )}>
                {msg.content || (
                  <span className="flex gap-1 items-center">
                    <span className="animate-bounce">•</span>
                    <span className="animate-bounce [animation-delay:0.1s]">•</span>
                    <span className="animate-bounce [animation-delay:0.2s]">•</span>
                  </span>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t p-3">
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="اكتب سؤالك هنا..."
              className="min-h-[40px] max-h-[100px] resize-none text-sm"
              rows={1}
              disabled={isLoading}
            />
            <Button
              size="icon"
              onClick={() => send()}
              disabled={!input.trim() || isLoading}
              className="h-10 w-10 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Enter للإرسال • Shift+Enter لسطر جديد
          </p>
        </div>
      </div>
    </>
  );
}
