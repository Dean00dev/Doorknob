# Security policy

## Supported version

Only the latest tagged 0.x release is considered for fixes. Pre-1.0 changes may
break compatibility when needed to protect users.

## Reporting

Do not open a public issue containing health information, an API key, a private
transcript, or an exploitable vulnerability. Use GitHub's private vulnerability
reporting route for this repository.

Useful reports include reproduction steps, affected version, impact, and a
minimal synthetic example. Never submit another person's real medical data.

## Secret handling

API keys belong only in server-side environment variables. A browser bundle,
issue, screenshot, fixture, example, or committed `.env` file must never contain
a live credential.
