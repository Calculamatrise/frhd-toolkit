import defaults from "./constants/defaults.js";

const excludeMatches = [
	"*://*/*?ajax*",
	"*://*/*&ajax*",
	"*://*.com/track_api/*"
];
const documentUrlPatterns = [
	"*://frhd.kanoapps.com/*",
	"*://www.freeriderhd.com/*"
];
const moduleScript = {
	excludeMatches,
	id: "features",
	js: [
		// "features/bestRaceDate.js",
		// "features/contextMenu.js",
		"features/deleteRaces.js",
		"features/deleteTracks.js",
		"features/downloadRaces.js",
		"features/downloadTracks.js",
		"features/extendedSettings.js",
		"features/improvedComments.js",
		"features/jumpToComment.js",
		"features/raceMetadata.js",
		"features/reportRelay.js",
		// "features/profileSearch.js",
		"features/userAnalytics.js"
	],
	matches: documentUrlPatterns,
	runAt: "document_end",
	world: "MAIN"
};
const contentScripts = [{
	excludeMatches,
	id: "preload",
	js: [
		"preload/moduleLoader.js",
		"preload/ThirdPartyStyleManager.js",
		"core/core.js",
		"shared/ContextMenu.js",
		"shared/Zip.js"
	],
	matches: documentUrlPatterns,
	runAt: "document_start",
	world: "MAIN"
}, {
	excludeMatches,
	id: "connection-broker",
	js: ["broker.js"],
	matches: documentUrlPatterns,
	runAt: "document_start"
}, moduleScript];

chrome.runtime.onInstalled.addListener(function() {
	chrome.storage.local.get(async ({ badges, settings }) => {
		if (badges != null) await chrome.storage.local.remove('badges');

		if (settings instanceof Object) {
			const keys = Object.keys(defaults);
			const foreignKeys = Object.keys(settings);
			const deprecatedKeys = foreignKeys.filter(key => !keys.includes(key));
			for (const key of deprecatedKeys) {
				delete settings[key];
			}
		}

		settings = Object.assign({}, defaults, settings);

		await updateModuleScript(settings);
		await chrome.scripting.registerContentScripts(contentScripts);

		chrome.storage.local.set({ settings });

		await createContextMenuOptions()
	})
});

chrome.runtime.onStartup.addListener(function() {
	self.dispatchEvent(new ExtendableEvent('activate'))
});

chrome.runtime.onUpdateAvailable.addListener(async function() {
	await chrome.storage.session.set({ updateAvailable: true });
	await chrome.action.setBadgeBackgroundColor({ color: '#b87c14' });
	chrome.action.setBadgeText({ text: '1' })
});

chrome.storage.local.onChanged.addListener(async function({ settings }) {
	settings && await updateModuleScript(settings.newValue);
	await chrome.scripting.updateContentScripts([moduleScript]);
	updateState()
});

self.addEventListener('activate', () =>
	chrome.storage.local.get(({ settings }) =>
		settings != null && updateState()
	)
);

function updateState() {
	return chrome.storage.local.get(({ settings }) => {
		const enabled = settings && -1 !== Object.entries(settings)
			.filter(([key]) => !['developerMode'].includes(key))
			.findIndex(([, value]) => value === true);
		return updateIcon(enabled)
	})
}

function updateIcon(enabled = true) {
	const path = size => `/icons/${enabled ? '' : 'disabled/'}icon_${size}.png`;
	return chrome.action.setIcon({
		path: {
			16: path(16),
			48: path(48),
			128: path(128)
		}
	})
}

chrome.contextMenus.onClicked.addListener(function(event) {
	chrome.storage.local.get(({ settings }) => {
		switch(event.menuItemId) {
		default:
			settings[event.menuItemId] = event.checked;
			chrome.storage.local.set({ settings })
		}
	})
});

function createContextMenuOptions() {
	return chrome.storage.local.get(async ({ settings }) => {
		const options = {
			accountManager: { checked: settings.accountManager, title: 'Account manager', type: 'checkbox' },
			achievementMonitor: { checked: settings.achievementMonitor, title: 'Achievement monitor', type: 'checkbox' },
			featuredGhostsDisplay: { checked: settings.featuredGhostsDisplay, title: 'Highlight featured races', type: 'checkbox' },
			playlists: { checked: settings.playlists, title: 'Track playlists', type: 'checkbox' },
			profileSearch: { checked: settings.profileSearch, title: 'Profile search', type: 'checkbox' }
		};
		for (const option in options) {
			await chrome.contextMenus.create(Object.assign({
				contexts: ['page'],
				documentUrlPatterns,
				id: option,
				type: 'normal'
			}, options[option]))
		}
	})
}

async function updateModuleScript(settings) {
	const scripts = moduleScript.js;
	const oldScripts = JSON.stringify(scripts);
	for (const module in settings) {
		switch (module) {
		case 'developerMode':
		case 'flagSensitivity':
		case 'lastSeenProfile':
			continue;
		}

		const enabled = settings[module];
		const path = `features/${module}.js`;
		if (enabled) {
			scripts.push(path);
		} else if (scripts.includes(path)) {
			scripts.splice(scripts.indexOf(path), 1);
		}
	}

	if (oldScripts === JSON.stringify(scripts)) return;

	// return chrome.scripting.updateContentScripts([moduleScript])
	// await chrome.scripting.unregisterContentScripts();
	// return chrome.scripting.registerContentScripts(contentScripts)
}

// const webhook = {
// 	id: '1254881864557264957',
// 	secret: 'XQ-9eJh-fxHfn3jgbozovFcHQVhk601Z1-Hks4UWKFKtx2CrNnk7KhlxH1Je-5T-_xVT'
// };
// chrome.webRequest.onCompleted.addListener(async function({ initiator, url }) {
// 	const { pathname } = new URL(url);
// 	if (pathname.startsWith('/track_api/flag')) {
// 		const reporter = await fetch(`${initiator}/account/settings?ajax`)
// 			.then(r => r.json())
// 			.then(r => r.user);
// 		const [trackId] = pathname.match(/(?<=flag\/)\d+/);
// 		const shortUrl = 'http://frhd.co/';
// 		fetch('https://discord.com/api/webhooks/' + webhook.id + '/' + webhook.secret, {
// 			body: JSON.stringify({
// 				content: '[Track](<' + shortUrl + 't/' + trackId + '>) was reported by [' + reporter.d_name + '](<' + shortUrl + 'u/' + reporter.u_name + '>).'
// 			}),
// 			headers: { 'Content-Type': 'application/json' },
// 			method: 'POST'
// 		}).then(r => r.text())
// 	}
// }, {
// 	urls: [
// 		"*://frhd.kanoapps.com/track_api/flag/*",
// 		"*://www.freeriderhd.com/track_api/flag/*"
// 	]
// });

const XML_SPECIAL_CHAR_MAP = {
	'<': '&lt;',
	'>': '&gt;',
	'&': '&amp;',
	'"': '&quot;',
	"'": '&apos;'
};
const escapeXML = str => str.replace(/[<>&"'"]/g, c => XML_SPECIAL_CHAR_MAP[c]);
chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
	let suggestions;
	if (text.startsWith('@')) {
		const query = text.slice(1);
		const r = await fetch('https://www.freeriderhd.com/search/u_mention_lookup/' + query)
			.then(r => r.json())
			.then(r => r.code && r.data);

		const lower = query.toLowerCase();
		suggestions = r.map(u => ({
			content: '@' + u.d_name,
			description: `${u.u_name.startsWith(lower) ? `<match>${u.d_name.slice(0, query.length)}</match>${u.d_name.slice(query.length)}` : u.d_name} - <url>frhd.co/u/${u.u_name}</url>`
		}));
	} /* else if (text.startsWith('/')) {
		// Commands or routes
		const query = text.slice(1);
		const r = [{
			name: 'Home',
			value: '/'
		}, {
			name: 'Draw',
			value: '/create'
		}, {
			name: 'Forums',
			value: '/community'
		}];

		const lower = query.toLowerCase();
		suggestions = r.map(r => ({
			content: '/' + r.name,
			description: `${r.name.toLowerCase().startsWith(lower) ? `<match>${r.name.slice(0, query.length)}</match>${r.name.slice(query.length)}` : r.name} - <url>frhd.co${r.value}</url>`
		}));
	} */ else {
		const r = await fetch(`https://www.freeriderhd.com/search/t/${encodeURIComponent(text)}?ajax`)
			.then(r => r.json())
			.then(r => r.tracks);
		if (isFinite(text)) {
			const match = await fetch(`https://www.freeriderhd.com/track_api/load_track?id=${text}&fields[]=title&fields[]=slug`)
				.then(r => r.json())
				.then(r => r.result && r.data.track);
			if (match) r.unshift(match);
		}

		const lower = text.toLowerCase();
		suggestions = r.map(t => ({
			content: t.slug,
			description: `${t.title.toLowerCase().startsWith(lower) ? `<match>${escapeXML(t.title.slice(0, text.length))}</match>${escapeXML(t.title.slice(text.length))}` : escapeXML(t.title)} - <url>frhd.co/t/${escapeXML(t.slug)}</url>`
		}));
	}

	const firstSuggestion = suggestions.shift();
	if (suggestions.length > 0) suggest(suggestions);

	if (!firstSuggestion) return;
	chrome.omnibox.setDefaultSuggestion({ description: firstSuggestion.description })
});

chrome.omnibox.onInputEntered.addListener((text, disposition) => {
	const url = `http://frhd.co/${text.startsWith('@') ? `u/${encodeURIComponent(text.slice(1))}` : `t/${text}`}`;

	switch(disposition) {
	case 'currentTab':
		chrome.tabs.update({ url });
		break;
	case 'newForegroundTab':
		chrome.tabs.create({ url });
		break;
	case 'newBackgroundTab':
		chrome.tabs.create({ url, active: false })
	}
})

import "./externalApi.js";