import React from 'react';
import { 
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

interface AnalyticsChartsProps {
  data: {
    totalCalls: number;
    pickupRate: number;
    connectionRate: number;
    successRate: number;
    averageDuration: number;
    callOutcomes: Array<{
      name: string;
      value: number;
      percentage: number;
      color: string;
    }>;
    timelineData: Array<{
      date: string;
      calls: number;
      pickups: number;
      meetings: number;
    }>;
  };
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#F97316'];

const truncate = (val: string, max = 12) => (val && val.length > max ? `${val.slice(0, max - 1)}…` : val);

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ data }) => {
  // Prepare call outcomes data for bar chart - ordered by percentage (largest to smallest)
  const outcomesData = [...data.callOutcomes]
    .sort((a, b) => b.percentage - a.percentage)
    .map((outcome, index) => ({
      name: outcome.name,
      percentage: outcome.percentage,
      value: outcome.value,
      fill: COLORS[index % COLORS.length]
    }));

  return (
    <div className="w-full h-full">
      {/* Call Outcomes Bar Chart */}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={outcomesData} margin={{ top: 20, right: 30, left: 20, bottom: 90 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: 11, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            angle={-40}
            textAnchor="end"
            height={100}
            interval={0}
            tickFormatter={(v: string) => truncate(v, 16)}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip 
            formatter={(value: number, name: string, props: any) => [
              name === 'percentage' ? `${value}%` : value,
              name === 'percentage' ? 'Percentage' : 'Count'
            ]}
            labelFormatter={(label, payload: any) => {
              // Show full label (untruncated) in tooltip
              const original = payload && payload[0] && payload[0].payload && payload[0].payload.name;
              return `Outcome: ${original || label}`;
            }}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
          />
          <Bar 
            dataKey="percentage" 
            radius={[4, 4, 0, 0]}
            name="percentage"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Additional chart components for different views
export const PieChartComponent: React.FC<AnalyticsChartsProps> = ({ data }) => {
  const pieData = data.callOutcomes.map((outcome, index) => ({
    name: outcome.name,
    value: outcome.percentage,
    fill: COLORS[index % COLORS.length]
  }));

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 40 }}>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={70}
            paddingAngle={2}
            dataKey="value"
            // show only percentage on the slice to prevent label overflow
            label={({ value }) => `${value}%`}
            labelLine={false}
          >
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontSize: 12, color: '#6b7280' }} />
          <Tooltip 
            formatter={(value: number, name: string, props: any) => [`${value}%`, props && props.payload ? props.payload.name : 'Percentage']}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export const LineChartComponent: React.FC<AnalyticsChartsProps> = ({ data }) => {
  const timelineChartData = data.timelineData.map((item, index) => ({
    day: `Day ${index + 1}`,
    calls: item.calls,
    meetings: item.meetings,
    successRate: item.meetings > 0 ? ((item.meetings / item.calls) * 100) : 0
  }));

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={timelineChartData} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="day" 
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <Tooltip 
            formatter={(value: number, name: string) => [
              name === 'successRate' ? `${value.toFixed(1)}%` : value,
              name === 'successRate' ? 'Success Rate' : name === 'calls' ? 'Total Calls' : 'Meetings'
            ]}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
          />
          <Line 
            type="monotone" 
            dataKey="calls" 
            stroke="#3B82F6" 
            strokeWidth={2}
            dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
            name="calls"
          />
          <Line 
            type="monotone" 
            dataKey="successRate" 
            stroke="#10B981" 
            strokeWidth={2}
            dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
            name="successRate"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}; 