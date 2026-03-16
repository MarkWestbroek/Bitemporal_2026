(function initSchemaSvgPatterns(windowObj) {
  function SvgPatternDefs(props) {
    const includeRegistratie = Boolean(props && props.includeRegistratie);
    const registratieFill = (props && props.registratieFill) || "var(--registration-fill)";

    return React.createElement(
      "defs",
      null,
      includeRegistratie
        ? React.createElement(
            "pattern",
            { id: "pat-registratie", patternUnits: "userSpaceOnUse", width: "8", height: "8" },
            React.createElement("rect", { width: "8", height: "8", fill: registratieFill }),
            React.createElement("circle", { cx: "2", cy: "2", r: "1.5", fill: "#cee6f8" }),
            React.createElement("circle", { cx: "6", cy: "5", r: "1.5", fill: "#cee6f8" })
          )
        : null,
      React.createElement(
        "pattern",
        { id: "pat-opvoer", patternUnits: "userSpaceOnUse", width: "8", height: "8" },
        React.createElement("rect", { width: "8", height: "8", fill: "var(--opvoer-fill, #eefcf2)" }),
        React.createElement("circle", { cx: "2", cy: "2", r: "1.5", fill: "#beeece" }),
        React.createElement("circle", { cx: "6", cy: "5", r: "1.5", fill: "#beeece" })
      ),
      React.createElement(
        "pattern",
        { id: "pat-afvoer", patternUnits: "userSpaceOnUse", width: "8", height: "8" },
        React.createElement("rect", { width: "8", height: "8", fill: "var(--afvoer-fill, #fff4e8)" }),
        React.createElement("circle", { cx: "2", cy: "2", r: "1.5", fill: "#f5dcbc" }),
        React.createElement("circle", { cx: "6", cy: "5", r: "1.5", fill: "#f5dcbc" })
      ),
      React.createElement(
        "pattern",
        { id: "pat-neutraal", patternUnits: "userSpaceOnUse", width: "8", height: "8" },
        React.createElement("rect", { width: "8", height: "8", fill: "var(--neutral-fill, #f8fafc)" }),
        React.createElement("circle", { cx: "2", cy: "2", r: "1.5", fill: "#dce8f0" }),
        React.createElement("circle", { cx: "6", cy: "5", r: "1.5", fill: "#dce8f0" })
      )
    );
  }

  windowObj.SchemaSvgPatterns = {
    SvgPatternDefs,
  };
})(window);
