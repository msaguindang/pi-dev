---
name: gmail
description: Manage Gmail. Search, read, draft, and send emails using the Gmail API extension. Trigger when user asks to check email, send an email, or draft a message.
---

# Gmail

You have access to the user's Gmail account via the `gmail` pi extension.

## Tools Available
1. `search_emails(query, maxResults)` - Use standard Gmail search operators (e.g. `is:unread`, `from:person@domain.com`, `subject:"meeting"`). Returns message IDs and snippets.
2. `read_email(id)` - Fetch the full plain-text body of an email by its ID.
3. `draft_email(to, subject, body, cc)` - Create a draft in the user's Drafts folder. Use this when the user asks to prepare an email but hasn't explicitly said "send it".
4. `send_email(to, subject, body, cc)` - Send an email directly. This triggers a strict UI confirmation dialog, so the user will be asked to approve it before it actually sends.

## Workflow Rules
- **Draft First (Usually):** Unless the user explicitly says "send an email", default to `draft_email`. 
- **Confirmation:** If the user says "send it", use `send_email`. It is completely safe to call `send_email` because the UI confirmation guardrail will always protect it.
- **Tone:** Keep emails professional but concise, unless the user specifies a different tone.
- **Contacts:**
  - Lance: (Ask for email if not known, or use a placeholder)
  - Fleur: (Ask for email if not known, or use a placeholder)

*(Note: If you don't know the exact email addresses for contacts like Lance or Fleur, you can draft the email and leave the `to` field as their name or a placeholder so the user can fill it in the Gmail UI, or ask the user for their email addresses).*