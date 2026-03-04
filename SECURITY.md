# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| 1.x | ✅ Active |

## Reporting a Vulnerability

If you discover a security vulnerability in the Edlight Initiative backend system, please report it responsibly.

### Do NOT

- Open a public GitHub issue for security vulnerabilities
- Disclose the vulnerability publicly before it has been addressed

### Do

1. **Email** the maintainers at: security@edlight.io (or open a private security advisory on GitHub)
2. Include a detailed description of the vulnerability
3. Provide steps to reproduce the issue
4. If possible, suggest a fix

### What to Expect

- **Acknowledgment** within 48 hours of your report
- **Assessment** and severity classification within 5 business days
- **Fix and disclosure** timeline communicated to you
- **Credit** in the release notes (unless you prefer anonymity)

## Security Best Practices for Contributors

When contributing to this codebase, ensure:

- Never commit secrets, API keys, or credentials
- Use parameterized queries (Prisma handles this)
- Validate and sanitize all user input
- Follow the principle of least privilege for RBAC
- Keep dependencies updated and audit regularly (`npm audit`)
- Use environment variables for all sensitive configuration
