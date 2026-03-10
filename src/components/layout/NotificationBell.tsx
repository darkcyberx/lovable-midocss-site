import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, X, Shield, Cpu, Clock, RefreshCw, ChevronRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useSecurityAlerts, SecurityAlert } from "@/hooks/useSecurityAlerts";
import { useQueryClient } from "@tanstack/react-query";

const alertIcons: Record<SecurityAlert["type"], React.ReactNode> = {
  suspicious_ip: <Shield className="h-4 w-4" />,
  shared_hwid: <Cpu className="h-4 w-4" />,
  expiring_license: <Clock className="h-4 w-4" />,
  pending_renewal: <AlertTriangle className="h-4 w-4" />,
};

const severityConfig: Record<
  SecurityAlert["severity"],
  { dot: string; bg: string; border: string; text: string; badge: string }
> = {
  high: {
    dot: "bg-destructive",
    bg: "bg-destructive/5 hover:bg-destructive/10",
    border: "border-destructive/20",
    text: "text-destructive",
    badge: "bg-destructive text-destructive-foreground",
  },
  medium: {
    dot: "bg-warning",
    bg: "bg-warning/5 hover:bg-warning/10",
    border: "border-warning/20",
    text: "text-warning-foreground",
    badge: "bg-warning text-warning-foreground",
  },
  low: {
    dot: "bg-primary",
    bg: "bg-primary/5 hover:bg-primary/10",
    border: "border-primary/20",
    text: "text-primary",
    badge: "bg-primary text-primary-foreground",
  },
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: alerts = [], isLoading, isRefetching } = useSecurityAlerts();

  // Dismiss state (per-session — stored in memory)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = alerts.filter((a) => !dismissed.has(a.id));
  const highCount = visible.filter((a) => a.severity === "high").length;
  const totalCount = visible.length;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const dismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed((prev) => new Set([...prev, id]));
  };

  const handleAlertClick = (alert: SecurityAlert) => {
    setOpen(false);
    navigate(alert.link);
  };

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    queryClient.invalidateQueries({ queryKey: ["security-alerts"] });
  };

  return (
    <div className="relative" ref={ref}>
      {/* Bell Button */}
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        onClick={() => setOpen((v) => !v)}
        aria-label="الإشعارات"
      >
        <Bell className={cn("h-4 w-4", highCount > 0 && "text-destructive")} />
        {totalCount > 0 && (
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] text-[10px] font-bold rounded-full flex items-center justify-center px-1",
              highCount > 0
                ? "bg-destructive text-destructive-foreground"
                : "bg-warning text-warning-foreground"
            )}
          >
            {totalCount > 9 ? "9+" : totalCount}
          </span>
        )}
      </Button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[370px] rounded-xl border bg-popover text-popover-foreground shadow-xl z-[200] overflow-hidden animate-in fade-in-0 slide-in-from-top-1 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">التنبيهات الأمنية</span>
              {totalCount > 0 && (
                <Badge variant="secondary" className="text-xs h-5 px-1.5">
                  {totalCount}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleRefresh}
              title="تحديث"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", isRefetching && "animate-spin")}
              />
            </Button>
          </div>

          {/* Content */}
          <ScrollArea className="max-h-[420px]">
            {isLoading ? (
              <div className="p-6 text-center text-muted-foreground text-sm animate-pulse">
                جاري فحص النظام...
              </div>
            ) : visible.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="mx-auto h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-medium">كل شيء على ما يرام ✅</p>
                <p className="text-xs text-muted-foreground">
                  لا توجد تنبيهات أمنية حالياً
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {visible.map((alert) => {
                  const cfg = severityConfig[alert.severity];
                  return (
                    <div
                      key={alert.id}
                      className={cn(
                        "flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors group",
                        cfg.bg
                      )}
                      onClick={() => handleAlertClick(alert)}
                    >
                      {/* Severity dot + icon */}
                      <div className="mt-0.5 shrink-0 flex flex-col items-center gap-1">
                        <div
                          className={cn(
                            "h-2 w-2 rounded-full mt-1",
                            cfg.dot,
                            alert.severity === "high" && "animate-pulse"
                          )}
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={cn("shrink-0", cfg.text)}>
                            {alertIcons[alert.type]}
                          </span>
                          <p className="text-sm font-semibold truncate">
                            {alert.title}
                          </p>
                          {alert.count && (
                            <span
                              className={cn(
                                "text-[10px] font-bold rounded-full px-1.5 py-0.5 shrink-0 mr-auto",
                                cfg.badge
                              )}
                            >
                              {alert.count}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {alert.description}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-start gap-1 shrink-0 mt-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => dismiss(alert.id, e)}
                          title="إخفاء"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          {visible.length > 0 && (
            <div className="px-4 py-2 border-t bg-muted/20 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {highCount > 0 && (
                  <span className="text-destructive font-medium">
                    {highCount} تنبيه عالي الأولوية •{" "}
                  </span>
                )}
                يتحدث كل دقيقة
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => {
                  setDismissed(new Set(alerts.map((a) => a.id)));
                  setOpen(false);
                }}
              >
                إخفاء الكل
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
