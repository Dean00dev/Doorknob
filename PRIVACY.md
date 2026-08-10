# Privacy and data flow

Doorknob is designed for sensitive health-related text. Health information may
be special-category personal data. Deployers must perform their own legal and
data-protection assessment; this document is technical disclosure, not legal
advice.

## Shipped behaviour

- The browser holds answers in React memory until reset, navigation, refresh, or
  tab closure. It does not use local storage, cookies, analytics, or a database.
- The server does not intentionally log request bodies or persist transcripts.
- Mock mode does not send answers to an external model provider.
- Anthropic mode sends the submitted partial transcript after each answer so the
  provider can choose the next question. It sends the complete reviewed
  transcript again when creating the brief.
- In-memory rate limiting may temporarily process a network address to control
  abuse.

No deployment should claim “nothing is stored” without verifying hosting logs,
reverse proxies, monitoring, backups, provider retention, browser behaviour, and
all modifications to this code.

## Operator responsibilities

Before enabling an external provider, document at least:

- controller and processor roles;
- purpose and lawful basis;
- any special-category condition;
- retention and deletion behaviour;
- international transfers;
- access controls and incident response;
- whether a data-protection impact assessment is required;
- clear privacy information shown before collection.

Collect only information needed for appointment preparation. Never use submitted
health information for advertising, profiling, or unrelated model training.
