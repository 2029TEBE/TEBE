export function validRiskRating(value: unknown): value is number;
export function raidRiskScore(severity: unknown, likelihood: unknown): number | null;
export function isCriticalRaidRisk(score: number | null): boolean;
