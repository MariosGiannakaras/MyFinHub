import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {withCardSecretCleanupComplete,withCardSecretCleanupPending} from '../src/lib/cards.js';
import {qaFinanceData} from '../src/qaFixture.js';
import type {PaymentCard} from '../src/types.js';

// Characterization only: these tests demonstrate current cross-domain gaps.
// They MUST NOT be interpreted as acceptance of safe import/card-secret Undo.
const sql=readFileSync(new URL('../supabase/migrations/20260930122054_relational_finance_ledger_cutover.sql',import.meta.url),'utf8');
const atomicDelete=readFileSync(new URL('../supabase/migrations/20261010013500_atomic_card_vault_cleanup.sql',import.meta.url),'utf8');
const boundaries=readFileSync(new URL('../supabase/migrations/20261019110000_protect_irreversible_history_boundaries.sql',import.meta.url),'utf8');
const cleanupGuard=readFileSync(new URL('../supabase/migrations/20261010145500_guard_pending_card_secret_cleanup_intent.sql',import.meta.url),'utf8');
const currentFunction=(name:string)=>{
  const marker=`create or replace function public.${name}(`;
  const start=sql.indexOf(marker);
  expect(start, `Missing latest relational SQL function ${name}`).toBeGreaterThanOrEqual(0);
  const end=sql.indexOf('\n$$;',start);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start,end);
};

describe('history cross-domain boundaries — SQL guard/source proof, real-stack still pending',()=>{
  it('anchors the seed/state import gap to the final authoritative relational SQL',()=>{
    const importing=currentFunction('rheomiq_import_state');
    const moving=currentFunction('rheomiq_move_history');
    expect(importing).toContain("v_next_data := jsonb_set(p_data,'{state}'");
    expect(importing).toContain("values(v_owner,v_parent_point,p_data->'state','Εισαγωγή δεδομένων'");
    expect(moving).toContain("private.rheomiq_ledger_apply_state(v_owner,v_target.state)");
    expect(moving).toContain("v_next_data := jsonb_set(v_current.data,'{state}'");
    // History stores mutable state only; the move does not restore the old seed.
    expect(moving).not.toContain("v_target.seed");
    expect(moving).not.toContain("v_target.data");
  });

  it('reproduces a mismatched imported seed and prior mutable state on a synthetic model',()=>{
    const original=qaFinanceData();
    original.seed.sourceName='Synthetic original file';
    const incoming=structuredClone(original);
    incoming.seed.sourceName='Synthetic replacement file';
    incoming.state.settings.monthlyBudget=(original.state.settings.monthlyBudget??0)+13;

    // This models the audited move_history expression: set current data.state
    // from the old history point; all other incoming fields stay in place.
    const moved={...incoming,state:structuredClone(original.state)};
    expect(moved.state).toEqual(original.state);
    expect(moved.seed.sourceName).toBe(incoming.seed.sourceName);
    expect(moved.seed.sourceName).not.toBe(original.seed.sourceName);
    // A green characterization here means the discrepancy exists, not that
    // reverting a real import is safe.
  });

  it('anchors post-delete card-profile restoration risk to the latest guarded SQL',()=>{
    const moving=currentFunction('rheomiq_move_history');
    expect(moving).toContain('private.rheomiq_ledger_apply_state(v_owner,v_target.state)');
    expect(atomicDelete).toContain('delete from public.rheomiq_card_secrets');
    expect(atomicDelete).toContain("where s.id='primary'");
    expect(cleanupGuard).toContain('Undo/restore can legitimately cancel cleanup by restoring a card');
    expect(cleanupGuard).toContain('then continue; end if;');
    // The history cursor is revisioned, but moving it has no vault ciphertext
    // restoration operation; its metadata transaction is insufficient.
    expect(moving).not.toContain('rheomiq_card_secrets');
  });

  it('models a deleted synthetic vault entry that cannot be recreated by metadata Undo',()=>{
    const source=qaFinanceData();
    const stamp='2026-08-21T12:00:00.000Z';
    const card:PaymentCard={
      id:'qa-history-deleted-vault-card',bankId:'piraeus',nickname:'Synthetic only',
      kind:'debit',network:'visa',active:true,createdAt:stamp,updatedAt:stamp,
    };
    const before={...source,state:{...source.state,cards:[...(source.state.cards??[]),card]}};
    const pending=withCardSecretCleanupPending(before,card,stamp,stamp.slice(0,10));
    expect(pending.state.pendingCardSecretDeletes).toContain(card.id);
    const fakeVaultIds=new Set([card.id]);
    fakeVaultIds.delete(card.id); // Models completed irreversible server deletion.
    const completed=withCardSecretCleanupComplete(pending,card.id);
    expect(completed.state.pendingCardSecretDeletes).not.toContain(card.id);

    // A previous finance-history state could restore card metadata, but cannot
    // restore the independently deleted encrypted vault row.
    const movedBack={...completed,state:{...completed.state,cards:before.state.cards}};
    expect(movedBack.state.cards?.some(item=>item.id===card.id)).toBe(true);
    expect(fakeVaultIds.has(card.id)).toBe(false);
  });

  // Owner-defined policies are implemented; source locks supplement runtime integration.
  it('requires the dedicated migration to block imported-seed Undo at the authoritative cursor',()=>{expect(boundaries).toContain("point.label='Εισαγωγή δεδομένων'");expect(boundaries).toContain('private.rheomiq_history_move_blocked(v_owner,v_cursor.current_point_id,v_target.id,p_direction)');expect(boundaries).toContain("message='HISTORY_IRREVERSIBLE_BOUNDARY'");});
  it('requires atomic ciphertext delete tombstone and fail-closed profile restoration',()=>{expect(boundaries).toContain('private.rheomiq_final_card_secret_deletions');expect(boundaries).toContain('on conflict (owner_user_id,card_id) do nothing');expect(boundaries).toContain('private.rheomiq_cards active_card');expect(boundaries).toContain('public.rheomiq_card_secrets vault');expect(boundaries).toContain("nullif(old_card.card->>'vaultRef','') is not null");});
});
