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
        var $ = window.jQuery;

        if (!$("#chatinput").length && $("#chatline").length) {
            $("#chatline").wrap(
                '<div onsubmit="return false" id="chatinput" class="input-group" style="width:100%">'
            );
        }
    }

    function isPaused() {
        try {
            if (window.PLAYER && typeof window.PLAYER.paused === "boolean") {
                return window.PLAYER.paused;
            }
            if (window.PLAYER && window.PLAYER.player) {
                if (typeof window.PLAYER.player.paused === "function") {
                    return !!window.PLAYER.player.paused();
                }
                if (typeof window.PLAYER.player.paused === "boolean") {
                    return window.PLAYER.player.paused;
                }
            }
        } catch (e) {
            // ignored
        }
        return false;
    }

    function playOrPauseLocal() {
        if (!window.PLAYER) {
            return;
        }

        if (isPaused()) {
            if (typeof window.PLAYER.play === "function") {
                window.PLAYER.play();
                return;
            }
            if (window.PLAYER.player && typeof window.PLAYER.player.play === "function") {
                window.PLAYER.player.play();
                return;
            }
            return;
        }

        if (typeof window.PLAYER.pause === "function") {
            window.PLAYER.pause();
            return;
        }
        if (window.PLAYER.player && typeof window.PLAYER.player.pause === "function") {
            window.PLAYER.player.pause();
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

        var $ = window.jQuery;

        if ($("#" + WRAP_ID).length) {
            return;
        }

        ensureChatInputGroup();

        var wrap = $("<span/>")
            .attr("id", WRAP_ID)
            .addClass("input-group-btn")
            .hide();

        var btn = $("<button/>")
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

        placeUi();
    }

    function placeUi() {
        if (!window.jQuery) {
            return;
        }
        var $ = window.jQuery;

        var wrap = $("#" + WRAP_ID);
        if (!wrap.length) {
            return;
        }

        ensureChatInputGroup();

        // Desired: immediately to the right of the Emote List button.
        var emoteBtn = $("#emotelistbtn");
        if (emoteBtn.length) {
            wrap.detach().insertAfter(emoteBtn);
            return;
        }

        // Fallback: attach next to chatline inside the input-group.
        var chatline = $("#chatline");
        if (chatline.length) {
            wrap.detach().insertAfter(chatline);
            return;
        }

        // Last resort
        var form = $("#chatwrap form").first();
        if (form.length) {
            wrap.detach().insertAfter(form);
        }
    }

    function pauseAndBroadcast() {
        try {
            playOrPauseLocal();
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

        placeUi();

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

        // Display play/pause symbol based on current state.
        // Note: Clicking still follows the original behavior (take leader -> control playback;
        // if already leader -> release leader).
        btn.text(isPaused() ? "▶" : "⏸");
        btn.attr("title", isPaused() ? "Play" : "Pause");
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
