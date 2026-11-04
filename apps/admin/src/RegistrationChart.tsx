import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
export default function RegistrationChart({
  activity,
}: {
  activity: { _id: string; count: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={270}>
      <AreaChart
        data={activity}
        margin={{ top: 20, right: 15, left: -20, bottom: 10 }}
      >
        <defs>
          <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#109f8d" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#109f8d" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="4 5"
          vertical={false}
          stroke="#edf0f2"
        />
        <XAxis
          dataKey="_id"
          tickFormatter={(s) => String(s).slice(5)}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11 }}
        />
        <YAxis
          allowDecimals={false}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11 }}
        />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="count"
          name="Registrations"
          stroke="#0a9483"
          strokeWidth={2.5}
          fill="url(#fill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
