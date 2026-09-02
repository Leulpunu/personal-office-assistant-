# Muna Office

Muna Office is a bilingual office agent for Ethiopian companies. It combines an English/Amharic dashboard with a server-side agent that can manage company tasks, meetings, private company documents, and a personal email outbox while keeping people in control of consequential actions.

## What works now

- Responsive English/Amharic office dashboard
- Low-latency OpenAI Realtime speech-to-speech in English or Amharic
- Feminine Muna voice profile with a browser speech fallback when Realtime is not configured
- Guided demo agent when no OpenAI key is configured
- OpenAI Responses API agent with strict task, meeting, and document tools
- Private personal email drafts with create, edit, search, and deletion
- Muna email drafting plus an audited, separate human-approved send action
- Vendor-neutral SMTP delivery with TLS, bounded timeouts, and URL/file access disabled
- Demo delivery simulation that never contacts an external recipient
- Private company Document Center with upload, download, and confirmed deletion
- Searchable text extraction for PDF, DOCX, TXT, Markdown, CSV, and JSON files
- Muna document listing, tenant-scoped search, and grounded summaries
- Human approval before tasks are created or meetings are scheduled/cancelled
- Company calendar with meeting creation, editing, attendee lists, links, and cancellation
- Muna meeting listing, timezone-aware scheduling, and exact-meeting cancellation
- Supabase session verification, multi-company membership, and row-level security
- Email/password registration, sign-in, confirmation callback, and sign-out
- Company creation and email-bound, single-use teammate invitations
- Owner, manager, and employee role assignment
- Supabase-backed dashboard task creation and completion
- Audit records for proposed, approved, executed, and failed agent actions
- Per-user API rate limiting and validated request/tool inputs

## 1. Run the demo

The local `.env.local` enables demo mode and is ignored by Git.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), click **Ask Muna**, and try:

```text
Create a task to call the Addis supplier
```

Muna prepares a task card. The task is created only after **Approve & create task** is clicked.

To talk to Muna, open **Ask Muna**, choose **አማርኛ** or **English** in her voice profile, click the microphone, allow microphone access, and speak. In Amharic mode she listens with the Ethiopian Amharic locale, asks the agent to answer in Amharic, and reads the response aloud. Every assistant response also has a **Listen** button.

Muna prefers a feminine voice installed by the browser or operating system. Browser voice catalogs do not provide a standard gender field, so the app prioritizes recognized feminine voice names and avoids recognized masculine voices. If an Amharic feminine voice is unavailable, the drawer shows that the device's browser fallback is being used. Voice input works best in current Edge or Chrome.

To test scheduling, try:

```text
Schedule a meeting called Supplier review tomorrow at 10:00 AM
```

Muna prepares a 30-minute meeting proposal. The calendar changes only after **Approve & schedule** is clicked. You can also try `What meetings do I have?` or `Cancel the Operations stand-up meeting`.

Open **Documents** to upload a company file, or test the built-in demo documents with:

```text
What are the payment terms in the supplier agreement document?
Summarize the Supplier Agreement 2026 document
```

Document reads are tenant-scoped and read-only. Image-only scanned PDFs are stored securely but require a future OCR step before Muna can search their text.

Open **Email** to compose a private draft, or ask Muna:

~~~text
Draft an email to supplier@example.com about the delivery delay
Send the Delivery delay email
~~~

Drafting never sends. The send request produces a review card showing recipients, subject, and a body preview. Delivery happens only after **Approve & send email** is clicked. In demo mode the result is simulated and no external email is contacted.

## 2. Connect Supabase

Create a Supabase project and apply the migrations in this order:

```text
supabase/migrations/20260825140000_agent_foundation.sql
supabase/migrations/20260825160000_auth_onboarding.sql
supabase/migrations/20260825173000_meetings_scheduling.sql
supabase/migrations/20260825200000_document_center.sql
supabase/migrations/20260825213000_email_outbox.sql
supabase/migrations/20260903120000_company_email_settings.sql
```

Copy `.env.example` to `.env.local`, then set:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SECRET_KEY=YOUR_SECRET_KEY
NEXT_PUBLIC_DEMO_MODE=false
```

`SUPABASE_SECRET_KEY` is server-only. Never prefix it with `NEXT_PUBLIC_`. Add `http://localhost:3000/auth/callback` and the equivalent production URL to the allowed redirect URLs in Supabase Auth.

Visit `/login` to register. After email confirmation, Muna sends the user through `/onboarding`, where they can create a company as its owner or join with a single-use invitation code. Owners can invite managers or employees; managers can invite employees.

## 3. Enable the AI model

Add these server-only values to `.env.local`:

```dotenv
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
OPENAI_MODEL=gpt-5.4-mini
OPENAI_REALTIME_MODEL=gpt-realtime-2
OPENAI_REALTIME_VOICE=marin
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
```

Without `OPENAI_API_KEY`, Muna uses the deterministic guided demo agent. With a key, it uses the Responses API tool loop. Database mutations still require the separate approval request.

With an API key, the microphone starts a low-latency WebRTC session with OpenAI's Realtime API. The server creates a short-lived client secret, so the permanent API key is never sent to the browser. Muna uses the **marin** voice with instructions for a warm professional feminine character. Amharic mode guides automatic transcription toward Amharic and requests Amharic spoken answers.

Every live voice request must call Muna's existing office agent. Read operations can answer immediately, while tasks, meeting changes, cancellations, and email sends still produce the same human-approval card before execution. Without an API key—or if Realtime is unavailable—the microphone automatically returns to the browser speech implementation.

If OpenAI returns HTTP 429 because API credits or an organization/project spend limit are unavailable, Muna automatically switches to browser listening, the device's feminine speech voice, and the guided office agent. This keeps the local demo usable, but full Realtime conversation returns only after credits are added or the relevant OpenAI usage limit is raised. Retrying repeatedly does not repair an `insufficient_quota` response.

## 4. Configure production email delivery

Apply `supabase/migrations/20260903120000_company_email_settings.sql`, set a server-only 32-byte base64url `EMAIL_CREDENTIALS_ENCRYPTION_KEY`, then open **Settings → Email delivery** as the company owner. Muna includes presets for Gmail/Google Workspace, Microsoft 365, Zoho Mail, cPanel/company mail, and custom SMTP. Use **Test connection** before approving a real send.

Mailbox passwords are encrypted with AES-256-GCM before storage. The settings table has no direct browser access, saved passwords are never returned by the API, and every email still requires a separate human approval. Keep the same encryption key for the life of the stored credentials; if it is lost or rotated, reconnect each mailbox.

The environment variables below remain available as an optional deployment-wide fallback when a company has not saved its own provider:

Drafting works without a mail provider. To enable approved sends outside demo mode, add server-only SMTP values:

~~~dotenv
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
SMTP_USER=YOUR_SMTP_USER
SMTP_PASS=YOUR_SMTP_PASSWORD
SMTP_FROM="Muna Office <office@your-company.com>"
SMTP_REPLY_TO=office@your-company.com
~~~

Use port 465 with SMTP_SECURE=true for implicit TLS. Port 587 normally uses SMTP_SECURE=false and upgrades with STARTTLS. Never prefix SMTP credentials with NEXT_PUBLIC_.

## 5. Verify the project

```bash
npm run lint
npm run build
```

## Agent flow

```text
User message
    ↓
POST /api/agent
    ↓
Verified user + company workspace
    ↓
Agent selects a tenant-scoped tool
    ↓
Read tool → answer
Reversible private draft → save without sending
Consequential write/send → proposal → human approval → audited execution
```

## Next product slice

Connect an external calendar provider so approved Muna meetings can be synchronized. After that, add OCR for image-only scanned documents and more company tools.
