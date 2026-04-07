{

Object.defineProperty(toolkit, 'setCookie', {value(key, value, { days, domain, reload } = {}) {
	let entries = { [key]: value ?? '' };
	days && (entries.expires = new Date(864e5 * days + Date.now()).toUTCString());
	entries.domain = domain ?? ('.' + location.host);
	entries.path = '/';
	document.cookie = Object.entries(entries).map(([key, value]) => key + '=' + value).join('; ');
	reload && location.reload()
}});

Object.defineProperty(toolkit, 'getAccountManager', {value({ createIfNotExists }) {
	(this.accountManager || createIfNotExists) && (Object.defineProperty(this, 'accountManager', {
		value: document.body.appendChild(toolkit.createElement("dialog#frhd-toolkit\\.account-manager", {
			children: [
				toolkit.createElement("span.core_icons.core_icons-icon_close.signup-login-modal-close", {
					style: {
						position: 'absolute',
						right: '.5em',
						top: '.5em'
					},
					click: () => this.accountManager.close()
				}),
				toolkit.createElement("div.accounts-container", {
					children: Object.values(toolkit.storage.getEntry('account-manager') ?? {}).map(account => createAccountContainer(account)),
					style: {
						display: 'flex',
						flexDirection: 'column',
						gap: '0.4rem'
					}
				}),
				toolkit.createElement("button.new-button.button-type-2", {
					id: 'add-account',
					innerText: "Add account",
					click: () => this.accountManager.close('add-account')
				}),
				toolkit.createElement("button.new-button.button-type-3", {
					innerText: "Logout",
					click: () => this.accountManager.close('logout')
				})
			],
			click: event => {
				if (this.accountManager !== event.target) return;
				let rect = event.target.getBoundingClientRect()
					, isInDialog = (rect.top <= event.clientY && event.clientY <= rect.top + rect.height &&
					rect.left <= event.clientX && event.clientX <= rect.left + rect.width);
				!isInDialog && event.target.close()
			},
			close: event => {
				switch (event.target.returnValue) {
				case 'add-account':
					Application.Helpers.TemplateHelper.getTemplates(["auth/signup_login"], function(t) {
						Application.router.auth_dialog_view.template = t["auth/signup_login"],
						Application.router.auth_dialog_view.options = Object.assign({}, Application.settings, { login: true }),
						Application.router.auth_dialog_view.setup()
					});
					break;
				case 'logout':
					Application.User.logout()
				}
			},
			showModal(target) {
				switch (target) {
				case 'login':
					let addAccount = this.querySelector('#add-account');
					addAccount && !/^cancel$/i.test(addAccount.innerText) && addAccount.click()
				}
				return HTMLDialogElement.prototype.showModal.call(this)
			}
		})),
		writable: true
	}), this.styleSheet.set('dialog#frhd-toolkit\\.account-manager[open]', {
		display: 'flex',
		flexDirection: 'column',
		gap: '0.4em',
		height: 'fit-content',
		inset: 0,
		margin: 'auto',
		maxHeight: '50vmin',
		maxWidth: '25vw',
		minWidth: '230px',
		overflow: 'hidden auto',
		padding: '2.5em',
		position: 'fixed',
		width: '40vmin',
		zIndex: 1002
	}).set('dialog#frhd-toolkit\\.account-manager[open]::backdrop', {
		backgroundColor: 'hsl(0deg 0% 0% / 50%)'
	}).set('.button-type-3', {
		backgroundImage: 'linear-gradient(to bottom, hsl(7 86% 62% / 1), hsl(10 64% 46% / 1))'
	}).set('.button-type-3:hover', {
		backgroundImage: 'linear-gradient(to bottom, hsl(4 79% 60% / 1), hsl(4 69% 37% / 1))'
	}));
	return this.accountManager
}});

let subscribed = false;
toolkit.modules.register('accountManager', function() {
	if (!subscribed) {
		Application.events.subscribe('auth.login', user => {
			sessionStorage.clear();
			// toolkit.storage.deleteEntry('current_user', { temp: true });
			user.u_id && toolkit.storage.updateEntry('account-manager', {
				[user.u_id]: {
					asr: Application.settings.app_signed_request,
					name: user.d_name
				}
			})
		});

		subscribed = true;
		if (Application.User.logged_in) {
			let accounts = toolkit.storage.getEntry('account-manager') || {};
			if (Object.keys(accounts) < 1) {
				toolkit.storage.updateEntry('account-manager', {
					[Application.settings.user.u_id]: {
						asr: Application.settings.app_signed_request,
						name: Application.settings.user.d_name
					}
				})
			}
		}
	}
	// modify function to save token/login?
	// or subscribe auth.login and save asr
	// this.replaceLogin(); vvv
	// Application.router.auth_dialog_view.login_with_email
	if (!Application.User.logged_in) return;
	let logout = Application.router.left_navigation_view.el.querySelector('a.logout');
	if (!logout.hasAttribute('id')) return;
	logout.removeAttribute('id'),
	logout.innerText = "Switch",
	logout.addEventListener('click', event => {
		event.stopPropagation(),
		event.stopImmediatePropagation(),
		toolkit.getAccountManager({ createIfNotExists: true }).showModal()
	}, { passive: true })
});

function createAccountContainer({ asr, name }) {
	let container = toolkit.createElement("div", {
		children: [
			toolkit.createElement("button.new-button.button-type-1", {
				innerText: name,
				style: { width: '-webkit-fill-available' },
				click: event => {
					event.target.closest("#frhd-toolkit\\.account-manager").close();
					toolkit.setCookie('frhd_app_sr', asr, { days: 365 }),
					location.reload()
				}
			}),
			toolkit.createElement("button.new-button.button-type-3", {
				innerText: "X",
				style: {
					aspectRatio: 1,
					marginRight: 0
				},
				click: () => {
					let accounts = toolkit.storage.getEntry('account-manager') || {};
					accounts.length > 0 && (accounts.splice(accounts.indexOf(accounts.find((account) => account.login === login)), 1),
					toolkit.storage.setEntry('account-manager', accounts)),
					container.remove()
				}
			})
		],
		style: {
			display: 'flex',
			gap: '0.25rem'
		}
	});
	return container
}

}