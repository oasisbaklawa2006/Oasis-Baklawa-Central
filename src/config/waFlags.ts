/**
 * WhatsApp governance flags — re-exported for app/tests.
 * Edge runtime reads the same module from supabase/functions/_shared/wa-governance/flags.ts.
 */
export {
  WA_FLAG_ENV,
  parseEnvFlagTrue,
  isWaWebhookAutoOrderWritesEnabled,
  isWaWebhookOwnerReassignmentEnabled,
  type EnvGetter,
} from "../../supabase/functions/_shared/wa-governance/flags.ts";
