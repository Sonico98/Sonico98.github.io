/*!
 **|
 **|  All code written by Xaekai except where otherwise noted.
 **|  Copyright 2014-2022 All Rights Reserved
 **|
 **@preserve
 */
if (!this[CHANNEL.name]) {
	this[CHANNEL.name] = {};
}
/*!
 **|   Xaekai's Sequenced Module Loader
 **|
 **@preserve
 */
({
	options: {
		designator: { prefix: "", delay: 90 * 1e3 },
		playlist: { collapse: true, inlineBlame: true, moveReporting: true, quickQuality: true, recentMedia: true, simpleLeader: true, syncCheck: true, thumbnails: true, timeEstimates: true, volumeControl: true },
		chatext: { persistIgnore: true, smartScroll: true, maxMessages: 120 },
		userlist: { autoHider: true },
		various: { notepad: true, emoteToggle: true },
		whispers: { joins: true, parts: true },
	},
	modules: {
		settings: { active: 1, rank: -1, url: "https://resources.pink.horse/js/module_settings.min.js", done: true },
		audio: { active: 1, rank: -1, url: "https://resources.pink.horse/js/module_audiolib.js", done: true },
		privmsg: { active: 1, rank: 1, url: "https://resources.pink.horse/js/module_privmsg.min.js", done: true },
		whispers: { active: 1, rank: -1, url: "https://resources.pink.horse/js/module_whispers.min.js", done: true, cache: false },
		userlist: { active: 1, rank: -1, url: "https://resources.pink.horse/js/module_userlist.min.js", done: true },
		md5hash: { active: 1, rank: -1, url: "https://resources.pink.horse/js/module_md5.min.js", done: true },
		designator: { active: 1, rank: -1, url: "https://resources.pink.horse/js/module_designator.min.js", done: true },
		playlist: { active: 1, rank: -1, url: "https://resources.pink.horse/js/module_playlist.min.js", done: true, cache: false },
		notifier: { active: 1, rank: -1, url: "https://resources.pink.horse/js/module_alerts.min.js", done: true },
		chatline: { active: 1, rank: -1, url: "https://resources.pink.horse/js/module_chatline.min.js", done: true },
		chatext: { active: 1, rank: -1, url: "https://resources.pink.horse/js/module_chatext.min.js", done: true },
		chatcolor: { active: 1, rank: -1, url: "https://resources.pink.horse/js/module_chatcolor.min.js", done: true },
		colormap: { active: 1, rank: -1, url: "https://resources.pink.horse/js/module_colormap.min.js", done: true },
		unimoji: { active: 1, rank: -1, url: "https://resources.pink.horse/js/module_unimoji.min.js", done: true },
		dectalk: { active: 1, rank: -1, url: "https://resources.pink.horse/js/module_tts.min.js", done: true },
		hotkeys: { active: 0, rank: -1, url: "https://resources.pink.horse/js/module_hotkeys.min.js", done: true },
		layout: { active: 1, rank: -1, url: "https://resources.pink.horse/js/module_layout.min.js", done: true },
		various: { active: 1, rank: -1, url: "https://resources.pink.horse/js/module_various.min.js", done: true },
		embedmedia: { active: 1, rank: -1, url: "https://resources.pink.horse/js/module_embedmedia.min.js", done: true },
		chaticons: { active: 1, rank: -1, url: "https://resources.pink.horse/js/module_chaticons.min.js", done: true },
		ci_library: { active: 1, rank: -1, url: "https://resources.pink.horse/js/library_chaticons.min.js", done: true, cache: false },
		AvtrClient: { active: 1, rank: -1, url: "https://resources.pink.horse/js/AvatarClient.min.js", done: true },
		fancysheet: { active: 1, rank: -1, url: "https://resources.pink.horse/js/custom_fancysheet.min.js", done: true },
		customcode: { active: 1, rank: -1, url: "https://resources.pink.horse/js/custom_mlpa.min.js", done: true, cache: false },
		time: { active: 1, rank: -1, url: "https://resources.pink.horse/js/module_time.min.js", done: true },
		search: { active: 0, rank: -1, url: "https://resources.pink.horse/js/module_search.min.js", done: true },
		snow: { active: 0, rank: 1, url: "https://resources.pink.horse/js/module_snow.js", done: true },
		spider: { active: 0, rank: 1, url: "https://resources.pink.horse/js/module_spider.js", done: true },
	},
	getScript: async function ({ url, next = () => {}, cache = false }) {
		const resource = new URL(url);
		if (!cache) {
			if (resource.search) {
				resource.search += "&";
			} else {
				resource.search += "?";
			}
			resource.search += `nocache=${Date.now()}`;
		}
		const response = await fetch(resource, { cache: cache ? "default" : "reload" });
		response.blob().then((scriptBlob) => {
			let script = document.createElement("script");
			function handler(_, isAbort) {
				if (isAbort || !script.readyState || /loaded|complete/.test(script.readyState)) {
				}
				document.head.removeChild(script);
				next();
			}
			script.addEventListener("load", handler);
			script.addEventListener("error", handler);
			script.async = "async";
			script.src = URL.createObjectURL(scriptBlob);
			document.head.appendChild(script);
		});
	},
	getScriptOld: function ({ url, next, cache = true }) {
		return jQuery.ajax({ url: url, cache: cache, success: next, type: "GET", dataType: "script" });
	},
	initialize: function () {
		if (CLIENT.modules) {
			return;
		} else {
			CLIENT.modules = this;
		}
		window[CHANNEL.name].modulesOptions = this.options;
		console.info("[XaeModule]", "Begin Loading.");
		this.index = Object.keys(this.modules);
		this.sequencerLoader();
		this.cache = false;
	},
	sequencerLoader: function () {
		if (this.state.prev) {
			setTimeout(this.modules[this.state.prev].done, 0);
			this.state.prev = "";
		}
		if (this.state.pos >= this.index.length) {
			return console.info("[XaeModule]", "Loading Complete.");
		}
		var currKey = this.index[this.state.pos];
		if (this.state.pos < this.index.length) {
			if (this.modules[currKey].active) {
				if (this.modules[currKey].rank <= CLIENT.rank) {
					console.info("[XaeModule]", "Loading:", currKey);
					this.state.prev = currKey;
					this.state.pos++;
					let cache = typeof this.modules[currKey].cache == "undefined" ? this.cache : this.modules[currKey].cache;
					this.getScript({ url: this.modules[currKey].url, next: this.sequencerLoader.bind(this), cache: cache });
				} else {
					if (this.modules[currKey].rank === 0 && CLIENT.rank === -1) {
						(function (module) {
							socket.once("login", (data) => {
								if (data.success) {
									this.getScript({ url: module.url, cache: this.cache });
								}
							});
						})(this.modules[currKey]);
					}
					this.state.pos++;
					this.sequencerLoader();
				}
			} else {
				this.state.pos++;
				this.sequencerLoader();
			}
		}
	},
	state: { prev: "", pos: 0 },
}.initialize());
