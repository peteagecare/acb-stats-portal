export type ApprovalRole = "pete" | "chris" | "sam" | "outside";
export type DnnaRole = "dnna_pete" | "dnna_chris";
export type AnyApprovalKey = ApprovalRole | DnnaRole;

export interface ApprovalRoleConfig {
  key: ApprovalRole;
  label: string;
  /** Emails (lowercased) that are permitted to tick this checkbox. */
  allowedEmails: string[];
}

export const APPROVAL_ROLES: ApprovalRoleConfig[] = [
  {
    key: "pete",
    label: "Pete (Head of Marketing)",
    allowedEmails: ["pete@agecare-bathrooms.co.uk"],
  },
  {
    key: "chris",
    label: "Chris (Financial Director)",
    allowedEmails: ["chris@agecare-bathrooms.co.uk"],
  },
  {
    key: "sam",
    label: "Sam (Director)",
    allowedEmails: ["sam@agecare-bathrooms.co.uk"],
  },
  {
    key: "outside",
    label: "Outside Approval (Finance Institution)",
    allowedEmails: ["chris@agecare-bathrooms.co.uk"],
  },
];

export const DNNA_ROLES: { key: DnnaRole; label: string; allowedEmails: string[] }[] = [
  {
    key: "dnna_pete",
    label: "Pete marks 'no approval needed'",
    allowedEmails: ["pete@agecare-bathrooms.co.uk"],
  },
  {
    key: "dnna_chris",
    label: "Chris confirms 'no approval needed'",
    allowedEmails: ["chris@agecare-bathrooms.co.uk"],
  },
];

const ALL_KEYS = new Set<string>([
  ...APPROVAL_ROLES.map((r) => r.key),
  ...DNNA_ROLES.map((r) => r.key),
]);

export function isValidApprovalKey(k: string): k is AnyApprovalKey {
  return ALL_KEYS.has(k);
}

export function canApproveAny(key: AnyApprovalKey, userEmail: string | null | undefined): boolean {
  if (!userEmail) return false;
  const allRoles = [...APPROVAL_ROLES, ...DNNA_ROLES];
  const cfg = allRoles.find((r) => r.key === key);
  if (!cfg) return false;
  return cfg.allowedEmails.includes(userEmail.toLowerCase());
}

export function canApprove(role: ApprovalRole, userEmail: string | null | undefined): boolean {
  if (!userEmail) return false;
  const cfg = APPROVAL_ROLES.find((r) => r.key === role);
  if (!cfg) return false;
  return cfg.allowedEmails.includes(userEmail.toLowerCase());
}

/** Sequential workflow: Pete -> Chris -> Sam -> Outside. */
export const APPROVAL_SEQUENCE: ApprovalRole[][] = [
  ["pete"],
  ["chris"],
  ["sam"],
  ["outside"],
];

export type ApprovalState = Partial<Record<AnyApprovalKey, boolean>> & { rejected?: boolean };

/** If Pete marks DNNA and Chris confirms, the email is treated as approved — no further sign-off needed. */
export function isDnnaConfirmed(state: ApprovalState): boolean {
  return !!state.dnna_pete && !!state.dnna_chris;
}

/** Pending pseudo-roles/actions the user can take right now on an email. */
export interface PendingAction {
  key: AnyApprovalKey;
  kind: "approve" | "dnna";
}

export function pendingActionsForUser(
  userEmail: string | null | undefined,
  state: ApprovalState
): PendingAction[] {
  if (!userEmail) return [];
  if (isDnnaConfirmed(state)) return [];

  // When an email has been sent back for changes, only Pete's re-approval is pending.
  if (state.rejected) {
    if (canApproveAny("pete", userEmail)) return [{ key: "pete", kind: "approve" }];
    return [];
  }

  const out: PendingAction[] = [];
  const peteCommittedNormal = !!state.pete;
  const dnnaStarted = !!state.dnna_pete;

  // Pete hasn't committed a path yet — offer both: normal approval OR DNNA.
  if (!peteCommittedNormal && !dnnaStarted) {
    if (canApproveAny("pete", userEmail)) out.push({ key: "pete", kind: "approve" });
    if (canApproveAny("dnna_pete", userEmail)) out.push({ key: "dnna_pete", kind: "dnna" });
    return out;
  }

  // DNNA path active — only Chris's confirmation matters.
  if (dnnaStarted) {
    if (!state.dnna_chris && canApproveAny("dnna_chris", userEmail)) {
      out.push({ key: "dnna_chris", kind: "dnna" });
    }
    return out;
  }

  // Normal path: Pete -> Chris -> Sam -> Outside (strictly sequential).
  for (const step of APPROVAL_SEQUENCE) {
    const allDone = step.every((r) => !!state[r]);
    if (!allDone) {
      // This step has pending roles — offer them if the user can act
      for (const role of step) {
        if (!state[role] && canApproveAny(role, userEmail)) {
          out.push({ key: role, kind: "approve" });
        }
      }
      return out; // Don't look at later steps
    }
  }
  return out;
}

/** Legacy helper kept for existing callers — returns just regular approval roles. */
export function pendingRolesForUser(
  userEmail: string | null | undefined,
  state: ApprovalState
): ApprovalRole[] {
  return pendingActionsForUser(userEmail, state)
    .filter((a) => a.kind === "approve")
    .map((a) => a.key as ApprovalRole);
}

/** Is this email fully approved (via normal flow OR confirmed DNNA)? */
export function isFullyApproved(state: ApprovalState): boolean {
  if (isDnnaConfirmed(state)) return true;
  return APPROVAL_ROLES.every((r) => state[r.key]);
}
