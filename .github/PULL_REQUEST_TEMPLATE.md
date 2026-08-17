## Summary

<!-- Describe what changes and why. Keep the scope tied to one issue. -->

Closes #

## Type

- [ ] Feature
- [ ] Bug fix
- [ ] Security hardening
- [ ] Infrastructure / deployment
- [ ] Database migration
- [ ] Dependency maintenance
- [ ] Documentation only

## Verification

- [ ] The linked issue and acceptance criteria are satisfied.
- [ ] `npm run check` passes.
- [ ] Production dependency audit passes.
- [ ] Relevant finance-domain regression tests pass.
- [ ] Auth/RLS failure paths were checked if authentication, API, or database access changed.
- [ ] Any schema change is represented by an ordered file in `supabase/migrations/`.
- [ ] No secret, credential, personal finance data, or production export is included.
- [ ] Preview/development configuration cannot mutate production finance data unintentionally.
- [ ] Documentation/config examples were updated when runtime or deployment behavior changed.

## Deployment / rollback

<!-- State deployment impact and a practical rollback path. Write "None" when not applicable. -->
