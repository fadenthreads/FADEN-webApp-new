# Maps and address integration

FADEN uses Geoapify autocomplete for the initial free commercial phase. The implementation is provider-isolated so Google Places can replace it later without changing the account address form or Supabase schema.

## Configuration

Create a Geoapify project and API key. Configure `GEOAPIFY_API_KEY` only as a server-side variable in the Marketplace environment. Never prefix it with `NEXT_PUBLIC_`, embed it in browser code, commit it, or paste it into support conversations.

The authenticated Marketplace endpoint `/api/address-autocomplete` restricts results to India, requires at least three query characters, caps response size, applies a best-effort per-user request limit, uses a short provider timeout and does not cache or log address queries. The account form debounces searches and retains manual entry as a fallback.

Selecting a result fills street, city, state and postal code and stores the returned latitude/longitude with the existing default address. Users can still add flat, suite and landmark details manually. Coordinates are cleared when geographical fields are manually changed so a stale pin is not retained.

Autocomplete is an input aid, not proof that an address is deliverable. The existing fulfilment workflow continues to treat delivery addresses as customer-confirmed and operationally unverified until courier validation is connected.

## Release checks

- Add `GEOAPIFY_API_KEY` to the Marketplace Vercel Production environment only.
- Redeploy Marketplace after saving the variable.
- Confirm anonymous requests receive `401`.
- Confirm a signed-in user can search, select, manually refine and save an Indian address.
- Confirm the stored coordinates match the selected pin and are cleared after manual geographical edits.
- Set provider quota alerts and review usage before public promotion.
