// Mirrors POLICY_CATEGORIES in app/routers/policies.py — keep in sync.
export const POLICY_CATEGORIES = ['Email Scanner', 'Automatic Validator', 'Manual Validator'] as const

export type PolicyCategory = (typeof POLICY_CATEGORIES)[number]

/**
 * Policies have no separate category column — the backend stores it as a
 * "{category} - " prefix on the `name` column. This splits that back out for
 * display. Policies created before this convention existed fall back to
 * category: null (shown as "Uncategorized").
 */
export function parsePolicyName(fullName: string): { category: PolicyCategory | null; name: string } {
  for (const category of POLICY_CATEGORIES) {
    const prefix = `${category} - `
    if (fullName.startsWith(prefix)) {
      return { category, name: fullName.slice(prefix.length) }
    }
  }
  return { category: null, name: fullName }
}

export function buildPolicyName(category: PolicyCategory, name: string): string {
  return `${category} - ${name}`
}
