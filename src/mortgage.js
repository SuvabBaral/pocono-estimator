export const money = (n, d = 0) =>
  n == null || Number.isNaN(n) ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: d, minimumFractionDigits: d });

export function calcMortgage({ price, downPct = 20, extraFees = 10000, rate, years = 30, taxRatePct = 2, insuranceMonthly = 105, hoaMonthly = 0 }) {
  const down = (price * downPct) / 100;
  const loan = price - down;
  const r = rate / 100 / 12;
  const n = years * 12;
  const pi = r === 0 ? loan / n : (loan * r) / (1 - Math.pow(1 + r, -n));
  const tax = (price * taxRatePct) / 100 / 12;
  const total = pi + tax + insuranceMonthly + hoaMonthly;
  return { down, loan, pi, tax, insurance: insuranceMonthly, hoa: hoaMonthly, total, cashToClose: down + extraFees, totalInterest: pi * n - loan };
}
