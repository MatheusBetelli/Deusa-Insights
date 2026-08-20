import { compareData } from "./compare-data.js";
import { importData } from "./import-data.js";

const importReport = await importData();
const comparisonReport = compareData();

console.log(
  JSON.stringify(
    {
      ok: true,
      imported: importReport.totals,
      usedMockData: importReport.usedMockData,
      comparedExternalRecords: comparisonReport.comparedExternalRecords,
      summary: comparisonReport.summary.totals,
    },
    null,
    2,
  ),
);
