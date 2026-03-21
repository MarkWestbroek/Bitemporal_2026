export function SvgPatternDefs({ includeRegistratie = false, registratieFill = "var(--registration-fill)" }) {
  return (
    <defs>
      {includeRegistratie && (
        <pattern id="pat-registratie" patternUnits="userSpaceOnUse" width="8" height="8">
          <rect width="8" height="8" fill={registratieFill} />
          <circle cx="2" cy="2" r="1.5" fill="#cee6f8" />
          <circle cx="6" cy="5" r="1.5" fill="#cee6f8" />
        </pattern>
      )}
      <pattern id="pat-opvoer" patternUnits="userSpaceOnUse" width="8" height="8">
        <rect width="8" height="8" fill="var(--opvoer-fill, #eefcf2)" />
        <circle cx="2" cy="2" r="1.5" fill="#beeece" />
        <circle cx="6" cy="5" r="1.5" fill="#beeece" />
      </pattern>
      <pattern id="pat-afvoer" patternUnits="userSpaceOnUse" width="8" height="8">
        <rect width="8" height="8" fill="var(--afvoer-fill, #fff4e8)" />
        <circle cx="2" cy="2" r="1.5" fill="#f5dcbc" />
        <circle cx="6" cy="5" r="1.5" fill="#f5dcbc" />
      </pattern>
      <pattern id="pat-neutraal" patternUnits="userSpaceOnUse" width="8" height="8">
        <rect width="8" height="8" fill="var(--neutral-fill, #f8fafc)" />
        <circle cx="2" cy="2" r="1.5" fill="#dce8f0" />
        <circle cx="6" cy="5" r="1.5" fill="#dce8f0" />
      </pattern>
    </defs>
  );
}
