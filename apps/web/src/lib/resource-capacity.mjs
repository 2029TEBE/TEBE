/** Validated, non-negative percentages for display; raw API records are never mutated. */
export const capacityValue = value =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
export const capacityBarFill = value =>
  capacityValue(value) ? Math.max(0, Math.min(100, value)) : 0;
export const isOverAllocated = value => capacityValue(value) && value > 100;
