export type BpjsRates = {
  kesEmployer: number;
  kesEmployee: number;
  tkEmployer: number;
  tkEmployee: number;
};

export const DEFAULT_BPJS_RATES: BpjsRates = {
  kesEmployer: 4,
  kesEmployee: 1,
  tkEmployer: 3.7,
  tkEmployee: 2,
};

export function calcBpjsContribution(gajiPokok: number, rates: BpjsRates = DEFAULT_BPJS_RATES) {
  const kesEmployer = Math.round(gajiPokok * (rates.kesEmployer / 100));
  const kesEmployee = Math.round(gajiPokok * (rates.kesEmployee / 100));
  const tkEmployer = Math.round(gajiPokok * (rates.tkEmployer / 100));
  const tkEmployee = Math.round(gajiPokok * (rates.tkEmployee / 100));
  return {
    kesEmployer,
    kesEmployee,
    tkEmployer,
    tkEmployee,
    totalEmployer: kesEmployer + tkEmployer,
    totalEmployee: kesEmployee + tkEmployee,
  };
}
