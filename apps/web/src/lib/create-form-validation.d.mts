/** Browser-only validation; server Zod schemas remain authoritative. */
export declare function formErrorText(code: string, lang?: string): string;
export declare function validateCreateForm(kind: string, values: Record<string, unknown>): Record<string, string>;
