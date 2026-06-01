(function () {
    "use strict";

    // Channel-JS-only name styling, broadcast via hidden chat control messages.
    // No server changes required.

    if (window.__nickStyleBroadcastPickerInstalled) {
        return;
    }
    window.__nickStyleBroadcastPickerInstalled = true;

    var WRAP_ID = "nickstyle-broadcast-picker";
    var STYLE_ID = "nickstyle-broadcast-style";

    var CONTROL_PREFIX = "##nickstyle:";
    var CONTROL_REQ = "##nickstyle?";

    var CSS_BLOCK_BEGIN = "/* nickstyle-autosave BEGIN */";
    var CSS_BLOCK_END = "/* nickstyle-autosave END */";

    var stylesByUser = Object.create(null);
    var lastReqReply = 0;
    var persistCssTimer = null;

    function now() {
        return Date.now();
    }

    function storageKey() {
        var chan = (window.CHANNEL && window.CHANNEL.name) ? window.CHANNEL.name : "_";
        return "cytube.nickstyle.v1." + location.host + "." + chan;
    }

    function getSelfName() {
        return (window.CLIENT && typeof window.CLIENT.name === "string") ? window.CLIENT.name : "";
    }

    function canUse() {
        // Allow guests too, as long as they have a name
        return !!getSelfName();
    }

    function canPersistToChannelCss() {
        // CyTube server permission: setChannelCSS is rank>=3 (Admin)
        return !!(window.socket && window.CLIENT && window.Rank &&
            typeof window.CLIENT.rank === "number" &&
            window.CLIENT.rank >= window.Rank.Admin);
    }

    function stripPersistBlock(css) {
        if (typeof css !== "string") {
            return "";
        }

        var re = new RegExp(
            "\\/\\*\\s*nickstyle-autosave BEGIN\\s*\\*\\/[\\s\\S]*?\\/\\*\\s*nickstyle-autosave END\\s*\\*\\/",
            "g"
        );
        return css.replace(re, "").trim();
    }

    function buildPersistBlock() {
        var css = [];

        // Store a compact JSON snapshot for clients to rehydrate stylesByUser on load.
        // If this gets too large, skip it (channel CSS is capped server-side).
        try {
            var snapshot = JSON.stringify(stylesByUser);
            if (snapshot.length <= 8000) {
                css.push("/* nickstyle-autosave DATA: " + snapshot + " */");
            }
        } catch (e) {
            // ignored
        }

        Object.keys(stylesByUser).forEach(function (name) {
            var st = stylesByUser[name];
            var decl = cssForStyle(st);
            if (!decl) {
                return;
            }

            // Userlist: some deployments add a per-user class like userlist-<name>
            // (as in the user's existing channel CSS). If not present, the JS
            // path still styles the userlist for clients running the script.
            css.push("span.userlist-" + name + " { " + decl + " }");

            // Chat: support both raw and selector-escaped variants
            var safe = safeUsernameForSelector(name);
            css.push(".chat-msg-" + name + " strong.username { " + decl + " }");
            css.push(".chat-msg-" + safe + " strong.username { " + decl + " }");
        });

        return [CSS_BLOCK_BEGIN, css.join("\n"), CSS_BLOCK_END].join("\n");
    }

    function schedulePersistToChannelCss() {
        if (!canPersistToChannelCss()) {
            return;
        }

        if (persistCssTimer) {
            clearTimeout(persistCssTimer);
        }

        // Debounce to avoid spamming updates during rapid changes
        persistCssTimer = setTimeout(function () {
            persistCssTimer = null;

            var current = (window.CHANNEL && typeof window.CHANNEL.css === "string") ? window.CHANNEL.css : "";
            var base = stripPersistBlock(current);
            var next = (base ? base + "\n\n" : "") + buildPersistBlock() + "\n";

            try {
                window.socket.emit("setChannelCSS", { css: next });
            } catch (e) {
                // ignored
            }
        }, 1200);
    }

    function tryHydrateFromChannelCss() {
        var css = (window.CHANNEL && typeof window.CHANNEL.css === "string") ? window.CHANNEL.css : "";
        if (!css) {
            return;
        }

        var m = css.match(/\/\*\s*nickstyle-autosave DATA:\s*([\s\S]*?)\s*\*\//);
        if (!m) {
            return;
        }

        try {
            var data = JSON.parse(m[1]);
            if (data && typeof data === "object") {
                Object.keys(data).forEach(function (name) {
                    var st = normalizeStyle(data[name]);
                    if (st) {
                        stylesByUser[name] = st;
                    }
                });
            }
        } catch (e) {
            // ignored
        }
    }

    function isValidHexColor(str) {
        return typeof str === "string" && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(str);
    }

    function safeUsernameForSelector(name) {
        // Match util.js behavior for chat-msg-<safeUsername>
        return String(name).replace(/[^\w-]/g, "\\$");
    }

    function ensureStyleTag() {
        var existing = document.getElementById(STYLE_ID);
        if (existing) {
            return existing;
        }

        var tag = document.createElement("style");
        tag.type = "text/css";
        tag.id = STYLE_ID;
        document.head.appendChild(tag);
        return tag;
    }

    function cssForStyle(style) {
        if (!style || typeof style !== "object" || !isValidHexColor(style.color)) {
            return "";
        }

        var rules = [];
        rules.push("color: " + style.color + " !important;");

        if (style.stroke && typeof style.stroke === "object" &&
            typeof style.stroke.width === "number" &&
            isValidHexColor(style.stroke.color)) {
            rules.push("-webkit-text-stroke: " + style.stroke.width + "px " + style.stroke.color + " !important;");
        }

        if (style.shadow && typeof style.shadow === "object" &&
            typeof style.shadow.blur === "number" &&
            isValidHexColor(style.shadow.color)) {
            rules.push("text-shadow: 0px 0px " + style.shadow.blur + "px " + style.shadow.color + " !important;");
        }

        return rules.join(" ");
    }

    function rebuildChatCss() {
        var css = [];
        Object.keys(stylesByUser).forEach(function (name) {
            var st = stylesByUser[name];
            var decl = cssForStyle(st);
            if (!decl) {
                return;
            }
            var safe = safeUsernameForSelector(name);
            css.push(
                ".chat-msg-" + safe + " strong.username { " + decl + " }"
            );
        });

        ensureStyleTag().textContent = css.join("\n");
    }

    function setImportantStyle(el, prop, value) {
        try {
            el.style.setProperty(prop, value, "important");
        } catch (e) {
            // ignored
        }
    }

    function clearStyle(el, prop) {
        try {
            el.style.removeProperty(prop);
        } catch (e) {
            // ignored
        }
    }

    function applyUserlistStyle(name, style) {
        if (!window.jQuery || typeof window.findUserlistItem !== "function") {
            return;
        }

        var entry = window.findUserlistItem(name);
        if (!entry || !entry.length) {
            return;
        }

        var nameSpan = entry.children().eq(1);
        if (!nameSpan || !nameSpan.length) {
            return;
        }

        var el = nameSpan.get(0);
        if (!el) {
            return;
        }

        // Clear
        clearStyle(el, "color");
        clearStyle(el, "-webkit-text-stroke");
        clearStyle(el, "text-shadow");

        if (!style) {
            return;
        }

        if (style.color) {
            setImportantStyle(el, "color", style.color);
        }

        if (style.stroke && typeof style.stroke === "object" && typeof style.stroke.width === "number" && style.stroke.color) {
            setImportantStyle(el, "-webkit-text-stroke", style.stroke.width + "px " + style.stroke.color);
        }

        if (style.shadow && typeof style.shadow === "object" && typeof style.shadow.blur === "number" && style.shadow.color) {
            setImportantStyle(el, "text-shadow", "0px 0px " + style.shadow.blur + "px " + style.shadow.color);
        }
    }

    function applyAllUserlistStyles() {
        Object.keys(stylesByUser).forEach(function (name) {
            applyUserlistStyle(name, stylesByUser[name]);
        });
    }

    function normalizeStyle(raw) {
        if (!raw || typeof raw !== "object") {
            return null;
        }

        if (!isValidHexColor(raw.color)) {
            return null;
        }

        var out = { color: raw.color };

        if (raw.stroke && typeof raw.stroke === "object") {
            var w = parseFloat(raw.stroke.width);
            if (!isNaN(w)) {
                w = Math.max(0, Math.min(3, w));
                if (isValidHexColor(raw.stroke.color)) {
                    out.stroke = { width: w, color: raw.stroke.color };
                }
            }
        }

        if (raw.shadow && typeof raw.shadow === "object") {
            var b = parseFloat(raw.shadow.blur);
            if (!isNaN(b)) {
                b = Math.max(0, Math.min(20, b));
                if (isValidHexColor(raw.shadow.color)) {
                    out.shadow = { blur: b, color: raw.shadow.color };
                }
            }
        }

        return out;
    }

    function parseControlMsg(msg) {
        if (typeof msg !== "string") {
            return null;
        }

        if (msg === CONTROL_REQ) {
            return { type: "req" };
        }

        if (msg.indexOf(CONTROL_PREFIX) !== 0) {
            return null;
        }

        var json = msg.substring(CONTROL_PREFIX.length);
        try {
            var obj = JSON.parse(json);
            return { type: "set", payload: obj };
        } catch (e) {
            return null;
        }
    }

    function broadcastSet(style) {
        if (!window.socket || !canUse()) {
            return;
        }

        // Compact payload
        var payload = style ? style : {};
        var msg = CONTROL_PREFIX + JSON.stringify(payload);
        window.socket.emit("chatMsg", { msg: msg, meta: {} });
    }

    function broadcastReq() {
        if (!window.socket || !canUse()) {
            return;
        }
        window.socket.emit("chatMsg", { msg: CONTROL_REQ, meta: {} });
    }

    function loadSelfStyle() {
        try {
            var raw = localStorage.getItem(storageKey());
            if (!raw) {
                return null;
            }
            return normalizeStyle(JSON.parse(raw));
        } catch (e) {
            return null;
        }
    }

    function saveSelfStyle(style) {
        try {
            if (!style) {
                localStorage.removeItem(storageKey());
            } else {
                localStorage.setItem(storageKey(), JSON.stringify(style));
            }
        } catch (e) {
            // ignored
        }
    }

    function setStyleForUser(name, style) {
        if (!name) {
            return;
        }

        if (!style) {
            delete stylesByUser[name];
        } else {
            stylesByUser[name] = style;
        }

        rebuildChatCss();
        applyUserlistStyle(name, style || null);

        // If an Admin+ is present, persist this change to channel CSS so
        // late joiners see it without needing a re-broadcast.
        schedulePersistToChannelCss();
    }

    function handleIncomingChatMsg(data) {
        if (!data || typeof data !== "object") {
            return false;
        }

        var ctrl = parseControlMsg(data.msg);
        if (!ctrl) {
            return false;
        }

        var from = data.username;
        if (!from) {
            return true;
        }

        if (ctrl.type === "req") {
            // Reply at most once every 5 seconds
            if (now() - lastReqReply < 5000) {
                return true;
            }
            lastReqReply = now();
            var mine = loadSelfStyle();
            if (mine) {
                broadcastSet(mine);
            }
            return true;
        }

        if (ctrl.type === "set") {
            var normalized = normalizeStyle(ctrl.payload);
            setStyleForUser(from, normalized);
            return true;
        }

        return true;
    }

    function hookCallbacks() {
        if (!window.Callbacks || typeof window.Callbacks.chatMsg !== "function") {
            return;
        }

        if (window.__nickStyleBroadcastPickerCallbacksHooked) {
            return;
        }
        window.__nickStyleBroadcastPickerCallbacksHooked = true;

        var orig = window.Callbacks.chatMsg;
        window.Callbacks.chatMsg = function (data) {
            // Swallow control messages so they don't display
            if (handleIncomingChatMsg(data)) {
                return;
            }
            return orig(data);
        };
    }

    function hookUserlistRefresh() {
        if (!window.socket || typeof window.socket.on !== "function") {
            return;
        }

        if (window.__nickStyleBroadcastPickerSocketHooked) {
            return;
        }
        window.__nickStyleBroadcastPickerSocketHooked = true;

        // Re-apply userlist styles on list changes
        ["userlist", "addUser", "setUserMeta", "setUserRank", "setLeader"].forEach(function (ev) {
            try {
                window.socket.on(ev, function () {
                    applyAllUserlistStyles();
                });
            } catch (e) {
                // ignored
            }
        });
    }

    function toColorPickerValue(hex) {
        if (typeof hex !== "string") {
            return "#ffffff";
        }
        if (/^#[0-9a-f]{8}$/i.test(hex)) {
            return hex.substring(0, 7);
        }
        if (/^#[0-9a-f]{6}$/i.test(hex)) {
            return hex;
        }
        return "#ffffff";
    }

    function buildUi() {
        if (!window.jQuery) {
            return;
        }

        if (window.jQuery("#" + WRAP_ID).length) {
            return;
        }

        var wrap = window.jQuery("<div/>")
            .attr("id", WRAP_ID)
            .addClass("vertical-spacer")
            .hide();

        var toggle = window.jQuery("<button/>")
            .attr("type", "button")
            .addClass("btn btn-sm btn-default btn-block")
            .text("Name style");

        var panel = window.jQuery("<div/>").hide();

        function colorRow(label, idPrefix) {
            var row = window.jQuery("<div/>")
                .addClass("input-group")
                .css("margin-bottom", "6px");

            window.jQuery("<span/>")
                .addClass("input-group-addon")
                .text(label)
                .appendTo(row);

            window.jQuery("<input/>")
                .attr("type", "color")
                .attr("id", idPrefix + "-picker")
                .addClass("form-control")
                .css("max-width", "70px")
                .appendTo(row);

            window.jQuery("<input/>")
                .attr("type", "text")
                .attr("id", idPrefix + "-hex")
                .addClass("form-control")
                .attr("placeholder", "#RRGGBB or #RRGGBBAA")
                .appendTo(row);

            return row;
        }

        function numberRow(label, id, min, max, step) {
            var row = window.jQuery("<div/>")
                .addClass("input-group")
                .css("margin-bottom", "6px");

            window.jQuery("<span/>")
                .addClass("input-group-addon")
                .text(label)
                .appendTo(row);

            window.jQuery("<input/>")
                .attr("type", "number")
                .attr("id", id)
                .attr("min", min)
                .attr("max", max)
                .attr("step", step)
                .addClass("form-control")
                .appendTo(row);

            return row;
        }

        colorRow("Color", "nsb-base").appendTo(panel);

        var strokeToggle = window.jQuery("<label/>")
            .addClass("checkbox")
            .css("margin", "6px 0")
            .append(window.jQuery("<input/>").attr("type", "checkbox").attr("id", "nsb-stroke-enabled"))
            .append(" Stroke")
            .appendTo(panel);

        colorRow("Stroke", "nsb-stroke").appendTo(panel);
        numberRow("Width", "nsb-stroke-width", 0, 3, 0.5).appendTo(panel);

        var shadowToggle = window.jQuery("<label/>")
            .addClass("checkbox")
            .css("margin", "6px 0")
            .append(window.jQuery("<input/>").attr("type", "checkbox").attr("id", "nsb-shadow-enabled"))
            .append(" Shadow")
            .appendTo(panel);

        colorRow("Shadow", "nsb-shadow").appendTo(panel);
        numberRow("Blur", "nsb-shadow-blur", 0, 20, 1).appendTo(panel);

        var buttons = window.jQuery("<div/>").addClass("btn-group btn-group-sm").css("margin-top", "6px");
        var applyBtn = window.jQuery("<button/>").attr("type", "button").addClass("btn btn-primary").text("Apply").appendTo(buttons);
        var resetBtn = window.jQuery("<button/>").attr("type", "button").addClass("btn btn-default").text("Reset").appendTo(buttons);
        buttons.appendTo(panel);

        function readHex(prefix) {
            var hex = window.jQuery("#" + prefix + "-hex").val();
            if (isValidHexColor(hex)) {
                return hex;
            }
            return window.jQuery("#" + prefix + "-picker").val();
        }

        function syncPickerFromHex(prefix) {
            var hex = window.jQuery("#" + prefix + "-hex").val();
            if (isValidHexColor(hex)) {
                window.jQuery("#" + prefix + "-picker").val(toColorPickerValue(hex));
            }
        }

        ["nsb-base", "nsb-stroke", "nsb-shadow"].forEach(function (p) {
            window.jQuery(document).on("change", "#" + p + "-hex", function () {
                syncPickerFromHex(p);
            });
        });

        function populate(style) {
            style = style || {};

            var base = style.color || "#ffffff";
            window.jQuery("#nsb-base-hex").val(base);
            window.jQuery("#nsb-base-picker").val(toColorPickerValue(base));

            if (style.stroke) {
                window.jQuery("#nsb-stroke-enabled").prop("checked", true);
                window.jQuery("#nsb-stroke-hex").val(style.stroke.color || "#000000");
                window.jQuery("#nsb-stroke-picker").val(toColorPickerValue(style.stroke.color || "#000000"));
                window.jQuery("#nsb-stroke-width").val(style.stroke.width);
            } else {
                window.jQuery("#nsb-stroke-enabled").prop("checked", false);
                window.jQuery("#nsb-stroke-hex").val("#000000");
                window.jQuery("#nsb-stroke-picker").val("#000000");
                window.jQuery("#nsb-stroke-width").val(1);
            }

            if (style.shadow) {
                window.jQuery("#nsb-shadow-enabled").prop("checked", true);
                window.jQuery("#nsb-shadow-hex").val(style.shadow.color || "#000000aa");
                window.jQuery("#nsb-shadow-picker").val(toColorPickerValue(style.shadow.color || "#000000"));
                window.jQuery("#nsb-shadow-blur").val(style.shadow.blur);
            } else {
                window.jQuery("#nsb-shadow-enabled").prop("checked", false);
                window.jQuery("#nsb-shadow-hex").val("#000000aa");
                window.jQuery("#nsb-shadow-picker").val("#000000");
                window.jQuery("#nsb-shadow-blur").val(5);
            }
        }

        applyBtn.on("click", function () {
            if (!canUse()) {
                return;
            }

            var style = { color: readHex("nsb-base") };
            if (!isValidHexColor(style.color)) {
                return;
            }

            if (window.jQuery("#nsb-stroke-enabled").prop("checked")) {
                var w = parseFloat(window.jQuery("#nsb-stroke-width").val());
                var sc = readHex("nsb-stroke");
                if (!isNaN(w) && isValidHexColor(sc)) {
                    style.stroke = { width: w, color: sc };
                }
            }

            if (window.jQuery("#nsb-shadow-enabled").prop("checked")) {
                var b = parseFloat(window.jQuery("#nsb-shadow-blur").val());
                var shc = readHex("nsb-shadow");
                if (!isNaN(b) && isValidHexColor(shc)) {
                    style.shadow = { blur: b, color: shc };
                }
            }

            saveSelfStyle(style);
            setStyleForUser(getSelfName(), style);
            broadcastSet(style);
        });

        resetBtn.on("click", function () {
            if (!canUse()) {
                return;
            }

            saveSelfStyle(null);
            setStyleForUser(getSelfName(), null);
            broadcastSet(null);
            populate(null);
        });

        toggle.on("click", function (ev) {
            ev.preventDefault();
            panel.toggle();
        });

        wrap.append(toggle).append(panel);

        var chatForm = window.jQuery("#chatwrap form").first();
        if (chatForm.length) {
            wrap.insertAfter(chatForm);
        } else {
            window.jQuery("#chatwrap").append(wrap);
        }

        // Load initial style into form
        populate(loadSelfStyle());
    }

    function updateVisibility() {
        if (!window.jQuery) {
            return;
        }

        var wrap = window.jQuery("#" + WRAP_ID);
        if (!wrap.length) {
            return;
        }

        wrap.toggle(!!canUse());
    }

    function init() {
        if (!window.jQuery) {
            return;
        }

        hookCallbacks();
        hookUserlistRefresh();

        // Load any persisted styles from channel CSS (if present)
        tryHydrateFromChannelCss();

        // Wait for chat DOM
        var tries = 0;
        var boot = setInterval(function () {
            tries++;

            if (window.jQuery("#chatwrap").length) {
                clearInterval(boot);
                buildUi();
                updateVisibility();

                // If I have a saved style, announce it shortly after load
                // and also request everyone else to announce theirs.
                setTimeout(function () {
                    var mine = loadSelfStyle();
                    if (mine && canUse()) {
                        setStyleForUser(getSelfName(), mine);
                        broadcastSet(mine);
                    }
                    if (canUse()) {
                        broadcastReq();
                    }
                }, 1500);

                // Keep visible state up to date
                if (window.socket && typeof window.socket.on === "function") {
                    ["login", "rank"].forEach(function (ev) {
                        try {
                            window.socket.on(ev, updateVisibility);
                        } catch (e) {
                            // ignored
                        }
                    });
                }

                // Re-apply whenever userlist is ready
                setTimeout(function () {
                    rebuildChatCss();
                    applyAllUserlistStyles();
                }, 500);
            } else if (tries > 60) {
                clearInterval(boot);
            }
        }, 250);
    }

    init();
})();
