import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Log {
  id: string;
  action: string;
  description: string;
  created_at: string;
  entity_type: string;
}

interface RecentActivityProps {
  logs: Log[];
  loading?: boolean;
}

const actionColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  created: "default",
  updated: "secondary",
  deleted: "destructive",
  verified: "outline",
};

const actionLabels: Record<string, string> = {
  created: "إنشاء",
  updated: "تحديث",
  deleted: "حذف",
  verified: "تحقق",
};

export const RecentActivity = ({ logs, loading = false }: RecentActivityProps) => {
  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          النشاط الأخير
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-6 w-16" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">لا يوجد نشاط حديث</p>
        ) : (
          <div className="space-y-4">
            {logs.slice(0, 10).map((log) => (
              <div key={log.id} className="flex items-start gap-3 pb-3 border-b last:border-0">
                <Badge variant={actionColors[log.action] || "default"} className="shrink-0">
                  {actionLabels[log.action] || log.action}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{log.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(log.created_at), {
                      addSuffix: true,
                      locale: ar,
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
