'use strict';

const defaults = require('./runtime-defaults.cjs');

function requirePublicValue(name, value, placeholder) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized === placeholder) {
    throw new Error(`${name} is missing from the controlled desktop release configuration.`);
  }
  return normalized;
}

// Developer/CI environments may override the public client config explicitly. Packaged releases
// normally use the controlled values in runtime-defaults.cjs so end users never provision them.
process.env.SUPABASE_URL = String(process.env.SUPABASE_URL || requirePublicValue(
  'SUPABASE_URL', defaults.supabaseUrl, '__MYFINHUB_SUPABASE_URL__',
)).trim();
process.env.SUPABASE_PUBLISHABLE_KEY = String(process.env.SUPABASE_PUBLISHABLE_KEY || requirePublicValue(
  'SUPABASE_PUBLISHABLE_KEY', defaults.supabasePublishableKey, '__MYFINHUB_SUPABASE_PUBLISHABLE_KEY__',
)).trim();
process.env.MYFINHUB_PRODUCTION_ORIGIN = String(defaults.productionOrigin || '').trim();

// A desktop binary must never receive the server-side card-vault encryption key through release
// configuration. Card-secret operations are proxied to the canonical production API instead.
delete process.env.CARD_VAULT_KEY;
delete process.env.CARD_VAULT_KEY_VERSION;
delete process.env.SUPABASE_SECRET_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

require('./main.cjs');
