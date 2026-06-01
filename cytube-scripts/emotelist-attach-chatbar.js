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
            // Simplest reliable fix: remove the backdrop in cinema mode so it can't cover the modal.
            "body.cinemachat .modal-backdrop { display: none !important; }"
        ].join("\n");
        document.head.appendChild(tag);
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

        // In cinema mode, disable/remove the backdrop so it can't steal clicks.
        $modal.on("show.bs.modal", function () {
            try {
                var $m = $(this);
                if (!$m.parent().is("body")) {
                    $m.appendTo("body");
                }

                if ($("body").hasClass("cinemachat")) {
                    var inst = $m.data("bs.modal");
                    if (inst && inst.options) {
                        inst.options.backdrop = false;
                    }
                }
            } catch (e) {
                // ignored
            }
        });

        $modal.on("shown.bs.modal", function () {
            try {
                if ($("body").hasClass("cinemachat")) {
                    $(this).css("z-index", "10050");
                    // If Bootstrap already inserted a backdrop, remove it.
                    $(".modal-backdrop").remove();
                }
            } catch (e) {
                // ignored
            }
        });
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
