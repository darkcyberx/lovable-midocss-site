import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface LicenseChartProps {
  active: number;
  expired: number;
  pending: number;
  suspended: number;
}

export const LicenseChart = ({ active, expired, pending, suspended }: LicenseChartProps) => {
  const data = [
    { name: "نشط", value: active, color: "hsl(var(--success))" },
    { name: "منتهي", value: expired, color: "hsl(var(--destructive))" },
    { name: "قيد الانتظار", value: pending, color: "hsl(var(--warning))" },
    { name: "معلق", value: suspended, color: "hsl(var(--muted-foreground))" },
  ].filter(item => item.value > 0);

  if (data.length === 0) {
    return null;
  }

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle>حالة التراخيص</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
