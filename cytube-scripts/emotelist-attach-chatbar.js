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
