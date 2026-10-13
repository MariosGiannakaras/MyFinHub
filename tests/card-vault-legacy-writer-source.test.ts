import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const sql=readFileSync('supabase/migrations/20261010145500_guard_pending_card_secret_cleanup_intent.sql','utf8');
const store=readFileSync('server/storage.ts','utf8');
const real=readFileSync('scripts/real-stack-e2e.ts','utf8');
describe('card vault pending cleanup cannot be erased by an older finance client (DV-FB08)',()=>{
  it('guards the canonical finance row inside every revisioned update, without privileged bypass',()=>{
    expect(sql).toContain('security invoker');
    expect(sql).toContain('before update of data on public.rheomiq_app_state');
    expect(sql).toContain("old.data#>'{state,pendingCardSecretDeletes}'");
    expect(sql).toContain("new.data#>'{state,pendingCardSecretDeletes}'");
    expect(sql).toContain('CARD_CLEANUP_INTENT_REQUIRED');
    expect(sql).toContain('private.rheomiq_cards');
    expect(sql).toContain('public.rheomiq_card_secrets');
    expect(sql).not.toMatch(/grant execute.+to\s+anon/i);
  });
  it('maps a stale-client omission to a recoverable conflict and verifies real ciphertext remains',()=>{
    expect(store).toContain("new ApiError(409, 'CARD_CLEANUP_INTENT_REQUIRED'");
    expect(real).toContain('delete omittedMarkerState.pendingCardSecretDeletes');
    expect(real).toContain("'card-cleanup-legacy-writer-rejected'");
    expect(real).toContain("'card-cleanup-premature-ack-rejected'");
    expect(real).toContain("'card-cleanup-ciphertext-remains-after-legacy-conflict'");
  });
});
