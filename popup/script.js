import "../utils/Storage.js";
import defaults from "../constants/defaults.js";

// const state = document.querySelector('#state');
// state.addEventListener('click', function(event) {
// 	if (this.classList.contains('update-available')) {
// 		return chrome.runtime.reload();
// 	} else if (event.altKey && event.shiftKey) {
// 		return window.open(chrome.runtime.getURL('dashboard/index.html'))
// 	}

// 	chrome.storage.proxy.local.set('enabled', !chrome.storage.proxy.local.get('enabled'))
// }, { passive: true });

const sponsor = document.querySelector('#sponsor');
sponsor.addEventListener('click', function() {
	chrome.tabs.create({ url: 'https://github.com/sponsors/Calculamatrise' })
}, { passive: true });

const dashboard = document.querySelector('#dashboard');
dashboard.addEventListener('click', function() {
	chrome.runtime.openOptionsPage()
}, { passive: true });

chrome.storage.local.onChanged.addListener(({ settings }) => {
	settings && restoreSettings(settings.newValue)
});

chrome.storage.local.get(({ badges, settings }) => {
	for (const element of document.querySelectorAll('.notification')) {
		if (badges === false) {
			element.classList.remove('notification');
			continue;
		}

		element.addEventListener('click', event => {
			chrome.storage.local.set({ badges: false }).then(() => {
				event.target.classList.remove('notification')
			})
		}, { passive: true });
	}

	restoreSettings(settings)
});

// chrome.storage.session.get(({ updateAvailable = false }) => {
// 	updateAvailable && state.classList.add('update-available') // chrome.action.setBadgeText({ text: '' });
// });

const resetSettings = document.querySelector('#reset-settings');
resetSettings.addEventListener('click', () => {
	confirm(`Are you sure you'd like to reset all your settings?`) && chrome.storage.local.set({ settings: defaults }).then(() => {
		alert("Your settings have successfully been reset.")
	})
}, { passive: true });

for (const item in defaults) {
	let element = document.getElementById(item);
	if (!element) continue;
	switch (element.type.toLowerCase()) {
	case 'checkbox':
		element.addEventListener('change', ({ target }) => {
			chrome.storage.proxy.local.settings.set(target.id, target.checked)
		}, { passive: true });
		break;
	case 'range':
		element.addEventListener('input', ({ target }) => {
			chrome.storage.proxy.local.settings.set(item, parseFloat(target.value) || 0)
		}, { passive: true })
	}
}

function restoreSettings(data) {
	for (const item in data) {
		let element = document.getElementById(item);
		switch (item) {
		case 'developerMode':
			for (let dropdown of document.querySelectorAll('[data-type="experiments"]')) {
				dropdown.style[(data[item] ? 'remove' : 'set') + 'Property']('display', 'none');
			}
		}
		if (!element) continue;
		switch (element.type.toLowerCase()) {
		case 'checkbox':
			element.checked = data[item];
			break;
		case 'range':
			element.value = data[item];
			var name = element.parentElement.querySelector('.name');
			name.dataset.value = element.value
		}
	}
}

const version = document.querySelector('#version');
version.textContent = await getVersion();

function getVersion() {
	return new Promise(resolve => {
		chrome.storage.session.get(async ({ version }) => {
			if (!version) {
				var { version } = chrome.runtime.getManifest();
				await chrome.storage.session.set({ version });
			}

			resolve(version)
		})
	})
}