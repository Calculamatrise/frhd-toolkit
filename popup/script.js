import "../utils/Storage.js";
import defaults from "../constants/defaults.js";

const state = document.querySelector('#state');
state.addEventListener('click', function(event) {
	if (this.classList.contains('update-available')) {
		return chrome.runtime.reload();
	} else if (event.altKey && event.shiftKey) {
		return window.open(chrome.runtime.getURL('dashboard/index.html'))
	}

	chrome.storage.proxy.local.set('enabled', !chrome.storage.proxy.local.get('enabled'))
}, { passive: true });

const sponsor = document.querySelector('#sponsor');
sponsor.addEventListener('click', function() {
	chrome.tabs.create({ url: 'https://github.com/sponsors/Calculamatrise' })
}, { passive: true });

chrome.storage.local.onChanged.addListener(({ enabled, settings }) => {
	settings && restoreSettings(settings.newValue),
	enabled && setState(enabled.newValue)
});

chrome.storage.local.get(({ badges, enabled, settings }) => {
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

	restoreSettings(settings),
	setState(enabled)
});

chrome.storage.session.get(({ updateAvailable = false }) => {
	updateAvailable && state.classList.add('update-available') // chrome.action.setBadgeText({ text: '' });
});

const resetSettings = document.querySelector('#reset-settings');
resetSettings.addEventListener('click', () => {
	confirm(`Are you sure you'd like to reset all your settings?`) && chrome.storage.local.set({ settings: defaults }).then(() => {
		alert("Your settings have successfully been reset.")
	})
}, { passive: true });

for (const item in defaults) {
	let element = document.getElementById(item);
	switch (item) {
	case 'keymap':
		let action = document.querySelector('#keybind-action');
		action && action.addEventListener('change', event => {
			element.value && saveKeybind(element.value, event.target.value);
		}, { passive: true });
		element.addEventListener('keyup', event => {
			event.target.value.length > 0 && (event.target.value = event.key.toUpperCase());
			action.value !== 'default' && saveKeybind(event.key, action.value)
		}, { passive: true });
		function saveKeybind(key = element.value, value = action.value) {
			if (typeof key != 'string' || typeof value != 'string') return;
			chrome.storage.proxy.local.settings.keymap[key.toUpperCase()] = value;
			action && (action.value = 'default');
			element.value = null
		}
	}
	if (!element) continue;
	switch (element.type.toLowerCase()) {
	case 'checkbox':
		element.addEventListener('change', ({ target }) => {
			chrome.storage.proxy.local.settings.set(target.id, target.checked)
		}, { passive: true });
		break;
	case 'range':
		element.addEventListener('input', event => {
			chrome.storage.proxy.local.settings.set(item, parseFloat(event.target.value) || 0)
		}, { passive: true })
	}
}

const rippleCache = new WeakMap();
document.documentElement.addEventListener('pointerdown', function (event) {
	event.target.style.setProperty('--offsetX', event.offsetX);
	event.target.style.setProperty('--offsetY', event.offsetY);
	rippleCache.has(event.target) && clearTimeout(rippleCache.get(event.target));
	const timeout = setTimeout(() => {
		event.target.style.removeProperty('--offsetX', event.offsetX);
		event.target.style.removeProperty('--offsetY', event.offsetY);
		event.target.style.length === 0 && event.target.removeAttribute('style');
		rippleCache.delete(event.target)
	}, 1e3);
	rippleCache.set(event.target, timeout)
});

function setState(enabled) {
	state.classList[enabled ? 'add' : 'remove']('enabled');
	return enabled
}

function restoreSettings(data) {
	for (const item in data) {
		let element = document.getElementById(item);
		switch (item) {
		case 'keymap':
			var action = document.querySelector('#keybind-action')
			  , entries = document.querySelector('#keybind-entries')
			  , keymap = Object.entries(data[item]);
			entries.replaceChildren(...keymap.map(([key, value]) => {
				let wrapper = document.createElement('div');
				wrapper.classList.add('keybind-wrapper');
				let select = wrapper.appendChild(action.cloneNode(true));
				select.removeAttribute('id');
				select.disabled = true;
				select.value = value;
				// subject to change
				select.addEventListener('change', event => {
					if (event.target.value === 'remove') {
						delete chrome.storage.proxy.local.settings.keymap[key]
					}
				}, { passive: true });
				select.replaceChildren(...Array.from(select.children).filter(opt => {
					return opt.value === select.value /*//*/ || opt.value === 'default';
				}));
				let remove = select.appendChild(document.createElement('option'));
				remove.innerText = 'Remove';
				remove.value = 'remove';
				select.addEventListener('pointerenter', () => select.disabled = !1, { passive: true });
				select.addEventListener('pointerleave', () => select.disabled = !0, { passive: true });
				let input = wrapper.appendChild(document.createElement('input'));
				input.setAttribute('type', 'text');
				input.readOnly = true;
				input.value = key.toUpperCase();
				return wrapper;
			}));
			break;
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