"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/format";

export type MonthlyPoint = {
  mois: string;
  collectee: number;
  deductible: number;
  nette: number;
};

export function TvaChart({ data }: { data: MonthlyPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eaecf0" vertical={false} />
          <XAxis dataKey="mois" tick={{ fontSize: 12 }} stroke="#98a2b3" />
          <YAxis tick={{ fontSize: 12 }} stroke="#98a2b3" width={70}
            tickFormatter={(v) => formatMoney(v).replace(/,00\s?€/, " €")} />
          <Tooltip
            formatter={(value, name) => [formatMoney(Number(value)), String(name)]}
            labelStyle={{ color: "#1a1d21" }}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e4e7ec" }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="collectee" name="TVA collectée" fill="#1e5eff" radius={[3, 3, 0, 0]} />
          <Bar dataKey="deductible" name="TVA déductible" fill="#98a2b3" radius={[3, 3, 0, 0]} />
          <Line dataKey="nette" name="TVA nette estimée" stroke="#067647" strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AnnualBarChart({ data }: { data: { annee: string; nette: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eaecf0" vertical={false} />
          <XAxis dataKey="annee" tick={{ fontSize: 12 }} stroke="#98a2b3" />
          <YAxis tick={{ fontSize: 12 }} stroke="#98a2b3" width={70} />
          <Tooltip formatter={(value) => formatMoney(Number(value))} />
          <Bar dataKey="nette" name="TVA nette estimée" fill="#1e5eff" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
