{

const Core = Object.defineProperties({
	config: new Map(),
	playlists: new Map(),
	storage: {
		_attachShortcuts(key, target) {
			return Object.defineProperties(target, {
				delete: {
					value: () => localStorage.removeItem(this.keyify(key)),
					writable: true
				},
				set: {
					value: value => this.setEntry(key, value),
					writable: true
				},
				update: {
					value: value => this.setEntry(key, value),
					writable: true
				}
			})
		},
		deleteEntry(key, { temp } = {}) {
			return globalThis[(temp ? 'session' : 'local') + 'Storage'].removeItem(toolkit.keyify(key))
		},
		getEntry(key, value, { temp } = {}) {
			let entry = globalThis[(temp ? 'session' : 'local') + 'Storage'].getItem(toolkit.keyify(key));
			if (!entry && value) {
				return this.setEntry(key, value)
			}
			return entry !== null && /^[\[{]]|[}\]]$/g.test(entry) ? this._attachShortcuts(toolkit.keyify(key), JSON.parse(entry)) : entry
		},
		setEntry(key, value, { temp } = {}) {
			return globalThis[(temp ? 'session' : 'local') + 'Storage'].setItem(Core.keyify(key), typeof value == 'object' ? JSON.stringify(value) : value),
			typeof value == 'object' ? this._attachShortcuts(toolkit.keyify(key), structuredClone(value)) : value
		},
		updateEntry(key, value, { temp } = {}) {
			let entry = this.getEntry(key) || new value.constructor;
			entry instanceof Array && typeof value[Symbol.iterator] == 'function' ? entry.push(...value) : Object.assign(entry, value); // recurse?
			return this.setEntry(key, entry)
		}
	}
}, {
	_nativeEvents: { value: new Map() },
	_reportRegex: {value: function _reportRegex(message, data, { type } = {}) {
		const hrefify = a => "<a\\shref=\"" + location.origin + "\\/u\\/" + a.toLowerCase() + "\">" + a + "<\/a>";
		message = message.replace(/{data-(\w+)}/g, (_, key) => data[key]).replace(/([\(\)])/g, '\\$1').replace(/@([\w\._-]+)/, (_, t) => hrefify(t));
		return new RegExp((message ? "^" + type.replace(/^\w/, c => c.toUpperCase()) + "\\s" + message : '') + " was reported with frhd-(lite|toolkit). \\(" + hrefify('Calculus') + "\\/" + hrefify('Eric') + "\\/" + hrefify('Totoca12') + "\\)$", 'i')
	}},
	createElement: {value: function createElement(type, options = {}) {
		const callback = arguments[arguments.length - 1];
		const element = document.createElement(type.replace(/[\.#].+/g, ''));
		const matchId = type.match(/(?<=#)([^\.]+((?<=\\)\.)?)+/);
		null !== matchId && (element.setAttribute('id', matchId[0].replace(/\\/g, '')),
		type = type.replace('#' + matchId[0], ''));
		const classList = type.match(/(?<=\.)([^\.#]+((?<=\\)\.)?)+/g);
		null !== classList && element.classList.add(...classList.map(name => name.replace(/\\/g, '')));
		if ('innerText' in options) {
			element.innerText = options.innerText,
			delete options.innerText;
		}

		for (const attribute in options) {
			if (typeof options[attribute] == 'object') {
				if (options[attribute] instanceof Array) {
					if (/^children$/i.test(attribute)) {
						element.append(...options[attribute]);
					} else if (/^classlist$/i.test(attribute))
						element.classList.add(...options[attribute]);
				} else if (/^(dataset|style)$/i.test(attribute))
					Object.assign(element[attribute.toLowerCase()], options[attribute]);
				else continue;
			} else if (typeof options[attribute] == 'function') {
				if (/^mutation$/i.test(attribute)) {
					typeof options['MutationObserverOptions'] == 'object' && (new MutationObserver(options[attribute]).observe(element, options['MutationObserverOptions']),
					delete options['MutationObserverOptions']);
				} else if (element['on' + attribute] !== undefined)
					element.addEventListener(attribute, options[attribute], { passive: !/\.preventDefault\(\)/g.test(options[attribute].toString()) });
				else continue;
			} else continue;
			delete options[attribute]
		}

		Object.assign(element, options);
		typeof callback == 'function' && callback(element);
		return element
	}},
	downloadFile: {value: async function downloadFile(name, contents, { desc } = {}) {
		let mimeType = 'text/plain';
		if (!(contents instanceof Blob)) {
			typeof contents == 'object' && (mimeType = 'application/json',
			contents = JSON.stringify(contents, '\t', 4));
			if ('showSaveFilePicker' in window) {
				return showSaveFilePicker({
					excludeAcceptAllOption: true,
					startIn: 'downloads',
					suggestedName: name ?? '',
					types: [{
						description: 'Free Rider HD ' + (desc || 'File'),
						accept: { [mimeType]: ['.' + (mimeType == 'application/zip' ? 'zip' : mimeType == 'application/json' ? 'json' : 'txt')] }
					}]
				}).then(fileHandle => {
					return fileHandle.createWritable().then(writable => {
						return writable.write(contents).then(() => {
							return writable.close()
						})
					})
				}).catch(err => {
					console.warn('Download operation cancelled.', err.message)
				})
			}
		}

		let download = this.createElement('a', {
			download: name || ('frhd-toolkit_download-' + Date.now()),
			href: URL.createObjectURL(
				contents instanceof Blob ? contents : new Blob([contents], {
					type: mimeType
				})
			)
		});
		download.click();
		URL.revokeObjectURL(download.href)
	}},
	externalApi: {value: function externalApi(endpoint, payload, method) {
		if (!method && typeof payload == 'string') method = payload;
		const options = {
			headers: { Authorization: 'Bearer ' + Application.settings.app_signed_request }
		};
		if (typeof method == 'string') options.method = method;
		if (typeof payload == 'object') {
			options.headers['Content-Type'] = 'application/json';
			options.body = JSON.stringify(payload);
		}
		return fetch(`https://frhd.zengin.workers.dev/api/${endpoint}`, options).then(r => r.json())
	}},
	fetchAndCachePlaylists: {value(name) {
		typeof name == 'string' && !toolkit.playlists.has(name) && toolkit.playlists.set(name, new Map());
		for (let key of toolkit.playlists.keys()) {
			if (typeof name == 'string' && key !== name) continue;
			const entries = toolkit.storage.getEntry('playlists.' + key);
			if (null === entries) continue;
			const playlist = toolkit.playlists.get(key);
			for (const entry of entries) {
				playlist.set(String(parseInt(entry.id)), entry);
			}
		}
		return name ? toolkit.playlists.get(name) || null : toolkit.playlists
	}},
	fetchCurrentUser: {async value({ force } = {}) {
		const KEY = this.keyify('current_user');
		let cache = sessionStorage.getItem(KEY);
		if (cache && !force) {
			return JSON.parse(cache);
		}

		const { ajax } = Application.router.current_view;
		const entry = ajax && ajax.header_title && ((ajax.user && Application.settings.user.u_id === ajax.user.u_id) || Application.settings.user.u_name === ajax.header_title.toLowerCase()) ? ajax : await fetch('/u/' + Application.settings.user.u_name + '?ajax').then(r => r.json());
		sessionStorage.setItem(KEY, JSON.stringify(entry));
		return entry || null
	}},
	fetchReports: {value(...args) {
		args.length < 1 && (args.splice(0, 1, '.+'),
		args.splice(1, 1, { d_name: '\\w+', u_id: '\\d+' }),
		args.splice(2, 1, type = '\\w+'));
		const comments = Array.from(document.querySelectorAll('.track-comment-msg'));
		const reportRegex = this._reportRegex(...args);
		return comments.filter(t => t.innerHTML.match(reportRegex))
	}},
	initLeaderboardEvent: {value() {
		const renderLeaderboards = Application.Views.TrackView.prototype._render_leaderboards;
		this._nativeEvents.set('leaderboardEvent', renderLeaderboards);
		Application.Views.TrackView.prototype._render_leaderboards = function(e) {
			renderLeaderboards.apply(this, arguments);
			e.result && (this.trigger('leaderboard.rendered', ...arguments),
			Application.events.publish('leaderboard.rendered', ...arguments))
		}
	}},
	isUserModerator: {value(data) {
		data.hasOwnProperty('user') && (data = data.user);
		return data.moderator || data.admin
	}},
	keyify: {value(key) {
		return key.replace(/^(?:frhd-toolkit\.)?(.+)/i, 'frhd-toolkit.$1')
	}},
	report: {value: function report(message, data = {}, { type } = {}) {
		if (!Application.settings.user) return alert('You must be logged in to perform this action.');
		data = Object.assign({}, data, { t_id: GameSettings.track.id });
		window.postMessage({
			action: 'report',
			data,
			reporter: Application.settings.user,
			type
		});
		return Application.Helpers.AjaxHelper.post('track_comments/post', {
			t_id: data.t_id,
			msg: message.replace(/{data-(\w+)}/g, (_, key) => data[key]) + ' was reported with frhd-toolkit. (@Calculus/@Eric/@Totoca12)'
		})
	}},
	verifyRaceData: {value: function verifyRaceData(data) {
		typeof data.race.code == 'string' && (data.race.code = JSON.parse(data.race.code));
		let isTas = true == 'tas' in data.race.code;
		let duplicateInputs = 0;
		for (let i in data.race.code) {
			if (!/_down$/i.test(i)) continue;
			let key = i.replace(/_\w+$/i, '');
			let ticksDown = Object.keys(data.race.code[i]);
			if (!data.race.code[key + '_up']) continue;
			for (let s of ticksDown) {
				data.race.code[key + '_up'][s] > 0 && (isTas = true,
				duplicateInputs++)
			}
		}
		duplicateInputs > 0 && (isTas = true);
		console.debug(data.race.code, duplicateInputs, isTas);
		return !isTas
	}},
	waitForElm: {value: function waitForElm(selector, limit) {
		return new Promise((resolve, reject) => {
			let element = document.querySelector(selector);
			if (element)
				return resolve(element);
			new MutationObserver((mutations, observer) => {
				if (!mutations.find(({ addedNodes }) => addedNodes.length > 0)) return;
				element = document.querySelector(selector);
				element && (resolve(element),
				observer.disconnect())
			}).observe(document.body, {
				childList: true,
				subtree: true
			});
			limit && setTimeout(reject, limit, new Error('Operation timed out'))
		})
	}},
	warn: {value: function warn(err) {
		console.log('%cFree Rider Toolkit', `
			background-color: hsl(207deg 33% 33%);
			border: 1px solid hsl(0 0% 50% / 12.5%);
			border-radius: .25em;
			color: white;
			font-size: .95em;
			font-weight: bold;
			line-height: 1em;
			padding: .05em .33em;
		`, err)
	}}
});

Object.defineProperty(Core, 'modules', {
	value: new ModuleLoader(Core)
});

addEventListener('message', ({ data }) => {
	if (!data || data.sender != 'frhd-toolkit') return;
	switch (data.action) {
	case 'setStorage':
		for (const [key, value] of Object.entries(data.storage))
			Core.config.set(key, value);
		// Trigger initial load -- no longer necessary
		break;
	case 'updateStorage':
		let oldStorage = new Map(Core.config);
		for (const [key, value] of Object.entries(data.storage))
			Core.config.set(key, value);
		let changes = new Map();
		for (const [key, value] of Core.config.entries()) {
			if (JSON.stringify(value) == JSON.stringify(oldStorage.get(key))) continue;
			changes.set(key, value);
		}
		// Refresh modules that may change based on new settings
		// Core.refresh(changes);
	}
}, { passive: true });

document.addEventListener('DOMContentLoaded', function() {
	Object.defineProperty(Core, '_styleSheet', {
		value: document.head.appendChild(Core.createElement('style', { id: 'frhd-toolkit.style' }))
	});
	Core.styleSheet = ThirdPartyStyleManager.createProxyStyle(Core._styleSheet);

	self.hasOwnProperty('Application') && (Object.defineProperty(Application.Helpers.AjaxHelper, 'lastRequest', { value: null, writable: true }),
	Application.router && Object.defineProperty(Application.router.current_view, 'ajax', { value: null, writable: true }),
	Application.events.subscribe('ajax.request', e => (Application.Helpers.AjaxHelper.lastRequest = e,
	typeof e.header_title == 'string' && (Application.router.current_view.ajax = e))))
}, { once: true, passive: true });

Object.defineProperty(self, 'toolkit', { value: Core });

}