import { getPeriodRange } from "@/lib/period";
import { formatRupiah } from "@/lib/payroll-policy";

export type CashFlowSummary = {
  periodLabel: string;
  totalIncome: number;
  totalExpense: number;
  netCashFlow: number;
  posProfit: number;
  incomeBreakdown: { source: string; amount: number }[];
  expenseBreakdown: { category: string; amount: number }[];
};

export function summarizeCashFlow(input: {
  year: number;
  month: number;
  incomes: { source: string; amount: number }[];
  expenses: { category: string; amount: number }[];
  posSales?: number;
  posExpenses?: number;
  periodLabel: string;
}): CashFlowSummary {
  const totalIncome = input.incomes.reduce((s, i) => s + i.amount, 0);
  const totalExpense = input.expenses.reduce((s, e) => s + e.amount, 0);
  const posSales = input.posSales ?? 0;
  const posExpenses = input.posExpenses ?? 0;

  const incomeMap = new Map<string, number>();
  for (const inc of input.incomes) {
    incomeMap.set(inc.source, (incomeMap.get(inc.source) ?? 0) + inc.amount);
  }

  const expenseMap = new Map<string, number>();
  for (const exp of input.expenses) {
    expenseMap.set(exp.category, (expenseMap.get(exp.category) ?? 0) + exp.amount);
  }

  return {
    periodLabel: input.periodLabel,
    totalIncome,
    totalExpense,
    netCashFlow: totalIncome - totalExpense,
    posProfit: posSales - posExpenses,
    incomeBreakdown: [...incomeMap.entries()].map(([source, amount]) => ({ source, amount })),
    expenseBreakdown: [...expenseMap.entries()].map(([category, amount]) => ({ category, amount })),
  };
}

export { getPeriodRange, formatRupiah };
