// dsh-desktop-shortcut — browser half.
//
// A small floating, draggable "刷新" button for the dsh web GUI.
// It registers into the frame-wide `shell.overlay` slot, so it stays above
// the whole app. Users can drag it anywhere and click it to reload the page.
//
// This is intentionally dependency-light: only React and the dsh client slot
// service are used, with inline styles and localStorage for drag persistence.

window.__ModuleLoader__.load({
  id: "dsh-desktop-shortcut",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    let react = require("react");
    let jsxRuntime = require("react/jsx-runtime");
    const { useState, useEffect, useRef } = react;
    const { jsx, jsxs, Fragment } = jsxRuntime;

    const STORAGE_KEY = "dsh-desktop-shortcut-pos";

    // ---- inline styles ---------------------------------------------
    const container = {
      position: "absolute",
      right: 16,
      bottom: 16,
      zIndex: 9999,
      pointerEvents: "auto",
      cursor: "move",
      userSelect: "none",
      touchAction: "none"
    };

    const button = {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "6px 10px",
      border: "1px solid var(--dsw-alias-border-l2)",
      borderRadius: 999,
      background: "var(--dsw-alias-interactive-bg-hover)",
      color: "var(--dsw-alias-label-primary)",
      fontFamily: "var(--dsw-font-family)",
      fontSize: 12,
      lineHeight: "18px",
      cursor: "pointer",
      boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
    };

    // ---- floating draggable refresh button --------------------------
    function RefreshButton() {
      const [pos, setPos] = useState(() => {
        try {
          const p = JSON.parse(localStorage.getItem(STORAGE_KEY));
          if (p !== null && typeof p === "object" && Number.isFinite(p.x) && Number.isFinite(p.y)) return p;
        } catch {}
        return null;
      });
      const dragRef = useRef(null);

      useEffect(() => {
        try {
          if (pos !== null) localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
        } catch {}
      }, [pos]);

      const onPointerDown = (e) => {
        if (e.button !== 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        dragRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          origLeft: pos !== null ? pos.x : rect.left,
          origTop: pos !== null ? pos.y : rect.top,
          moved: false
        };
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
      };

      const onPointerMove = (e) => {
        const d = dragRef.current;
        if (d === null) return;
        const dx = e.clientX - d.startX;
        const dy = e.clientY - d.startY;
        if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
        if (d.moved) setPos({ x: d.origLeft + dx, y: d.origTop + dy });
      };

      const onPointerUp = (e) => {
        const d = dragRef.current;
        if (d !== null && d.moved) e.preventDefault();
        dragRef.current = null;
      };

      const onPointerCancel = () => {
        dragRef.current = null;
      };

      const style = {
        ...container,
        ...(pos !== null ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : {})
      };

      return jsx("div", {
        "data-plugin": "dsh-desktop-shortcut",
        title: "刷新 Harness 页面（按住可拖动）",
        style,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel,
        children: jsx("button", {
          type: "button",
          style: button,
          "aria-label": "刷新页面",
          title: "刷新页面",
          onClick: () => {
            location.reload();
          },
          children: jsxs(Fragment, {
            children: [
              jsx("svg", {
                width: 12,
                height: 12,
                viewBox: "0 0 16 16",
                fill: "none",
                "aria-hidden": true,
                children: jsx("path", {
                  d: "M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 1.5v3h-3",
                  stroke: "currentColor",
                  strokeWidth: 1.5,
                  strokeLinecap: "round",
                  strokeLinejoin: "round"
                })
              }),
              jsx("span", { children: "刷新" })
            ]
          })
        })
      });
    }

    // ---- client plugin body -----------------------------------------
    const inject = ["slots"];

    function apply(ctx) {
      ctx.slots.inject("shell.overlay", () => ctx.slots.register({
        name: "shell.overlay",
        id: "desktop-shortcut-refresh",
        order: 100,
        label: "刷新"
      }, RefreshButton));
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
