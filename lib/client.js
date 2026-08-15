// dsh-desktop-shortcut — browser half.
//
// A small floating, draggable "刷新" button for the dsh web GUI.
// It registers into the frame-wide `shell.overlay` slot, so it stays above
// the whole app. Users can drag it anywhere and click it to reload the page.
//
// Click feedback:
//   1. The refresh icon spins for a short moment.
//   2. The page reloads.
//   3. After reload, the button shows a green "刷新成功" for 2 seconds.
//
// This is intentionally dependency-light: only React and the dsh client slot
// service are used, with inline styles and localStorage/sessionStorage.

window.__ModuleLoader__.load({
  id: "dsh-desktop-shortcut",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    let react = require("react");
    let jsxRuntime = require("react/jsx-runtime");
    const { useState, useEffect, useLayoutEffect, useRef } = react;
    const { jsx, jsxs, Fragment } = jsxRuntime;

    const STORAGE_KEY = "dsh-desktop-shortcut-pos";
    const SUCCESS_FLAG = "dsh-desktop-shortcut-refresh-success";
    const RELOAD_DELAY_MS = 600;
    const SUCCESS_DISPLAY_MS = 2000;

    // Inject the tiny keyframe animation once.
    if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css='dsh-desktop-shortcut/refresh.css']") === null) {
      const tag = document.createElement("style");
      tag.dataset.plugin = "dsh-desktop-shortcut";
      tag.dataset.pluginCss = "dsh-desktop-shortcut/refresh.css";
      tag.textContent = "@keyframes dsh-desktop-shortcut-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes dsh-desktop-shortcut-pop { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }";
      document.head.appendChild(tag);
    }

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

    const buttonBase = {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      padding: "6px 10px",
      border: "1px solid transparent",
      borderRadius: 999,
      background: "var(--dsw-alias-interactive-bg-hover)",
      color: "var(--dsw-alias-label-primary)",
      fontFamily: "var(--dsw-font-family)",
      fontSize: 12,
      lineHeight: "18px",
      cursor: "pointer",
      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      transition: "width 0.3s ease, background 0.3s ease, color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease"
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
      const [status, setStatus] = useState(() => {
        try {
          return sessionStorage.getItem(SUCCESS_FLAG) === "1" ? "success" : "idle";
        } catch {
          return "idle";
        }
      });
      const dragRef = useRef(null);
      const suppressClickRef = useRef(false);
      const buttonRef = useRef(null);
      const prevWidthRef = useRef(null);
      const [width, setWidth] = useState(null);

      useEffect(() => {
        try {
          if (pos !== null) localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
        } catch {}
      }, [pos]);

      useEffect(() => {
        if (status !== "success") return;
        const timer = setTimeout(() => {
          setStatus("idle");
          try {
            sessionStorage.removeItem(SUCCESS_FLAG);
          } catch {}
        }, SUCCESS_DISPLAY_MS);
        return () => clearTimeout(timer);
      }, [status]);

      const onPointerDown = (e) => {
        if (e.button !== 0) return;
        suppressClickRef.current = false;
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
        if (Math.abs(dx) + Math.abs(dy) > 3) {
          d.moved = true;
          suppressClickRef.current = true;
        }
        if (d.moved) setPos({ x: d.origLeft + dx, y: d.origTop + dy });
      };

      const onPointerUp = (e) => {
        const d = dragRef.current;
        if (d !== null && d.moved) e.preventDefault();
        dragRef.current = null;
      };

      const onPointerCancel = () => {
        dragRef.current = null;
        suppressClickRef.current = false;
      };

      const handleClick = () => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }
        if (status !== "idle") return;
        setStatus("spinning");
        try {
          sessionStorage.setItem(SUCCESS_FLAG, "1");
        } catch {}
        setTimeout(() => {
          location.reload();
        }, RELOAD_DELAY_MS);
      };

      const style = {
        ...container,
        ...(pos !== null ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : {})
      };

      const buttonStyle = {
        ...buttonBase,
        ...(width !== null ? { width } : {}),
        ...(status === "success" ? {
          borderColor: "var(--dsw-alias-state-success-primary)",
          color: "var(--dsw-alias-state-success-primary)",
          background: "color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, transparent)",
          animation: "dsh-desktop-shortcut-pop 0.3s ease"
        } : {}),
        ...(status === "spinning" ? {
          cursor: "wait"
        } : {})
      };

      const label = status === "spinning" ? "刷新中" : status === "success" ? "刷新成功" : "刷新";

      // Smoothly animate the pill width when the label length changes.
      useLayoutEffect(() => {
        const el = buttonRef.current;
        if (el === null) return;
        // Temporarily release the fixed width so we can measure the natural
        // content width even when the current pill is wider than its label.
        const previousWidth = el.style.width;
        el.style.width = "auto";
        const nextWidth = el.offsetWidth;
        el.style.width = previousWidth;
        if (prevWidthRef.current === null) {
          setWidth(nextWidth);
        } else {
          setWidth(prevWidthRef.current);
          requestAnimationFrame(() => setWidth(nextWidth));
        }
        prevWidthRef.current = nextWidth;
      }, [label]);

      return jsx("div", {
        "data-plugin": "dsh-desktop-shortcut",
        title: status === "spinning" ? "正在刷新…" : "刷新 Harness 页面（按住可拖动）",
        style,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel,
        children: jsx("button", {
          ref: buttonRef,
          type: "button",
          style: buttonStyle,
          "aria-label": label,
          title: label,
          disabled: status === "spinning",
          onClick: handleClick,
          children: jsxs(Fragment, {
            children: [
              jsx("svg", {
                width: 12,
                height: 12,
                viewBox: "0 0 16 16",
                fill: "none",
                "aria-hidden": true,
                style: status === "spinning" ? { animation: "dsh-desktop-shortcut-spin 0.6s linear infinite" } : void 0,
                children: jsx("path", {
                  d: "M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 1.5v3h-3",
                  stroke: "currentColor",
                  strokeWidth: 1.5,
                  strokeLinecap: "round",
                  strokeLinejoin: "round"
                })
              }),
              jsx("span", { children: label })
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
