# Authentication email templates

FADEN authentication email is delivered by Supabase Auth through the verified Resend SMTP sender `no-reply@auth.faden.in`. Phone authentication is deferred and remains disabled for hosted applications.

## Hosted Supabase configuration

In **Authentication → Email Templates**, configure:

| Template       | Subject                                 | Repository body                        |
| -------------- | --------------------------------------- | -------------------------------------- |
| Confirm signup | `Welcome to FADEN — confirm your email` | `supabase/templates/confirmation.html` |
| Reset password | `Reset your FADEN password`             | `supabase/templates/recovery.html`     |

Copy each complete HTML file into the matching Supabase template editor. Both templates deliberately use `{{ .ConfirmationURL }}` so Supabase performs token verification and preserves the approved recovery redirect. Do not replace it with a hand-built token URL.

Keep click tracking disabled for the authentication sending domain because link rewriting can interfere with confirmation URLs. Do not add marketing content or unsubscribe controls to authentication emails; marketing email must use a separate sending stream and consent record.

After saving, test both flows with a non-admin test account. Confirmation must return to the Marketplace Site URL. Recovery must pass through `/auth/callback`, establish the recovery session and land on `/auth/update-password` before accepting a new password.
