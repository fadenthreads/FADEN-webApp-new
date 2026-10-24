"use client";

import { useEffect, useId, useRef, useState } from "react";

type Result = { label: string; detail?: string; href?: string; value?: string };

export function CatalogSearchInput({
  type,
  initialValue = "",
  placeholder,
  name = "q",
}: {
  type: string;
  initialValue?: string;
  placeholder: string;
  name?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [status, setStatus] = useState("");
  const [allHref, setAllHref] = useState("");
  const [active, setActive] = useState(-1);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);
  useEffect(() => {
    setResults([]);
    setAllHref("");
    setActive(-1);
    if (!open || value.trim().length < 2) {
      setStatus("");
      return;
    }
    const controller = new AbortController();
    setStatus("Searching…");
    const timer = setTimeout(async () => {
      try {
        const cityInput = root.current
          ?.closest("form")
          ?.elements.namedItem("city") as HTMLInputElement | null;
        const params = new URLSearchParams({ q: value.trim(), type });
        if (type !== "cities" && cityInput?.value)
          params.set("city", cityInput.value);
        const response = await fetch(`/api/catalog-search?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const payload = await response.json();
        setResults(payload.results);
        setAllHref(payload.allHref ?? "");
        setStatus(
          payload.results.length
            ? ""
            : "No matches. Try another name or location.",
        );
      } catch {
        if (!controller.signal.aborted)
          setStatus(
            "Suggestions unavailable. You can still submit your search.",
          );
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, type, open]);
  function choose(result: Result) {
    if (result.href) window.location.assign(result.href);
    else {
      setValue(result.value ?? result.label);
      setOpen(false);
    }
  }
  return (
    <div
      className="catalog-autocomplete"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <input
        name={name}
        value={value}
        placeholder={placeholder}
        aria-label={name === "city" ? "Location" : "Search catalogue"}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && value.trim().length >= 2}
        aria-controls={id}
        aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
        onChange={(event) => {
          setValue(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            setActive(-1);
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setActive((current) =>
              results.length
                ? (current +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    results.length) %
                  results.length
                : -1,
            );
          }
          if (event.key === "Enter" && open && active >= 0 && results[active]) {
            event.preventDefault();
            choose(results[active]);
          }
        }}
      />
      {open && value.trim().length >= 2 && (
        <div className="catalog-suggestions">
          <p role="status">{status || `${results.length} suggestions`}</p>
          <div id={id} role="listbox" aria-label="Search suggestions">
            {results.map((result, index) => (
              <button
                key={`${result.label}-${index}`}
                type="button"
                role="option"
                id={`${id}-${index}`}
                aria-selected={active === index}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(result)}
              >
                <strong>{result.label}</strong>
                <small>{result.detail}</small>
              </button>
            ))}
          </div>
          {allHref && <a href={allHref}>View all matching results →</a>}
        </div>
      )}
    </div>
  );
}
