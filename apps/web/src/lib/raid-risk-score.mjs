/**
 * RAID impact × likelihood is meaningful only for integer 1–5 ratings.
 * Corrupt or absent API values must not be interpreted as valid risk.
 */
export function validRiskRating(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}
export function raidRiskScore(severity, likelihood) {
  return validRiskRating(severity) && validRiskRating(likelihood)
    ? severity * likelihood : null;
}
export function isCriticalRaidRisk(score) {
  return typeof score === 'number' && Number.isInteger(score) && score >= 15 && score <= 25;
}
