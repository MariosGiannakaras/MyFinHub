import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow=readFileSync(new URL('../.github/workflows/production-smoke.yml',import.meta.url),'utf8');

describe('production smoke release identity contract',()=>{
  it('fails closed when the Vercel production deployment SHA is not the current main release head',()=>{
    expect(workflow).toContain("github.event.deployment_status.environment == 'Production'");
    expect(workflow).toContain("github.event.deployment_status.creator.login == 'vercel[bot]'");
    expect(workflow).toContain("name: Verify deployed release SHA");
    expect(workflow).toContain("if: github.event_name == 'deployment_status'");
    expect(workflow).toContain("DEPLOYED_SHA: ${{ github.event.deployment.sha }}");
    expect(workflow).toContain('https://api.github.com/repos/$GITHUB_REPOSITORY/git/ref/heads/main');
    expect(workflow).toContain('[[ "$DEPLOYED_SHA" =~ ^[0-9a-f]{40}$ ]]');
    expect(workflow).toContain('[[ "$expected_sha" =~ ^[0-9a-f]{40}$ ]]');
    expect(workflow).toContain('[[ "$DEPLOYED_SHA" == "$expected_sha" ]]');
    expect(workflow).toContain('Production deployment SHA matches main release head');
  });

  it('keeps manual dispatch as a surface smoke without misrepresenting it as deployment identity proof',()=>{
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain("if: github.event_name == 'deployment_status'");
    expect(workflow).toContain("github.event_name == 'workflow_dispatch' ||");
  });
});
