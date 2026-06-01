(function () {
    "use strict";

    // Channel-JS-only helper: move the built-in "Emote List" button next to the chat input.
    // This reuses the same basic wrapping/placement approach as unimoji.js, but does NOT add
    // any new buttons.

    if (window.__emoteListAttachChatbarInstalled) {
        return;
    }
    window.__emoteListAttachChatbarInstalled = true;

    var WRAP_ID = "emotelist-chatbarwrap";
    var ZFIX_STYLE_ID = "emotelist-modal-zfix-style";
    var NO_BACKDROP_CLASS = "emotelist-nobackdrop";

    function viewportWidth() {
        return window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
    }

    function ensureChatInputGroup($) {
        if (!$("#chatinput").length) {
            // Match the approach used by unimoji.js
            $("#chatline").wrap(
                '<div onsubmit="return false" id="chatinput" class="input-group" style="width:100%">'
            );
        }
    }

    function ensureModalZFixStyle() {
        if (document.getElementById(ZFIX_STYLE_ID)) {
            return;
        }

        // Bootstrap modals default to z-index ~1050, but cinema mode uses z-index 3000+.
        // Ensure the Emote List modal always renders on top.
        var tag = document.createElement("style");
        tag.type = "text/css";
        tag.id = ZFIX_STYLE_ID;
        tag.textContent = [
            // Cinema mode uses z-index 3000+ fixed panes; keep the modal above them.
            "body.cinemachat #emotelist.modal { z-index: 10050 !important; position: fixed !important; }",
            // Only suppress the backdrop for the Emote List modal (not other modals).
            "body.cinemachat." + NO_BACKDROP_CLASS + " .modal-backdrop { display: none !important; }"
        ].join("\n");
        document.head.appendChild(tag);
    }

    function isCinemaMode() {
        return document.body && document.body.classList && document.body.classList.contains("cinemachat");
    }

    function isEmoteListOpen($) {
        var $m = $("#emotelist");
        if (!$m.length) {
            return false;
        }
        // Bootstrap 3 uses .in when shown
        return $m.hasClass("in") || $m.is(":visible");
    }

    function addBackdropIfMissing($) {
        // If a modal is open but we previously removed backdrops (cinema mode),
        // Bootstrap won't recreate it automatically.
        if ($(".modal-backdrop").length) {
            return;
        }

        var h = 0;
        try {
            h = Math.max(
                document.body ? document.body.scrollHeight : 0,
                document.documentElement ? document.documentElement.scrollHeight : 0,
                window.innerHeight || 0
            );
        } catch (e) {
            h = window.innerHeight || 0;
        }

        $("<div/>")
            .addClass("modal-backdrop fade in")
            .css("height", h + "px")
            .appendTo("body");
    }

    function syncBackdropForMode($) {
        if (!document.body) {
            return;
        }

        if (isCinemaMode() && isEmoteListOpen($)) {
            document.body.classList.add(NO_BACKDROP_CLASS);
            $(".modal-backdrop").remove();
        } else {
            document.body.classList.remove(NO_BACKDROP_CLASS);
            if (isEmoteListOpen($)) {
                addBackdropIfMissing($);
            }
        }
    }

    function hookEmoteListModalStacking() {
        if (!window.jQuery) {
            return;
        }

        var $ = window.jQuery;
        var $modal = $("#emotelist");
        if (!$modal.length || !$modal.on) {
            return;
        }

        if (window.__emoteListAttachChatbarModalHooked) {
            return;
        }
        window.__emoteListAttachChatbarModalHooked = true;

        // In cinema mode, suppress the backdrop for Emote List so it can't steal clicks.
        $modal.on("show.bs.modal", function () {
            try {
                var $m = $(this);
                if (!$m.parent().is("body")) {
                    $m.appendTo("body");
                }

                var inst = $m.data("bs.modal");
                if (isCinemaMode()) {
                    if (inst && inst.options) {
                        inst.options.backdrop = false;
                    }
                    document.body.classList.add(NO_BACKDROP_CLASS);
                } else {
                    if (inst && inst.options) {
                        inst.options.backdrop = true;
                    }
                    document.body.classList.remove(NO_BACKDROP_CLASS);
                }
            } catch (e) {
                // ignored
            }
        });

        $modal.on("shown.bs.modal", function () {
            try {
                if (isCinemaMode()) {
                    $(this).css("z-index", "10050");
                }

                // Enforce correct backdrop behavior for current mode.
                syncBackdropForMode($);
            } catch (e) {
                // ignored
            }
        });

        $modal.on("hidden.bs.modal", function () {
            try {
                // Clean up any forced styles/classes.
                $(this).css("z-index", "");
                if (document.body) {
                    document.body.classList.remove(NO_BACKDROP_CLASS);
                }
            } catch (e) {
                // ignored
            }
        });

        // Watch for cinema mode toggling while the modal is open.
        try {
            if (typeof MutationObserver === "function" && document.body) {
                var mo = new MutationObserver(function (records) {
                    records.forEach(function (rec) {
                        if (rec.type === "attributes" && rec.attributeName === "class") {
                            syncBackdropForMode($);
                        }
                    });
                });
                mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
            }
        } catch (e) {
            // ignored
        }
    }

    function moveToChatbar($) {
        var $btn = $("#emotelistbtn");
        var $chatline = $("#chatline");
        if (!$btn.length || !$chatline.length) {
            return false;
        }

        ensureChatInputGroup($);

        var $wrap = $("#" + WRAP_ID);
        if (!$wrap.length) {
            $wrap = $("<span>")
                .addClass("input-group-btn")
                .prop("id", WRAP_ID);

            // Same placement heuristic used by unimoji.js
            if ($("#videowrap").prevAll().length) {
                $wrap.insertAfter($chatline);
            } else {
                $wrap.insertBefore($chatline);
            }
        }

        // Detach keeps existing jQuery event handlers (the click binding in www/js/ui.js)
        $btn.detach().appendTo($wrap);

        // Keep it small even when attached to the input-group
        $btn.addClass("btn").addClass("btn-sm");

        // Important: the chat input is inside a <form>. If this <button> is inside the form
        // and has no explicit type, it defaults to type="submit" and can be triggered by Enter.
        $btn.attr("type", "button");

        return true;
    }

    function moveBackToControls($) {
        var $btn = $("#emotelistbtn");
        var $left = $("#leftcontrols");
        if (!$btn.length || !$left.length) {
            return false;
        }

        // Remove the chatbar wrapper if it exists
        var $wrap = $("#" + WRAP_ID);
        if ($wrap.length) {
            $wrap.remove();
        }

        // Restore original placement: after New Poll button (if present)
        var $poll = $("#newpollbtn");
        $btn.detach();
        if ($poll.length) {
            $btn.insertAfter($poll);
        } else {
            $left.append($btn);
        }

        // Restore default small-button sizing
        $btn.addClass("btn-sm");

        return true;
    }

    function applyPlacement() {
        if (!window.jQuery) {
            return false;
        }

        var $ = window.jQuery;

        // Always attach to the chat bar (per user request)
        return moveToChatbar($);
    }

    function init() {
        ensureModalZFixStyle();
        hookEmoteListModalStacking();

        var tries = 0;
        var boot = setInterval(function () {
            tries++;

            if (applyPlacement()) {
                clearInterval(boot);

                // Re-apply on resize in case the DOM is reflowed/rebuilt
                var resizeTimer = null;
                window.addEventListener("resize", function () {
                    if (resizeTimer) {
                        clearTimeout(resizeTimer);
                    }
                    resizeTimer = setTimeout(function () {
                        resizeTimer = null;
                        applyPlacement();
                    }, 250);
                });

                return;
            }

            if (tries > 80) {
                clearInterval(boot);
            }
        }, 250);
    }

    init();
})();
