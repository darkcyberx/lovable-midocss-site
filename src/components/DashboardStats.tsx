import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  index: number;
  loading?: boolean;
}

export const StatCard = ({
  title,
  value,
  icon: Icon,
  color,
  bgColor,
  index,
  loading = false,
}: StatCardProps) => {
  return (
    <Card
      className="hover:shadow-lg transition-all duration-300 hover:scale-105 animate-fade-in border-l-4"
      style={{ 
        animationDelay: `${index * 0.1}s`,
        borderLeftColor: `hsl(var(--${color.replace('text-', '')}))`,
      }}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`p-3 rounded-lg ${bgColor}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-10 w-20" />
        ) : (
          <div className="text-3xl font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
  );
};
