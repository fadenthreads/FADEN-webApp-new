"use client";

import { createFadenBrowserClient } from "@faden/supabase";
import { FormEvent, useEffect, useMemo, useState } from "react";

interface AddressSuggestion {
  city: string;
  id: string;
  label: string;
  latitude: number | null;
  line1: string;
  longitude: number | null;
  postalCode: string;
  state: string;
}

interface AccountFormProps {
  address: {
    id: string;
    label: string;
    recipient_name: string;
    phone: string | null;
    line1: string;
    line2: string | null;
    city: string;
    latitude: number | null;
    state: string;
    longitude: number | null;
    postal_code: string;
  } | null;
  email: string;
  googleEnabled: boolean;
  phone: string;
  preferences: {
    email_marketing: boolean;
    email_transactional: boolean;
    sms_transactional: boolean;
    whatsapp_updates: boolean;
  };
  profile: {
    display_name: string | null;
    phone: string | null;
  };
  providers: string[];
  phoneAuthEnabled: boolean;
  userId: string;
}

export function AccountForm(props: AccountFormProps) {
  const supabase = useMemo(() => createFadenBrowserClient(), []);
  const [displayName, setDisplayName] = useState(
    props.profile.display_name ?? "",
  );
  const [profilePhone, setProfilePhone] = useState(
    props.profile.phone ?? props.phone,
  );
  const [address, setAddress] = useState({
    label: props.address?.label ?? "Home",
    recipient_name:
      props.address?.recipient_name ?? props.profile.display_name ?? "",
    phone: props.address?.phone ?? props.phone,
    line1: props.address?.line1 ?? "",
    line2: props.address?.line2 ?? "",
    city: props.address?.city ?? "",
    state: props.address?.state ?? "",
    postal_code: props.address?.postal_code ?? "",
  });
  const [preferences, setPreferences] = useState(props.preferences);
  const [coordinates, setCoordinates] = useState({
    latitude: props.address?.latitude ?? null,
    longitude: props.address?.longitude ?? null,
  });
  const [addressQuery, setAddressQuery] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<
    AddressSuggestion[]
  >([]);
  const [addressSearchMessage, setAddressSearchMessage] = useState("");
  const [addressSearching, setAddressSearching] = useState(false);
  const [newPhone, setNewPhone] = useState(props.phone || "+91");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function updateAddress(field: keyof typeof address, value: string) {
    setAddress((current) => ({ ...current, [field]: value }));
    if (["line1", "city", "state", "postal_code"].includes(field)) {
      setCoordinates({ latitude: null, longitude: null });
    }
  }

  useEffect(() => {
    const query = addressQuery.trim();
    if (query.length < 3) {
      setAddressSuggestions([]);
      setAddressSearchMessage("");
      setAddressSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setAddressSearching(true);
      setAddressSearchMessage("");
      try {
        const response = await fetch(
          `/api/address-autocomplete?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        const payload = (await response.json()) as {
          error?: string;
          suggestions?: AddressSuggestion[];
        };
        if (!response.ok) {
          setAddressSuggestions([]);
          setAddressSearchMessage(
            payload.error ?? "Address search is temporarily unavailable.",
          );
          return;
        }
        setAddressSuggestions(payload.suggestions ?? []);
        if (!(payload.suggestions ?? []).length) {
          setAddressSearchMessage(
            "No matches found. Enter the address manually.",
          );
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setAddressSuggestions([]);
          setAddressSearchMessage("Address search is temporarily unavailable.");
        }
      } finally {
        if (!controller.signal.aborted) setAddressSearching(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [addressQuery]);

  function chooseAddress(suggestion: AddressSuggestion) {
    setAddress((current) => ({
      ...current,
      city: suggestion.city,
      line1: suggestion.line1,
      postal_code: suggestion.postalCode,
      state: suggestion.state,
    }));
    setCoordinates({
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    });
    setAddressQuery("");
    setAddressSuggestions([]);
    setAddressSearchMessage(
      "Address selected. Add the flat, suite or landmark below if needed.",
    );
  }

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ display_name: displayName, phone: profilePhone || null })
      .eq("id", props.userId);
    if (profileError) {
      setMessage(profileError.message);
      setBusy(false);
      return;
    }

    const preferenceResult = await supabase
      .from("user_preferences")
      .update(preferences)
      .eq("user_id", props.userId);
    if (preferenceResult.error) {
      setMessage(preferenceResult.error.message);
      setBusy(false);
      return;
    }

    const addressPayload = {
      ...address,
      country_code: "IN",
      is_default: true,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      phone: address.phone || null,
      line2: address.line2 || null,
      user_id: props.userId,
    };
    const addressResult = props.address
      ? await supabase
          .from("user_addresses")
          .update(addressPayload)
          .eq("id", props.address.id)
      : await supabase.from("user_addresses").insert(addressPayload);

    setBusy(false);
    setMessage(
      addressResult.error
        ? addressResult.error.message
        : "Account settings saved.",
    );
  }

  async function linkGoogle() {
    if (!props.googleEnabled) {
      setMessage("Google identity linking needs local OAuth credentials.");
      return;
    }
    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/account`,
      },
    });
    if (error) setMessage(error.message);
  }

  async function verifyPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    if (!phoneOtpSent) {
      const { error } = await supabase.auth.updateUser({ phone: newPhone });
      setBusy(false);
      if (error) setMessage(error.message);
      else {
        setPhoneOtpSent(true);
        setMessage("Verification code sent to the new number.");
      }
      return;
    }

    const { error } = await supabase.auth.verifyOtp({
      phone: newPhone,
      token: phoneOtp,
      type: "phone_change",
    });
    if (!error) {
      await supabase
        .from("profiles")
        .update({ phone: newPhone })
        .eq("id", props.userId);
      setProfilePhone(newPhone);
    }
    setBusy(false);
    setMessage(error ? error.message : "Phone number verified and linked.");
  }

  return (
    <div className="settings-grid">
      <form
        className="settings-card settings-card--wide"
        onSubmit={saveAccount}
      >
        <div className="settings-card__heading">
          <div>
            <p className="eyebrow">Personal details</p>
            <h2>Your FADEN profile</h2>
          </div>
          <span className="status-pill status-pill--ready">Private</span>
        </div>
        <div className="form-grid">
          <label>
            Full name
            <input
              onChange={(event) => setDisplayName(event.target.value)}
              required
              value={displayName}
            />
          </label>
          <label>
            Email
            <input disabled type="email" value={props.email} />
          </label>
          <label>
            Contact phone
            <input
              onChange={(event) => setProfilePhone(event.target.value)}
              value={profilePhone}
            />
          </label>
        </div>

        <div className="section-rule" />
        <p className="eyebrow">Default delivery address</p>
        <div className="form-grid">
          <div className="address-search form-field--wide">
            <label>
              Find an Indian address
              <input
                aria-autocomplete="list"
                aria-controls="address-suggestions"
                aria-expanded={addressSuggestions.length > 0}
                autoComplete="off"
                onChange={(event) => setAddressQuery(event.target.value)}
                placeholder="Start typing a building, street or locality"
                role="combobox"
                value={addressQuery}
              />
            </label>
            {addressSearching && (
              <p className="field-hint address-search__message">Searching…</p>
            )}
            {addressSuggestions.length > 0 && (
              <div
                className="address-suggestions"
                id="address-suggestions"
                role="listbox"
              >
                {addressSuggestions.map((suggestion) => (
                  <button
                    aria-selected="false"
                    key={suggestion.id}
                    onClick={() => chooseAddress(suggestion)}
                    role="option"
                    type="button"
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            )}
            {!addressSearching && addressSearchMessage && (
              <p className="field-hint address-search__message">
                {addressSearchMessage}
              </p>
            )}
            {coordinates.latitude !== null &&
              coordinates.longitude !== null && (
                <a
                  className="auth-inline-link address-search__map"
                  href={`https://www.google.com/maps/search/?api=1&query=${coordinates.latitude},${coordinates.longitude}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  Check the selected pin on Maps ↗
                </a>
              )}
          </div>
          <label>
            Label
            <input
              onChange={(event) => updateAddress("label", event.target.value)}
              required
              value={address.label}
            />
          </label>
          <label>
            Recipient
            <input
              onChange={(event) =>
                updateAddress("recipient_name", event.target.value)
              }
              required
              value={address.recipient_name}
            />
          </label>
          <label>
            Address line 1
            <input
              onChange={(event) => updateAddress("line1", event.target.value)}
              required
              value={address.line1}
            />
          </label>
          <label>
            Address line 2
            <input
              onChange={(event) => updateAddress("line2", event.target.value)}
              value={address.line2}
            />
          </label>
          <label>
            City
            <input
              onChange={(event) => updateAddress("city", event.target.value)}
              required
              value={address.city}
            />
          </label>
          <label>
            State
            <input
              onChange={(event) => updateAddress("state", event.target.value)}
              required
              value={address.state}
            />
          </label>
          <label>
            Postal code
            <input
              inputMode="numeric"
              onChange={(event) =>
                updateAddress("postal_code", event.target.value)
              }
              required
              value={address.postal_code}
            />
          </label>
          <label>
            Delivery phone
            <input
              onChange={(event) => updateAddress("phone", event.target.value)}
              value={address.phone}
            />
          </label>
        </div>

        <div className="section-rule" />
        <p className="eyebrow">Communication</p>
        <div className="preference-list">
          {(
            [
              ["email_transactional", "Order and account emails"],
              ["sms_transactional", "Order and delivery SMS"],
              ["email_marketing", "Editorial and boutique discoveries"],
              ["whatsapp_updates", "WhatsApp order updates"],
            ] as const
          ).map(([key, label]) => (
            <label className="toggle-row" key={key}>
              <span>{label}</span>
              <input
                checked={preferences[key]}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    [key]: event.target.checked,
                  }))
                }
                type="checkbox"
              />
            </label>
          ))}
        </div>
        <button className="button button--primary" disabled={busy}>
          {busy ? "Saving…" : "Save account"}
        </button>
      </form>

      <aside className="settings-stack">
        <section className="settings-card">
          <p className="eyebrow">Connected identities</p>
          <h2>Sign-in methods</h2>
          <div className="identity-list">
            {props.providers.map((provider) => (
              <span className="identity-pill" key={provider}>
                {provider}
              </span>
            ))}
          </div>
          {!props.providers.includes("google") && (
            <button
              className="button button--ghost button--full"
              onClick={linkGoogle}
              type="button"
            >
              Link Google
            </button>
          )}
        </section>

        {props.phoneAuthEnabled && (
          <form className="settings-card form-stack" onSubmit={verifyPhone}>
            <p className="eyebrow">Account recovery</p>
            <h2>Verified mobile</h2>
            <label>
              Phone number
              <input
                disabled={phoneOtpSent}
                onChange={(event) => setNewPhone(event.target.value)}
                required
                value={newPhone}
              />
            </label>
            {phoneOtpSent && (
              <label>
                Verification code
                <input
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => setPhoneOtp(event.target.value)}
                  required
                  value={phoneOtp}
                />
              </label>
            )}
            <button
              className="button button--ghost button--full"
              disabled={busy}
            >
              {phoneOtpSent ? "Verify phone" : "Send verification"}
            </button>
          </form>
        )}
      </aside>
      {message && (
        <p className="form-message settings-message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
