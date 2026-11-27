import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const settings=readFileSync(new URL('../src/pages/SettingsPage.tsx',import.meta.url),'utf8');
const nativeBackup=readFileSync(new URL('../src/components/DesktopBackupPanel.tsx',import.meta.url),'utf8');

describe('#649 I18.01: scoped finance JSON backup and restore copy (#652)',()=>{
  it('calls JSON finance-state data, never a complete PostgreSQL/Storage recovery image',()=>{
    expect(settings).toContain('Δημιούργησε αντίγραφο των οικονομικών δεδομένων στη βάση');
    expect(settings).toContain('έγκυρο αρχείο JSON οικονομικών δεδομένων MyFinHub έως 4 MB');
    expect(settings).toContain('Το JSON δεν είναι πλήρες αντίγραφο PostgreSQL ή Supabase Storage');
    expect(settings).toContain('Δεν αποτελεί πλήρες αντίγραφο PostgreSQL ή Supabase Storage');
    expect(settings).not.toContain('πλήρες backup MyFinHub');
    expect(settings).not.toContain('πλήρες JSON της εφαρμογής');
  });
  it('keeps explicit secrets/local files exclusions and the separate desktop-backup scope',()=>{
    for(const label of ['PAN/λήξη/CVV','ανεξάρτητα IBAN','ανεβασμένα λογότυπα','τοπικές αποδείξεις','PIN των Windows'])
      expect(settings).toContain(label);
    expect(settings).toContain('Το JSON δεν επαναφέρει Card Vault, ανεξάρτητα IBAN ή αρχεία Supabase Storage');
    expect(nativeBackup).toContain('Δεν περιλαμβάνουν μυστικά Card Vault, PIN, αρχεία Supabase Storage ή πλήρες αντίγραφο PostgreSQL');
  });
  it('preserves explicit destructive import confirmation, no Undo, size limit and revision backup path',()=>{
    expect(settings).toContain('title="Εισαγωγή δεδομένων από JSON;"');
    expect(settings).toContain('tone="destructive"');
    expect(settings).toContain('onConfirm={() => void confirmImport()}');
    expect(settings).toContain('δημιουργηθεί αυτόματο backup');
    expect(settings).toContain('Έως 4 MB');
    expect(settings).toContain('δεν αναιρείται με Undo/Redo');
    expect(settings).toContain('onImport(');
    expect(settings).toContain('onBackup()');
  });
});
