(function () {
    "use strict";

    // Avoid double-install if the snippet is injected more than once
    if (window.__pauseVideoLeaderToggleInstalled) {
        return;
    }
    window.__pauseVideoLeaderToggleInstalled = true;

    var WRAP_ID = "pause-video-leader-toggle";
    var BTN_ID = "pause-video-leader-toggle-btn";

    function ensureChatInputGroup() {
        if (!window.jQuery) {
            return;
        }

        // Match the approach used by unimoji.js
        if (!window.jQuery("#chatinput").length && window.jQuery("#chatline").length) {
            window.jQuery("#chatline").wrap(
                '<div onsubmit="return false" id="chatinput" class="input-group" style="width:100%">'
            );
        }
    }

    function hasLeaderCtl() {
        try {
            if (typeof window.hasPermission === "function") {
                return window.hasPermission("leaderctl");
            }
        } catch (e) {
            // ignored
        }

        if (window.CLIENT && typeof window.CLIENT.rank === "number" && window.Rank) {
            return window.CLIENT.rank >= window.Rank.Moderator;
        }

        return false;
    }

    function shouldShow() {
        if (!window.CLIENT) {
            return false;
        }

        // "currently logged in user"
        if (!window.CLIENT.logged_in || window.CLIENT.guest) {
            return false;
        }

        // Moderator/Admin/Owner (or equivalent permission)
        return hasLeaderCtl();
    }

    function ensureUi() {
        if (!window.jQuery) {
            return;
        }

        if (window.jQuery("#" + WRAP_ID).length) {
            return;
        }

        ensureChatInputGroup();

        var wrap = window.jQuery("<span/>")
            .attr("id", WRAP_ID)
            .addClass("input-group-btn")
            .hide();

        var btn = window.jQuery("<button/>")
            .attr("id", BTN_ID)
            .attr("type", "button")
            .addClass("btn btn-sm btn-default")
            .attr("title", "Pause/Play")
            .attr("aria-label", "Pause/Play")
            .text("⏸");

        btn.on("click", function (ev) {
            ev.preventDefault();

            if (!shouldShow()) {
                return;
            }

            if (!window.socket || !window.CLIENT || !window.CLIENT.name) {
                return;
            }

            // Toggle behavior:
            // - not leader: take leader, then pause
            // - already leader: release leader
            if (window.CLIENT.leader) {
                window.socket.emit("assignLeader", { name: "" });
                return;
            }

            window.socket.emit("assignLeader", { name: window.CLIENT.name });

            // Wait briefly for the server to confirm leader status (setLeader event)
            // so that the ensuing pause propagates to other users.
            var start = Date.now();
            var t = setInterval(function () {
                if (window.CLIENT && window.CLIENT.leader) {
                    clearInterval(t);
                    pauseAndBroadcast();
                } else if (Date.now() - start > 2000) {
                    clearInterval(t);
                    pauseAndBroadcast();
                }
            }, 50);
        });

        wrap.append(btn);

        // Embed into the chat bar like unimoji.js
        ensureChatInputGroup();
        var chatline = window.jQuery("#chatline");
        if (chatline.length) {
            if (window.jQuery("#videowrap").prevAll().length) {
                wrap.insertAfter(chatline);
            } else {
                wrap.insertBefore(chatline);
            }
        } else {
            // Fallback: old placement under chat (should be rare)
            var form = window.jQuery("#chatwrap form").first();
            if (form.length) {
                wrap.insertAfter(form);
            } else {
                window.jQuery("#chatwrap").append(wrap);
            }
        }
    }

    function pauseAndBroadcast() {
        try {
            if (window.PLAYER && typeof window.PLAYER.pause === "function") {
                window.PLAYER.pause();
            }
        } finally {
            // Some player implementations already call sendVideoUpdate() on pause.
            // Calling it here is harmless and ensures the paused state is sent.
            if (window.CLIENT && window.CLIENT.leader && typeof window.sendVideoUpdate === "function") {
                window.sendVideoUpdate();
            }
            updateUi();
        }
    }

    function updateUi() {
        if (!window.jQuery) {
            return;
        }

        ensureChatInputGroup();

        var wrap = window.jQuery("#" + WRAP_ID);
        if (!wrap.length) {
            return;
        }

        var show = shouldShow();
        wrap.toggle(!!show);

        var btn = window.jQuery("#" + BTN_ID);
        if (!btn.length) {
            return;
        }

        if (!show) {
            return;
        }

        btn.prop("disabled", !(window.socket && window.PLAYER));
        btn.text(window.CLIENT && window.CLIENT.leader ? "▶" : "⏸");
    }

    function hookSocket() {
        if (!window.socket || typeof window.socket.on !== "function") {
            return;
        }

        if (window.__pauseVideoLeaderToggleSocketHooked) {
            return;
        }
        window.__pauseVideoLeaderToggleSocketHooked = true;

        // These events map to rank/login/leader changes in CyTube
        ["setLeader", "rank", "login", "setUserRank"].forEach(function (ev) {
            try {
                window.socket.on(ev, updateUi);
            } catch (e) {
                // ignored
            }
        });
    }

    function init() {
        if (!window.jQuery) {
            return;
        }

        // Wait for the chat DOM to exist (channel JS can run early)
        var tries = 0;
        var boot = setInterval(function () {
            tries++;

            if (window.jQuery("#chatwrap").length) {
                clearInterval(boot);
                ensureUi();
                updateUi();
                hookSocket();

                // Keep the UI in sync with rank/login/leader changes.
                setInterval(updateUi, 2000);
            } else if (tries > 60) {
                clearInterval(boot);
            }
        }, 250);
    }

    init();
})();
