export function MeasurementReference() {
  return (
    <details className="measurement-reference">
      <summary>View measurement guide & example reference</summary>
      <p>
        Use a soft tape over light, fitted clothing. Stand naturally, keep the
        tape level, and do not pull it tight. Ask someone to help if possible.
      </p>
      <div className="measurement-reference__layout">
        <svg
          viewBox="0 0 180 290"
          role="img"
          aria-labelledby="measurement-guide-title"
        >
          <title id="measurement-guide-title">
            Measurement positions: chest across the fullest part, waist at the
            natural waistline, hips around the fullest part, and height from
            head to floor.
          </title>
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="83" cy="26" r="17" />
            <path d="M72 43 70 55 49 64 28 131 39 135 57 87 62 117 56 153 63 270 78 270 83 179 88 270 103 270 110 153 104 117 109 87 127 135 138 131 117 64 96 55 94 43" />
            <path
              d="M51 85H115M61 117H105M56 153H110"
              stroke="#a8513a"
              strokeDasharray="4 3"
            />
            <path d="M154 9V270M149 9H159M149 270H159" />
          </g>
          <g fill="#a8513a" fontSize="11">
            <text x="72" y="81">
              1
            </text>
            <text x="78" y="113">
              2
            </text>
            <text x="78" y="149">
              3
            </text>
            <text x="160" y="143">
              4
            </text>
          </g>
        </svg>
        <div>
          <ol>
            <li>
              <strong>Chest / bust:</strong> Wrap the tape around the fullest
              part, under your arms.
            </li>
            <li>
              <strong>Waist:</strong> Measure around your natural waist, without
              holding your breath.
            </li>
            <li>
              <strong>Hips:</strong> Measure around the fullest part of your
              hips, with feet together.
            </li>
            <li>
              <strong>Height (optional):</strong> Measure barefoot from the top
              of your head to the floor.
            </li>
          </ol>
          <p>
            <strong>Example only — not recommended sizes:</strong>
            <br />
            Chest 86 cm · Waist 71 cm · Hips 94 cm · Height 165 cm.
            <br />
            Approximately 33.9 in · 28 in · 37 in · 65 in.
          </p>
          <p>
            Enter your own body measurements, not garment sizes. Your boutique
            will confirm garment-specific measurements and ease before
            production. If unsure, choose a guided fitting instead.
          </p>
        </div>
      </div>
    </details>
  );
}
