# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Currently supported versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

**Note**: Pre-1.0 versions (0.x.x) are no longer supported. Please upgrade to the latest stable release.

## Reporting a Vulnerability

The PipeCraft team takes security bugs seriously. We appreciate your efforts to responsibly disclose your findings.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to:

**[james.villarrubia@gmail.com](mailto:james.villarrubia@gmail.com)**

Please include the following information:

- Type of issue (e.g. buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### What to Expect

When you report a vulnerability, you can expect:

1. **Acknowledgment**: We will acknowledge receipt of your vulnerability report within 48 hours
2. **Communication**: We will keep you informed about our progress towards a fix
3. **Verification**: We will work to verify the vulnerability and determine its impact
4. **Fix**: We will develop and test a fix for the vulnerability
5. **Release**: We will release a security patch and publicly disclose the vulnerability
6. **Credit**: We will credit you in the release notes (if you wish)

### Timeline

- **48 hours**: Initial response acknowledging receipt
- **7 days**: Initial assessment and severity classification
- **30 days**: Target for fix development and release (depending on severity and complexity)

## Security Best Practices for PipeCraft Users

### GitHub Actions Workflows

1. **Secrets Management**

   - Never commit secrets to your repository
   - Use GitHub Secrets for sensitive values
   - Rotate secrets regularly
   - Limit secret access to necessary workflows only

2. **Workflow Permissions**

   - Follow the principle of least privilege
   - Review and understand the permissions PipeCraft workflows require
   - Use `permissions:` blocks to explicitly define access
   - Enable branch protection rules for staging and main branches

3. **Dependency Security**

   - Regularly update PipeCraft to the latest version
   - Enable Dependabot alerts for your repository
   - Review security advisories for dependencies
   - Run `npm audit` regularly

4. **Code Review**
   - Review generated workflows before committing
   - Understand what PipeCraft-managed sections do
   - Validate custom jobs and steps you add
   - Use required reviewers for production branches

### Configuration Security

1. **Repository Access**

   - Limit who can modify `.pipecraftrc.json`
   - Protect the `.github/workflows/` directory
   - Use CODEOWNERS to require reviews for workflow changes

2. **Branch Protection**

   - Enable branch protection for `develop`, `staging`, and `main`
   - Require status checks to pass before merging
   - Require pull request reviews
   - Enable "Require branches to be up to date before merging"

3. **Token Security**
   - Use fine-grained personal access tokens when possible
   - Set token expiration dates
   - Audit token usage regularly
   - Revoke unused tokens immediately

### Third-Party Actions

PipeCraft generates workflows that use GitHub-provided actions. We recommend:

1. Pin actions to specific commit SHAs for production workflows
2. Review third-party actions before use
3. Keep actions updated for security patches
4. Audit action permissions and access

## Known Security Considerations

### Workflow Generation

- PipeCraft reads your repository's configuration and file structure
- Generated workflows have write access to your repository (for tagging, releases)
- Workflows can trigger other workflows (promotion between branches)
- Custom jobs you add are NOT validated by PipeCraft

### Permissions Required

PipeCraft-generated workflows require these permissions:

- **contents: write** - For creating tags and pushing changes
- **pull-requests: write** - For creating pull requests during promotion
- **actions: write** - For triggering subsequent workflow runs (optional)

Review the [GitHub Actions security hardening guide](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions) for additional best practices.

## Security Updates

Security updates will be released as patch versions and documented in:

- [CHANGELOG.md](./CHANGELOG.md)
- [GitHub Security Advisories](https://github.com/pipecraft-lab/pipecraft/security/advisories)
- [npm Package Updates](https://www.npmjs.com/package/pipecraft)

Subscribe to release notifications to stay informed about security updates.

## Disclosure Policy

When we receive a security bug report, we will:

1. Confirm the problem and determine affected versions
2. Audit code to find any similar problems
3. Prepare fixes for all supported versions
4. Release new versions as soon as possible
5. Publicly disclose the vulnerability after the fix is released

We ask that you:

- Give us reasonable time to fix the issue before public disclosure
- Make a good faith effort to avoid privacy violations, data destruction, and service disruption
- Do not access or modify data that doesn't belong to you
- Do not perform actions that could negatively impact PipeCraft users

## Security Hall of Fame

We will recognize security researchers who responsibly disclose vulnerabilities:

<!-- Security researchers will be listed here -->

_No vulnerabilities have been reported yet._

---

## Additional Resources

- [GitHub Actions Security Best Practices](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [OWASP CI/CD Security](https://owasp.org/www-project-devsecops-guideline/)
- [OpenSSF Scorecards](https://github.com/ossf/scorecard)

## Questions?

If you have questions about this security policy, please contact [james.villarrubia@gmail.com](mailto:james.villarrubia@gmail.com).
