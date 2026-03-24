class FreeRiderToolkit {
	dialogs = new Map();
	nativeEvents = new Map();
	playlists = new Map();
	storage = new Map();
	trackData = null;
	constructor() {
		let searchParams = new URLSearchParams(location.search);
		if (searchParams.has('ajax')) return;
		self.Application && Application.events.subscribe('mainview.loaded', this._childLoad.bind(this)),
		self.ModManager && (ModManager.hook(this, { name: 'toolkit' }),
		ModManager.addEventListener('game:ready', this._load.bind(this)),
		ModManager.addEventListener('game:stateChange', this.refresh.bind(this)));
		self.hasOwnProperty('Application') && (Object.defineProperty(Application.Helpers.AjaxHelper, 'lastRequest', { value: null, writable: true }),
		Application.router && Object.defineProperty(Application.router.current_view, 'ajax', { value: null, writable: true }),
		Application.events.subscribe('ajax.request', e => (Application.Helpers.AjaxHelper.lastRequest = e,
		typeof e.header_title == 'string' && (Application.router.current_view.ajax = e))));
		addEventListener('message', ({ data }) => {
			if (!data || data.sender != 'frhd-toolkit') return;
			switch (data.action) {
			case 'setStorage':
				this.storage = new Map(Object.entries(data.storage)),
				this._childLoad();
				break;
			case 'updateStorage':
				let oldStorage = new Map(this.storage);
				this.storage = new Map(Object.entries(data.storage));
				let changes = new Map();
				for (const [key, value] of this.storage.entries()) {
					if (JSON.stringify(value) == JSON.stringify(oldStorage.get(key))) continue;
					changes.set(key, value);
				}
				this._updateFromSettings(changes)
			}
		}, { passive: true });
		Object.defineProperty(this, 'trackData', { enumerable: false }),
		Object.defineProperty(this, 'dialogs', { enumerable: false }),
		Object.defineProperty(this, 'nativeEvents', { enumerable: false })
	}

	get scene() {
		return GameManager.game && GameManager.game.currentScene
	}

	_appendRecords() {
		let record = []
		  , bikeFrameColor = this.storage.get('bikeFrameColor')
		  , bikeTireColor = this.storage.get('bikeTireColor');
		null !== bikeFrameColor && record.push(['frameColor', bikeFrameColor]);
		null !== bikeTireColor && record.push(['tireColor', bikeTireColor]);
		return record.length > 0 && { 'bike_options': record.map(t => t.join(': ')) } || null
	}

	_childLoad() {
		// if pathname === /create discard all track related variables (this.playerGui)
		this.attachContextMenu(),
		location.pathname.startsWith('/notifications') && this.modifyCommentNotifications();
		(location.pathname.startsWith('/t/') || location.pathname.startsWith('/random/track') || location.pathname.startsWith('/game/')) && GameSettings.track && (this.cacheTrackData(),
		!location.pathname.startsWith('/game/') && (this.initBestDate(),
		this.initDownloadGhosts(),
		this.initGhostMetadata(),
		this.initHighlightComment(),
		this.initReportTracks(),
		location.search.includes('c_id=') && this.initJumpToComment(),
		Application.settings.user.u_id === GameSettings.track.u_id && this.initDownloadTracks()));
		location.pathname.startsWith('/u/') && (Application.router.current_view.username === Application.settings.user.u_name ? this.initUserTrackAnalytics() : this.initFriendsLastPlayed(),
		Application.settings.user.moderator && this.initUserModeration());
		location.pathname.startsWith('/account/settings') && (this.initChangeEmail(),
		this.initRequestTrackData());
		for (const module of this.constructor.modules.values())
			module.call(this)
	}

	_load({ detail: game }) {
		this._updateFromSettings(this.storage)
	}

	_updateFromSettings(changes = this.storage) {
		if (!this.scene) return;
		let childLoad = !1;
		for (const [key, value] of changes.entries()) {
			switch (key) {
			case 'accountManager':
			case 'achievementMonitor':
			case 'featuredGhosts':
			case 'playlists':
				childLoad = true;
				break;
			case 'keymap':
				this.scene.playerManager.firstPlayer._gamepad.setKeyMap(GameManager.scene !== 'Editor' ? GameSettings.playHotkeys : GameSettings.editorHotkeys)
			}
		}

		childLoad && this._childLoad(),
		this.refresh()
	}

	attachContextMenu() {
		if (!this._oncontextmenu) {
			Object.defineProperty(this, '_oncontextmenu', {
				value: async event => {
					let currentUser = event.target.closest('.left-nav-profile-top');
					if (null !== currentUser) {
						event.preventDefault();
						const options = await this.buildUserContextMenu(Application.settings.user);
						options.splice(3, 0, {
							name: 'Logout',
							styles: ['danger'],
							click: () => Application.User.logout()
						});
						if (this.storage.get('accountManager')) {
							const accounts = Object.values(this.constructor.getStorageEntry('account-manager') || {});
							const subOptions = accounts.map(account => ({
								name: account.name,
								styles: account.name.toLowerCase() === Application.settings.user.u_name && ['disabled'],
								click: () => {
									this.constructor.setCookie('frhd_app_sr', account.asr, { days: 365 }),
									location.reload()
								}
							}));
							accounts.length > 0 && subOptions.push({ type: 'hr' }) || subOptions.push({
								name: 'Add Account',
								// click: () => this.constructor.getAccountManager({ createIfNotExists: true, showLogin: true }).showModal('login')
								click: () => Application.Helpers.TemplateHelper.getTemplates(["auth/signup_login"], function(t) {
									Application.router.auth_dialog_view.template = t["auth/signup_login"],
									Application.router.auth_dialog_view.options = Object.assign({}, Application.settings, { login: true }),
									Application.router.auth_dialog_view.setup()
								})
							}),
							subOptions.push({
								name: 'Manage Accounts',
								click: () => this.constructor.getAccountManager({ createIfNotExists: true }).showModal()
							}),
							options.splice(3, 0, this.storage.get('accountManager') && {
								name: 'Switch Accounts',
								options: subOptions
							})
						}
						ContextMenu.create(options, event);
						return;
					}

					// let gameContiner = event.target.closest('#game-container');
					// if (null !== gameContiner) {
					// 	event.preventDefault();
					// 	const options = [{
					// 		name: 'Input Display',
					// 		type: 'checkbox'
					// 	}];
					// 	ContextMenu.create(options, event);
					// 	return;
					// }

					this.trackData === null && this.cacheTrackData();
					// track-list-tile
					let race = event.target.closest('.track-leaderboard-race-row');
					if (null !== race) {
						event.preventDefault();
						if (event.target.closest('.name')) {
							ContextMenu.create(await this.buildUserContextMenu(race.dataset), event);
							return;
						}

						const reports = this.constructor.fetchReports('\'{data-u_id}\' by @{data-d_name}', race.dataset, { type: 'race' });
						const options = [{
							name: 'Race',
							click: () => GameManager.loadRace(GameManager.trackId, race.dataset.u_id)
						}, {
							name: 'Copy Race Data', // 'Request Race Data' if data is not loaded,
							click: () => this.constructor.fetchRace(race.dataset.u_id).then(data => navigator.clipboard.writeText(JSON.stringify(data, '\t', 4)).catch(err => alert(err.message)))
						}, {
							name: race.dataset.legitimacy || 'Test Legitimacy',
							styles: race.dataset.legitimacy && ['disabled'],
							click: () => Application.Helpers.AjaxHelper.post('track_api/load_races', { // grab race data from GameSettings.raceData instead
								t_id: this.trackData.t_id,
								u_ids: race.dataset.u_id
							}).then(({ data, result: r }) => {
								if (!r) return alert('Race not found.');
								let [entry] = this.scene.formatRaces(data);
								let isTas = !this.constructor.verifyRaceData(entry);
								race.dataset.legitimacy = isTas ? 'Illegitimate (TAS)' : 'Legit';
								isTas && this.updateTASLeaderboard([entry])
							})
						}, this.constructor.isUserModerator(Application.settings.user) || (Application.settings.user.u_id == race.dataset.u_id ? {
							name: 'Delete',
							styles: ['danger', race.dataset.requested && 'disabled'],
							click: async () => {
								confirm('Are you sure you want to permanently remove your race?\nThis action is irreversible and prevents you from creating another race on this track.') && await this.constructor.externalApi(`tracks/${this.trackData.id ?? this.trackData.t_id}/races`, 'DELETE')
									.then(r => console.log(r.message))
							}
						} : {
							name: 'Report',
							styles: ['danger', (race.dataset.reported || reports.length > 0) && 'disabled'],
							click: () => this.constructor.report('Race \'{data-u_id}\' by @{data-d_name}', race.dataset, { type: 'race' }).then(() => {
								race.dataset.reported = true
							})
						})];
						if (Application.settings.user.u_id != race.dataset.u_id) {
							const raceData = GameManager.game.currentScene.races.find(({ user: u }) => u.u_id == race.dataset.u_id);
							if (raceData) {
								const cosmetics = await this.constructor.fetchCurrentUserCosmetics();
								const item = raceData.user.cosmetics.head;
								const hasItem = cosmetics.gear.head_gear.length > 0 && cosmetics.gear.head_gear.find(({ id }) => id == item.id);
								options.splice(options.length - 2, 0, {
									name: (hasItem ? 'Equip' : 'Preview') + ' Head',
									styles: GameManager.game.currentScene.playerManager.firstPlayer._user.cosmetics.head.id == item.id && ['disabled'],
									click: () => {
										for (let player of GameManager.game.currentScene.playerManager._players.filter(({ _user: u }) => u.u_id == Application.settings.user.u_id)) {
											player._user.cosmetics.head = item
										}
										return hasItem && Application.Helpers.AjaxHelper.post('store/equip', { item_id: item.id })
									}
								});
							}
						}
						Application.settings.user.u_id == race.dataset.u_id && options.splice(options.length - 1, 0, {
							name: race.title || 'Check Date',
							styles: race.title && ['disabled'],
							click: () => this.constructor.fetchRaceBestDate().then(date => race.setAttribute('title', date))
						}, {
							name: 'Download',
							click: () => this.constructor.downloadRace(this.trackData.t_id, race.dataset.u_id)
						});
						if (Application.settings.user.moderator) {
							let targetUser = await this.constructor.fetchUser(race.dataset.d_name);
							options.splice(options.length - 1, 0, {
								name: 'Feature',
								click: () =>  navigator.clipboard.writeText('"frhd.co/t/' + this.trackData.t_id + '/r/' + race.dataset.d_name.toLowerCase() + '": ""').then(() => {
									window.open('https://github.com/Calculamatrise/frhd-featured-ghosts/edit/master/data.json', 'blank')
								})
							}, {
								name: 'Delete',
								styles: ['danger'],
								click: () => Application.Helpers.AjaxHelper.post('moderator/remove_race', {
									t_id: this.trackData.t_id,
									u_id: race.dataset.u_id
								}).then(r => r.result && (race.remove(),
								Application.router.current_view.refresh_leaderboard())).fail(err => alert('Something went wrong! ' + err.message))
							}, {
								name: 'Delete & Ban', // only show if mod
								styles: ['danger', targetUser.user.banned && 'disabled'],
								click: () => Application.Helpers.AjaxHelper.post('moderator/remove_race', {
									t_id: this.trackData.t_id,
									u_id: race.dataset.u_id
								}).then(r => r.result && (race.remove(),
								Application.router.current_view.refresh_leaderboard(),
								Application.Helpers.AjaxHelper.post('moderator/ban_user', {
									u_id: race.dataset.u_id
								}))).fail(err => alert('Something went wrong! ' + err.message))
							});
						}
						this.storage.get('developerMode') && options.push({ type: 'hr' }, {
							name: 'Copy Racer Id',
							click: () => navigator.clipboard.writeText(race.dataset.u_id)
						});
						ContextMenu.create(options, event);
						return;
					}

					let leaderboard = event.target.closest('.track-leaderboard');
					if (null !== leaderboard) {
						event.preventDefault();
						const options = [{
							name: 'Race All',
							click: () => Application.Helpers.AjaxHelper.post('track_api/load_races', {
								t_id: this.trackData.t_id,
								u_ids: Array.from(leaderboard.querySelectorAll('.track-leaderboard-race-row')).map(row => row.dataset.u_id).join(',')
							}).then(r => r.result && this.scene.addRaces(r.data))
						}, this.constructor.isUserModerator(Application.settings.user) && {
							name: 'Copy Race Data',
							click: () => this.constructor.fetchRaces(Array.from(leaderboard.querySelectorAll('.track-leaderboard-race-row')).map(row => row.dataset.u_id)).then(races => navigator.clipboard.writeText(JSON.stringify(races, '\t', 4)).catch(err => alert(err.message)))
						}, { type: 'hr' }, this.constructor.isUserModerator(Application.settings.user) ? {
							name: 'Delete All',
							styles: ['danger', 'disabled'],
							click: () => confirm('Are you sure you want to delete ALL races on this leaderboard? This cannot be undone.') && Promise.all(Array.from(leaderboard.querySelectorAll('.track-leaderboard-race-row')).map(row => {
								return Application.Helpers.AjaxHelper.post('moderator/remove_race', {
									t_id: this.trackData.t_id,
									u_id: row.dataset.u_id
								})
							}))
						} : {
							name: 'Report',
							styles: ['danger'], // check session storage and disable button
							click: () => this.constructor.report('Leaderboard', {}, { type: 'leaderboard' })
						}];
						ContextMenu.create(options, event);
						return;
					}

					let comment = event.target.closest('.track-comment');
					if (null !== comment) {
						event.preventDefault();
						if (event.target.closest('.track-comment-img, a.bold')) {
							ContextMenu.create(await this.buildUserContextMenu(comment.dataset), event);
							return;
						} else if (event.target.tagName === 'A') {
							let href = event.target.href;
							let user = await this.constructor.fetchUser(href.replace(/.+\//, '')).then(r => r.user);
							ContextMenu.create(await this.buildUserContextMenu(user), event);
							return;
						}

						let confirmFlag = comment.querySelector('.track-comment-confirm-flag > .yes');
						const options = [{
							name: 'Reply',
							click: () => {
								let input = document.querySelector('#track-comment');
								input.focus();
								input.value = '@' + comment.dataset.d_name + ' ';
							}
						}, {
							name: 'Copy Text',
							click: () => navigator.clipboard.writeText(comment.querySelector('.track-comment-msg').innerText)
						}, Application.settings.user.d_name == comment.dataset.d_name ? {
							name: 'Delete',
							styles: ['danger'],
							click: () => Application.router.current_view._delete_comment(this.trackData.t_id, comment.dataset.c_id, r => r.result && comment.remove())
						} : this.constructor.isUserModerator(Application.settings.user) || {
							name: 'Report',
							styles: ['danger', confirmFlag || 'disabled'],
							click: () => confirmFlag.click()
						}];
						Application.settings.user.admin && options.push({ type: 'hr' }, {
							name: 'Set Messaging Ban',
							styles: ['danger'],
							click: () => Application.Helpers.AjaxHelper.post('admin/user_ban_messaging', {
								messaging_ban_uname: comment.dataset.d_name.toLowerCase()
							})
						});
						this.storage.get('developerMode') && options.push({ type: 'hr' }, {
							name: 'Copy Comment Id',
							click: () => navigator.clipboard.writeText(comment.dataset.c_id)
						});
						ContextMenu.create(options, event);
						return;
					}

					let track = event.target.closest('.track-about-panel > .panel-padding');
					if (null !== track) {
						event.preventDefault();
						if (event.target.closest('.track-about-author-img, a.bold')) {
							const options = await this.buildUserContextMenu(this.trackData.author);
							let subscribe = document.querySelector('#subscribe_to_author');
							Application.settings.user.u_id != this.trackData.author_id && options.splice(3, 0, {
								name: subscribe.innerText,
								styles: /^un/i.test(subscribe.innerText) && ['danger'],
								click: () => subscribe.click()
							});
							ContextMenu.create(options, event);
							return;
						}

						let confirmFlag = document.querySelector('.track-flag ~ .track-confirm-flag > .yes');
						const options = [{
							name: 'Copy Title',
							click: () => navigator.clipboard.writeText(track.querySelector('h1.bold').innerText)
						}, {
							name: 'Copy Description',
							click: () => navigator.clipboard.writeText(track.querySelector('.description').innerText)
						}, {
							name: track.dataset.last_played_date || 'Check Last Played',
							styles: track.dataset.last_played_date && ['disabled'],
							click: () => this.constructor.fetchTrackLastPlayedDate().then(date => track.dataset.last_played_date = date)
						} /* , {
							name: 'Add to Playlist',
							options: [{
								name: 'Play Later'
							}, {
								name: 'Create a new Playlist'
							}]
						} */];
						let playlist = this.fetchAndCachePlaylists('playlater');
						let savedToPlaylater = playlist && playlist.has(this.trackData.t_id);
						let showPlaylistButton = savedToPlaylater || this.storage.get('playlists');
						if (showPlaylistButton) {
						// if (this.storage.get('playlists')) {
							// let playlist = this.fetchAndCachePlaylists('playlater');
							// let savedToPlaylater = playlist && playlist.has(this.trackData.t_id);
							// let showPlaylistButton = savedToPlaylater || this.storage.get('playlists');
							showPlaylistButton && options.splice(2, 0, {
								name: (savedToPlaylater ? 'Remove from' : 'Add to') + ' Playlist',
								styles: [savedToPlaylater && 'danger', savedToPlaylater && !this.storage.get('playlists') && 'disabled'],
								click: () => Application.Helpers.AjaxHelper.get('t/' + this.trackData.t_id).then(({ track, user_track_stats }) => {
									const playlist = this.fetchAndCachePlaylists('playlater');
									playlist[savedToPlaylater ? 'delete' : 'set'](this.trackData.t_id, {
										author: track.author,
										averageTime: user_track_stats.avg_time,
										featured: track.featured,
										id: this.trackData.t_id,
										img: track.img,
										slug: track.slug,
										title: track.title
									});
									playlist.size > 0 ? this.constructor.setStorageEntry('playlists.playlater', Array.from(playlist.values())) : this.constructor.removeStorageEntry('playlists.playlater')
								})
							});
						}
						Application.settings.user.u_id == this.trackData.author_id ? (options.push({
							name: 'Download',
							click: () => this.constructor.downloadTrack(this.trackData.t_id)
						}, this.constructor.isUserModerator(Application.settings.user) || {
							name: 'Delete',
							styles: ['danger'],
							click: async () => {
								confirm('Are you sure you want to hide your track?\nThis action can only be reversed by a moderator.') && await this.constructor.externalApi(`tracks/${this.trackData.id ?? this.trackData.t_id}`, 'DELETE')
									.then(r => {
										const hiddenTracks = new Set(this.constructor.getStorageEntry('hiddenTracks') || []);
										hiddenTracks.add(this.trackData.id ?? this.trackData.t_id);
										this.constructor.setStorageEntry('hiddenTracks', Array.from(hiddenTracks));
										console.log(r.message)
									})
							}
						}, { type: 'hr' }, {
							name: 'Download All',
							click: () => this.constructor.downloadAllTracks(Application.settings.user.u_name)
						})) : this.constructor.isUserModerator(Application.settings.user) || options.push({
							name: 'Report',
							styles: ['danger', confirmFlag || 'disabled'],
							click: () => (confirmFlag.click(),
							confirmFlag.parentElement.remove(),
							document.querySelector('.track-flag')?.remove())
						});
						Application.settings.user.moderator && options.push({ type: 'hr' }, {
							name: 'Add to Track of the Day',
							styles: ['disabled']
						}, {
							name: (GameSettings.track.featured ? 'Unf' : 'F') + 'eature',
							styles: GameSettings.track.featured && ['danger'],
							click: () => Application.Helpers.AjaxHelper.post('track_api/feature_track/' + this.trackData.t_id + '/' + (1 - GameSettings.track.featured)).then(r => {
								r.result && (this.trackData.featured = !this.trackData.featured,
								GameSettings.track.featured = this.trackData.featured)
							})
						}, {
							name: (this.trackData.hide ? 'Unh' : 'H') + 'ide', // unhide if hidden
							styles: ['danger'],
							click: () => Application.Helpers.AjaxHelper.get('moderator/hide_track/' + this.trackData.t_id).then(r => {
								r.result && (this.trackData.hide = 1 - this.trackData.hide,
								GameSettings.track.hide = this.trackData.hide)
							})
						});
						Application.settings.user.admin && options.push({ type: 'hr' }, {
							name: 'Remove Track of the Day',
							styles: ['danger'],
							click: () => Application.Helpers.AjaxHelper.post('admin/removeTrackOfTheDay', {
								t_id: this.trackData.t_id
							})
						}, {
							name: (this.trackData.hide ? 'Unh' : 'H') + 'ide', // unhide if hidden
							styles: ['danger'],
							click: () => Application.Helpers.AjaxHelper.post('admin/' + (this.trackData.hide ? 'un' : '') + 'hide_track', { track_id: this.trackData.t_id }).then(r => {
								r.result && (this.trackData.hide = 1 - this.trackData.hide,
								GameSettings.track.hide = this.trackData.hide)
							})
						}, {
							name: 'Set Uploading Ban',
							styles: ['danger'],
							click: () => Application.Helpers.AjaxHelper.post('admin/user_ban_uploading', {
								uploading_ban_uname: this.trackData.author.u_name
							})
						});
						this.storage.get('developerMode') && options.push({ type: 'hr' }, {
							name: 'Copy Track Id',
							click: () => navigator.clipboard.writeText(this.trackData.t_id)
						});
						ContextMenu.create(options, event);
						return;
					}
				},
				writable: true
			});
			this.constructor.styleSheet.set('context-menu', {
				'--background-color': 'hsl(200deg 15% 15%)',
				'--border-color': 'hsl(200deg 25% 25% / 50%)',
				'--color': 'hsl(0 0% 90%)',
				fontSize: 'clamp(9px, .75rem, 13px)'
			})
		}
		document.removeEventListener('contextmenu', this._oncontextmenu),
		document.addEventListener('contextmenu', this._oncontextmenu)
	}

	async buildUserContextMenu(data) {
		data = Object.assign({}, data);
		!data.u_name && data.d_name && (data.u_name = data.d_name.toLowerCase());
		let isCurrentUser = Application.settings.user.u_id == data.u_id || Application.settings.user.u_name == data.u_name;
		const options = [{
			name: 'Profile',
			click: () => Application.router.do_route('u/' + (data.u_name || data.d_name.toLowerCase()))
		}, {
			name: 'Copy Username',
			click: () => navigator.clipboard.writeText(data.d_name)
		}];
		if (!isCurrentUser) {
			let currentUser = await this.constructor.fetchCurrentUser();
			let isFriend = currentUser.friends.friends_data.find(this.constructor.compareUsers.bind(this, data));
			let request = currentUser.friend_requests.request_cnt > 0 && currentUser.friend_requests.request_data.find(this.constructor.compareUsers.bind(this, data));
			const reports = this.constructor.fetchReports('@{data-d_name} ({data-u_id})', data, { type: 'user' });
			const cachedReports = this.constructor.getStorageEntry('reports.users');
			const reported = cachedReports && cachedReports.includes(data.u_id);
			options.splice(2, 0, {
				name: !request || !request.outgoing ? (isFriend ? 'Remove' : 'Add') + ' Friend' : 'Pending',
				styles: [isFriend && 'danger', (!isFriend && currentUser.friends.friend_cnt >= 30 || request && request.outgoing) && 'disabled'],
				click: () => Application.Helpers.AjaxHelper.post('friends/' + (isFriend ? 'remove_friend' : 'send_friend_request'), { u_name: data.d_name }).done(({ result }) => {
					!isFriend && (currentUser.friend_requests.request_data.push(Object.assign({ outgoing: true }, data)),
					currentUser.friend_requests.request_cnt = currentUser.friend_requests.request_data.length,
					this.constructor.setStorageEntry('current_user', currentUser, { temp: true }))
				})
			}, this.constructor.isUserModerator(Application.settings.user) || {
				name: 'Report',
				styles: ['danger', (reported || reports.length > 0) && 'disabled'], // check session storage and disable button
				// if more than one ghost is reported, report the leaderboard instead and disable all ghost reports on track
				click: () => this.constructor.report('User @{data-d_name} ({data-u_id})', data, { type: 'user' }).then(() => {
					this.constructor.updateStorageEntry('reports.users', [data.u_id])
				})
			});
			(request && !request.outgoing) && options.splice(3, 0, {
				name: 'Accept Friend Request',
				styles: !data.u_id && ['disabled'],
				click: () => Application.Helpers.AjaxHelper.post('friends/respond_to_friend_request', {
					u_id: data.u_id,
					action: 'accept'
				})
			}, {
				name: 'Reject Friend Request',
				styles: ['danger', !data.u_id && 'disabled'],
				click: () => Application.Helpers.AjaxHelper.post('friends/respond_to_friend_request', {
					u_id: data.u_id,
					action: 'decline'
				})
			});
		} else {
			options.splice(2, 0, {
				name: 'Edit Profile',
				click: () => Application.router.do_route('account/settings')
			});
		}
		if (Application.settings.user.moderator) {
			let targetUser = await this.constructor.fetchUser(data.d_name || data.u_name || data.u_id);
			options.push({ type: 'hr' }, {
				name: 'Change Email',
				click: () => (email => email && email.includes('@') && Application.Helpers.AjaxHelper.post('moderator/change_email', {
					u_id: data.u_id,
					email
				}))(prompt('Enter the new email address:'))
			}, {
				name: 'Change Username',
				click: () => (username => username && Application.Helpers.AjaxHelper.post('moderator/change_username', {
					u_id: data.u_id,
					username
				}))(prompt('Enter the new username:'))
			}, {
				name: (targetUser.user.classic ? 'Remove' : 'Set') + ' Official Author',
				styles: targetUser.user.classic && ['danger'],
				click: () => Application.Helpers.AjaxHelper.post('moderator/toggle_official_author/' + data.u_id)
			}, {
				name: (targetUser.user.banned ? 'Unb' : 'B') + 'an',
				styles: ['danger'],
				click: () => Application.Helpers.AjaxHelper.post('moderator/ban_user', {
					u_id: data.u_id
				})
			});
		}
		if (Application.settings.user.admin) {
			const username = data.u_name || data.d_name.toLowerCase();
			options.push({ type: 'hr' }, {
				name: 'Change Email',
				click: () => (email => email && Application.Helpers.AjaxHelper.post('admin/change_user_email', {
					username,
					email
				}))(prompt('Enter the new email address:'))
			}, {
				name: 'Change Username',
				click: () => (uname => uname && Application.Helpers.AjaxHelper.post('admin/change_username', {
					change_username_current: username,
					change_username_new: uname
				}))(prompt('Enter the new username:'))
			}, {
				name: 'Toggle Classic User',
				click: () => Application.Helpers.AjaxHelper.post('admin/toggle_classic_user', {
					toggle_classic_uname: username
				})
			}, {
				name: 'Set Admin Ban',
				styles: ['danger'],
				click: () => ((ban_secs, delete_race_stats) => ban_secs !== null && delete_race_stats !== null && Application.Helpers.AjaxHelper.post('admin/user_ban_messaging', {
					ban_secs,
					username,
					delete_race_stats
				}))(prompt('How long should this ban last? (in seconds)'), confirm('Would you like to delete race stats?'))
			}, {
				name: 'Set Messaging Ban',
				styles: ['danger'],
				click: () => Application.Helpers.AjaxHelper.post('admin/user_ban_messaging', {
					messaging_ban_uname: username
				})
			}, {
				name: 'Set Uploading Ban',
				styles: ['danger'],
				click: () => Application.Helpers.AjaxHelper.post('admin/user_ban_uploading', {
					uploading_ban_uname: username
				})
			}, {
				name: 'Deactivate User',
				styles: ['danger'],
				click: () => Application.Helpers.AjaxHelper.post('admin/deactivate_user', { username })
			}, {
				name: 'Delete User Account',
				styles: ['danger'],
				click: () => Application.Helpers.AjaxHelper.post('admin/delete_user_account', { username })
			});
		}
		this.storage.get('developerMode') && options.push({ type: 'hr' }, {
			name: 'Copy User Id',
			click: () => navigator.clipboard.writeText(data.u_id)
		});
		return options
	}

	cacheTrackData() {
		let trackData = document.querySelector('#track-data');
		let combined = Object.assign({}, trackData && trackData.dataset, window.hasOwnProperty('GameSettings') && GameSettings.track);
		this.trackData = Object.keys(combined).length > 0 ? Object.assign(combined, {
			author: {
				d_name: combined.author,
				u_id: parseInt(combined.author_id || combined.u_id),
				u_name: combined.u_url || combined.author?.toLowerCase()
			}
		}) : null
	}

	fetchChallengeLeaderboard({ createIfNotExists } = {}) {
		let leaderboard = document.querySelector('#race_leaderboard');
		if (!leaderboard && createIfNotExists) {
			let container = document.querySelector('#track_best_times');
			if (!container) return;
			let fragmentFromString = str => new DOMParser().parseFromString(str, 'text/html').body.childNodes[0];
			leaderboard = fragmentFromString(Application.Helpers.TemplateHelper.render(Application.router.current_view.templates['track/track_race_leaderboard'], {}, {
				race_leaderboard: [] // GameManager.game.currentScene.races
			}));
			container.prepend(leaderboard);
		}

		let tbody = leaderboard.querySelector('table > tbody');
		if (!tbody && createIfNotExists) {
			let table = leaderboard.querySelector('table');
			tbody = table.appendChild(document.createElement('tbody'));
		}
		leaderboard.style.removeProperty('display');
		return tbody || null
	}

	fetchTASLeaderboard({ createIfNotExists } = {}) {
		let leaderboard = document.querySelector('#frhd-toolkit\\.tas-leaderboard > table > tbody');
		if (!leaderboard && createIfNotExists) {
			let globalLeaderboard = document.querySelector('#track_leaderboard');
			if (!globalLeaderboard) return;
			leaderboard = globalLeaderboard.cloneNode(true);
			leaderboard.setAttribute('id', this.constructor.keyify('tas-leaderboard'));
			let title = leaderboard.querySelector('h3:first-child');
			title.setAttribute('title', 'Tool-assisted speedruns');
			title.innerText = 'TAS BEST TIMES';
			globalLeaderboard.after(leaderboard);
			leaderboard = leaderboard.querySelector('table > tbody');
			leaderboard.replaceChildren();
		}
		return leaderboard || null
	}

	fetchAndCachePlaylists(name) {
		typeof name == 'string' && !this.playlists.has(name) && this.playlists.set(name, new Map());
		for (let key of this.playlists.keys()) {
			if (typeof name == 'string' && key !== name) continue;
			const entries = this.constructor.getStorageEntry('playlists.' + key);
			if (null === entries) continue;
			const playlist = this.playlists.get(key);
			for (const entry of entries) {
				playlist.set(String(parseInt(entry.id)), entry);
			}
		}
		return name ? this.playlists.get(name) || null : this.playlists
	}

	refresh() {
		const keymap = this.storage.get('keymap');
		if (!keymap) return;
		for (const key in keymap)
			this.scene.playerManager.firstPlayer._gamepad.keymap[key.charCodeAt()] = keymap[key]
	}

	updateTASLeaderboard(races) {
		let leaderboard = this.fetchTASLeaderboard({ createIfNotExists: true });
		for (let data of races) {
			let row = leaderboard.appendChild(this.constructor.fetchRaceRow(data, { parent: leaderboard, placement: 1 + races.indexOf(data) }))
			  , num = row.querySelector('.num');
			num.innerText = (1 + races.indexOf(data)) + '.';
			let stats = Object.fromEntries(Object.keys(data.race.code.tas).slice(1).map(value => value.split(/:\s*/).map(value => isFinite(value) ? parseFloat(value) : value.replace(/\s+/g, '_'))))
			  , time = row.querySelector(':nth-child(4)');
			time.innerText = this.constructor.formatRaceTime(stats.run_ticks / GameSettings.drawFPS * 1e3);
			let actionRow = row.querySelector('.track-leaderboard-action');
			actionRow.querySelector('span.core_icons.core_icons-btn_add_race.track-leaderboard-race') || actionRow.appendChild(this.constructor.createElement('span.core_icons.core_icons-btn_add_race.track-leaderboard-race', {
				title: 'Race ' + data.user.d_name,
				click() {
					let row = this.closest('.track-leaderboard-race-row');
					// toolkit.scene.removeRaces([row.dataset.u_id])
				}
			}))
		}
	}

	initBestDate() {
		this.nativeEvents.has('leaderboardEvent') || this.initLeaderboardEvent();
		Application.router.current_view.on('leaderboard.rendered', () => {
			document.querySelectorAll(`.track-leaderboard-race-row[data-u_id="${Application.settings.user.u_id}"]`).forEach(race => {
				race.setAttribute('title', 'Loading...'),
				race.addEventListener('pointerover', () => this.constructor.fetchRaceBestDate().then(date => race.setAttribute('title', date)), { once: true, passive: true })
			})
		})
	}

	initChangeEmail() {
		const emailTitle = document.querySelector('.account-settings-content:has(#email-text) > div:nth-child(2) > div > div.label.show-button-inline');
		if (emailTitle) {
			const displayEmailContainer = document.getElementById('display-email-container');
			const emailText = displayEmailContainer.querySelector('#email-text');
			const emailResponse = this.constructor.createElement('div.response.alert-message.success#email_response', {
				style: {
					display: 'none',
					marginTop: '5px'
				}
			});
			const emailInput = this.constructor.createElement('input', {
				type: 'email',
				value: emailText.innerText,
				style: {
					marginTop: '6px',
					width: '100%'
				},
				oninput: () => {
					const changed = emailText.innerText.trim() !== emailInput.value.trim();
					saveButton.classList.toggle('disabled', !changed)
				}
			});
			const saveButton = this.constructor.createElement('button.profile.new-button.green-button.small-button.show-button-inline.disabled', {
				innerText: 'Save',
				click: e => {
					e.stopPropagation();
					e.stopImmediatePropagation();
					emailForm.style.setProperty('display', 'none');
					editEmail.style.removeProperty('display');
					// displayEmailContainer.style.removeProperty('display');

					const newEmail = emailInput.value.trim();
					if (emailText.innerText.trim() === newEmail) {
						emailResponse.innerText = 'No changes made.';
						emailResponse.style.removeProperty('display');
						displayEmailContainer.style.removeProperty('display');
						return;
					}

					emailResponse.style.setProperty('background-image', 'linear-gradient(hsl(43 81% 65%), hsl(45 57% 49%))');
					emailResponse.innerText = 'Pending password entry...';
					emailResponse.style.removeProperty('display');

					const pwdResponse = this.constructor.createElement('div.response.alert-message.error#email_response', {
						style: {
							display: 'none',
							marginTop: '5px',
							textAlign: 'left'
						}
					});
					const pwdInput = this.constructor.createElement('input', {
						type: 'password',
						style: {
							marginTop: '6px',
							width: '100%'
						}
					});
					const overlay = document.body.appendChild(this.constructor.createElement('dialog.account-settings-page', {
						children: [
							this.constructor.createElement('div.account-settings-panel', {
								children: [
									this.constructor.createElement('div.account-settings-item', {
										children: [
											this.constructor.createElement('div.account-settings-header', {
												children: [
													this.constructor.createElement('div.title', {
														children: [
															this.constructor.createElement('div.span', {
																innerText: 'Confirm & Verify Account Ownership'
															})
														]
													})
												]
											}),
											this.constructor.createElement('div.account-settings-content', {
												children: [
													this.constructor.createElement('div.list-item', {
														children: [
															this.constructor.createElement('div.label', { innerText: 'Old Email' }),
															this.constructor.createElement('div.display-text.text', {
																children: [
																	this.constructor.createElement('p', { innerText: emailText.innerText.trim() })
																]
															})
														]
													}),
													this.constructor.createElement('div.list-item', {
														children: [
															this.constructor.createElement('div.label', { innerText: 'New Email' }),
															this.constructor.createElement('div.display-text.text', {
																children: [
																	this.constructor.createElement('p', { innerText: emailInput.value.trim() })
																]
															})
														]
													}),
													this.constructor.createElement('div.list-item', {
														children: [
															this.constructor.createElement('div.label', { innerText: 'Password' }),
															pwdResponse,
															pwdInput,
															this.constructor.createElement('button.cancel-button.new-button.blue-button.small-button', {
																innerText: 'Cancel',
																click: () => overlay.close('cancel')
															}),
															this.constructor.createElement('button.profile.new-button.green-button.small-button.show-button-inline', {
																innerText: 'Save',
																click: async e => {
																	e.stopPropagation();
																	e.stopImmediatePropagation();
																	pwdResponse.style.setProperty('display', 'none');

																	const r = await this.constructor.externalApi('user/email', {
																		email: newEmail,
																		password: pwdInput.value
																	}, 'PATCH');
																	if (r.status !== 200) {
																		pwdResponse.innerText = r.error.message || 'Incorrect password';
																		pwdResponse.style.removeProperty('display');
																		return;
																	}

																	emailText.innerText = newEmail;
																	emailResponse.innerText = r.message;
																	emailResponse.classList.replace('error', 'success');
																	emailResponse.style.removeProperty('display');
																	overlay.close('success')
																}
															})
														],
														style: { textAlign: 'center' }
													})
												]
											})
										]
									})
								]
							})
						],
						style: {
							background: 'none',
							border: 'none',
							// padding: 0
						},
						click(event) {
							const rect = this.getBoundingClientRect()
								, isInDialog = (rect.top <= event.clientY && event.clientY <= rect.top + rect.height &&
									rect.left <= event.clientX && event.clientX <= rect.left + rect.width);
							!isInDialog && this.close('cancel')
						},
						close() {
							e.stopPropagation();
							e.stopImmediatePropagation();
							this.returnValue !== 'success' && emailResponse.style.setProperty('display', 'none');
							emailForm.style.setProperty('display', 'none');
							editEmail.style.removeProperty('display');
							displayEmailContainer.style.removeProperty('display');
							this.remove()
						}
					}));
					overlay.showModal()
				}
			});
			const emailForm = this.constructor.createElement('div.edit-form-container.email-form', {
				children: [
					emailInput,
					this.constructor.createElement('button.cancel-button.new-button.blue-button.small-button', {
						innerText: 'Cancel',
						click: e => {
							e.stopPropagation();
							e.stopImmediatePropagation();
							emailForm.style.setProperty('display', 'none');
							editEmail.style.removeProperty('display');
							displayEmailContainer.style.removeProperty('display')
						}
					}),
					saveButton
				],
				style: {
					display: 'none',
					textAlign: 'center'
				}
			});
			const editEmail = this.constructor.createElement('button.toggle-edit-button.edit-button.new-button.blue-button.small-button', {
				innerText: 'Edit',
				style: { marginLeft: '21px' }
			});
			editEmail.addEventListener('click', e => {
				e.stopPropagation();
				e.stopImmediatePropagation();
				emailResponse.style.setProperty('display', 'none');
				editEmail.style.setProperty('display', 'none');
				displayEmailContainer.style.setProperty('display', 'none');
				emailForm.style.setProperty('display', 'block')
			}, { passive: true });
			emailTitle.parentElement.append(emailForm);
			emailTitle.after(editEmail, emailResponse);
		} else {
			console.warn("Request track data failed to load! Personal data is not present.")
		}
	}

	initDownloadGhosts() {
		this.nativeEvents.has('leaderboardEvent') || this.initLeaderboardEvent(),
		this.constructor.styleSheet
			.set('.track-page .track-leaderboard .track-leaderboard-action', { textAlign: 'right' })
			.set('.track-page .track-leaderboard .track-leaderboard-action > :is(span.core_icons, div.moderator-remove-race)', { right: '6px' })
			.set('#frhd-toolkit\\.download-race', {
				aspectRatio: 1,
				fontSize: '15px',
				height: '22px',
				lineHeight: '1.5em',
				marginRight: '8px',
				textAlign: 'center'
			}),
		Application.router.current_view.on('leaderboard.rendered', () => {
			for (let actionRow of document.querySelectorAll('.track-leaderboard-race-row[data-u_id="' + Application.settings.user.u_id + '"] > .track-leaderboard-action:not(:has(> #frhd-toolkit\\.download-race))')) {
				// let download = actionRow.querySelector('.track-leaderboard-race');
				// download.removeAttribute('class'),
				// download.setAttribute('id', 'frhd-toolkit.download-race'),
				// download.classList.add('btn', 'new-button', 'button-type-1'),
				// download.innerText = '⭳';
				let download = this.constructor.createElement('span.btn.new-button.button-type-1#frhd-toolkit\\.download-race', {
					innerText: '⭳',
					title: 'Download Race'
				});
				download.addEventListener('click', () => this.constructor.downloadRace(GameSettings.track.id, download.parentElement.parentElement.dataset.u_id), { passive: true });
				actionRow.style.setProperty('width', '20%'),
				actionRow.prepend(download),
				actionRow.textContent.length > 0 && actionRow.replaceChildren(...actionRow.children)
			}
		})
	}

	initDownloadTracks() {
		let subscribeToAuthor = document.querySelector('.subscribe-to-author-button');
		let downloadTrack = document.querySelector('#frhd-toolkit\\.download-track');
		if (!downloadTrack) {
			subscribeToAuthor.addEventListener('click', () => this.constructor.downloadTrack(GameSettings.track.id), { passive: true }),
			subscribeToAuthor.setAttribute('id', 'frhd-toolkit.download-track'),
			subscribeToAuthor.innerText = 'Download'
		}
	}

	async initFriendsLastPlayed() {
		const { friends, is_profile_owner } = Application.router.current_view.ajax && Application.router.current_view.username === Application.router.current_view.ajax.header_title.toLowerCase() ? Application.router.current_view.ajax : await fetch(location.pathname + '?ajax').then(r => r.json());
		is_profile_owner || document.querySelectorAll('.friend-list-item-name').forEach(item => {
			item.after(this.constructor.createElement('div.friend-list-item-date', {
				innerText: "Last Played " + friends.friends_data.find(({ d_name }) => d_name == item.innerText).activity_time_ago
			}))
		})
	}

	initGhostMetadata() {
		this.nativeEvents.has('leaderboardEvent') || this.initLeaderboardEvent();
		const parseTicks = time => {
			if (!time) return 0;
			let parts = time.split(':').map(value => parseFloat(value));
			return Math.round((parts[1] * 1e3 + parts[0] * 6e4) * (GameSettings.drawFPS / 1e3))
		}
		Application.router.current_view.on('leaderboard.rendered', ({ track_leaderboard: trackLeaderboard }) => {
			trackLeaderboard = trackLeaderboard.filter(({ user_no_race_data }) => !user_no_race_data);
			const averageTicks = trackLeaderboard.reduce((total, { run_time }) => total += parseTicks(run_time), 0) / trackLeaderboard.length;
			for (let player of trackLeaderboard.filter(({ run_time: runTime, u_id: userId }, index) => {
				if (!runTime) return true;
				const filteredAverageTicks = trackLeaderboard.filter(({ u_id }) => u_id !== userId).reduce((total, { run_time }) => total += parseTicks(run_time), 0) / trackLeaderboard.length;
				const max = parseTicks(trackLeaderboard.at(-1).run_time);
				const calculatedMargin = max - parseTicks(trackLeaderboard[Math.min(trackLeaderboard.length - 1, index + 1)].run_time);
				this.constructor.debug && console.debug(averageTicks, parseTicks(runTime), 'diff', averageTicks - parseTicks(runTime), 'max diff', max - averageTicks, max - filteredAverageTicks, filteredAverageTicks, calculatedMargin, 'max', max, 'max divided by 100', max / 100, calculatedMargin / max, calculatedMargin * (max / 100), max / calculatedMargin)
				if (averageTicks - parseTicks(runTime) > max - filteredAverageTicks) return true;
				return false
			})) {
				for (let flag of document.querySelectorAll('.track-leaderboard-race-row[data-u_id="' + player.u_id + '"] > .num:not(:has(> #frhd-toolkit\\.flagged))')) {
					flag.setAttribute('id', 'frhd-toolkit.flagged');
					flag.setAttribute('title', 'This race has been flagged by frhd-toolkit under suspicion of misconduct.');
					flag.innerText = '⚠️';
				}
			}
		})
	}

	initHighlightComment() {
		this.constructor.styleSheet.set('.track-comment:has(.track-comment-msg > a[href="' + location.origin + '/u/' + Application.settings.user.u_name + '"])', { backgroundColor: 'hsl(55 70% 85% / 1) !important' })
	}

	initJumpToComment() {
		let searchParams = new URLSearchParams(location.search);
		let commentId = searchParams.get('c_id');
		if (!commentId || this.lastLoadedComment == commentId /* || document.querySelector('.track-comment[data-c_id="' + commentId + '"]') */) return;
		Object.defineProperty(this, 'lastLoadedComment', { value: commentId, writable: true });
		if (typeof Application.router.current_view.load_comments_until != 'function') {
			const prototype = Object.getPrototypeOf(Application.router.current_view);
			prototype.load_comments_until = function(cid, callback) {
				let c = document.querySelector('.track-comment[data-c_id="' + commentId + '"]');
				if (c) return callback(c);
				let o = document.querySelector(".track-comments-list div.track-comment:last-child").dataset.c_id
				  , r = this._get_track_id()
				  , i = document.querySelector('.track-prev-comments');
				i.style.setProperty('display', 'none');
				let s = document.querySelector('.track-comments-loading');
				s.style.setProperty('display', 'block');
				this._get_comment_template(() => {
					Application.Helpers.AjaxHelper.post("track_comments/load_more/" + r + "/" + o).then(e => {
						if (e.result === !0 && e.data.track_comments.length > 0) {
							var a = Application.Helpers.TemplateHelper.render(this.templates["track/track_comment"], {}, e.data)
							  , o = this.$el.find(".track-comments-list")
							  , n = e.data.track_comments.findIndex(({ comment }) => comment.id == cid) > 0;
							o.append(a),
							e.data.track_comments_load_more === !0 && (n ? i.style.removeProperty('display') : this.load_comments_until(...arguments)),
							n && typeof callback == 'function' && callback(document.querySelector('.track-comment[data-c_id="' + cid + '"]'))
						}
						s.style.setProperty('display', 'none'),
						Application.events.publish('resize')
					})
				})
			}
			Object.setPrototypeOf(Application.router.current_view, prototype);
		}
		Application.router.current_view.load_comments_until(commentId, comment => {
			comment.scrollIntoView({ behavior: 'smooth' });
			window.addEventListener('scrollend', () => {
				comment.classList.add('animated', 'flash');
				setTimeout(() => {
					comment.classList.remove('animated', 'flash');
				}, 2e3)
			}, { once: true, passive: true })
		})
	}

	initLeaderboardEvent() {
		const renderLeaderboards = Application.Views.TrackView.prototype._render_leaderboards;
		this.nativeEvents.set('leaderboardEvent', renderLeaderboards);
		Application.Views.TrackView.prototype._render_leaderboards = function(e) {
			renderLeaderboards.apply(this, arguments);
			e.result && (this.trigger('leaderboard.rendered', ...arguments),
			Application.events.publish('leaderboard.rendered', ...arguments))
		}
	}

	initNotificationEvent() {
		const prototype = Object.getPrototypeOf(Application.Helpers.AjaxHelper);
		const checkNotificationEvent = prototype._check_event_notification;
		this.nativeEvents.set('notificationEvent', checkNotificationEvent);
		prototype._check_event_notification = function(e) {
			checkNotificationEvent.apply(this, arguments);
			e.result && Application.events.publish('notification.received', ...arguments);
		}
		Object.setPrototypeOf(Application.Helpers.AjaxHelper, prototype)
	}

	initReportTracks() {
		let confirm = document.querySelector('.track-flag ~ .track-confirm-flag > .yes');
		if (!confirm || confirm.classList.contains('frhd-toolkit.track-report')) return;
		confirm.classList.add('frhd-toolkit.track-report');
		confirm.addEventListener('click', () => {
			this.constructor.report('This track', {}, { type: 'track' }).then(r => alert(r.result ? "You have successfully reported this track." : r.msg))
		}, { passive: true })
	}

	initRequestTrackData() {
		const parentElement = document.querySelector('#delete-all-personal-data')?.parentElement || document.querySelector('.account-settings-header');
		if (parentElement) {
			let requestTrackData = parentElement.appendChild(this.constructor.createElement('button.blue-button.settings-header.new-button', {
				innerText: 'Request All Data',
				style: {
					float: 'right',
					fontSize: '13px',
					height: 'auto',
					lineHeight: '23px',
					marginTop: '6px',
					marginRight: '14px',
					padding: '0 1rem'
				}
			}));
			requestTrackData.addEventListener('click', () => this.constructor.downloadAllTracks(Application.settings.user.u_name), { passive: true });
		} else {
			console.warn("Request track data failed to load! Personal data is not present.")
		}
	}

	initUserModeration() {
		let profileUserData = document.querySelector('#profile-user-data');
		if (!profileUserData) return;
		let onclick = event => {
			self = event.target;
			let input = self.previousElementSibling;
			if (self.innerText.toLowerCase() == 'save') {
				self.dispatchEvent(new CustomEvent('save', {
					detail: input.value
				}));
				input.setAttribute('readonly', '');
				self.classList.add('button-type-1');
				self.classList.remove('button-type-2');
				self.innerText = 'Edit';
			} else {
				input.removeAttribute('readonly');
				self.classList.add('button-type-2');
				self.classList.remove('button-type-1');
				self.innerText = 'Save';
			}
		}

		let data = profileUserData.dataset;
		data.u_name = document.querySelector('.profile-username').innerText;
		let pm = document.querySelector('.pm > .pm-user-properties');
		let email = pm.appendChild(pm.querySelector('.pm-user-property.pm-user-id').cloneNode(true));
		email.classList.remove('pm-user-id');
		let property = email.querySelector('.pm-property');
		property.innerText = "Email: ";
		let input = this.constructor.createElement('input', {
			placeholder: 'New email',
			readonly: '',
			type: 'text' // email
		});
		property.nextElementSibling.replaceWith(input);
		let edit = email.querySelector('#pm-ban-user');
		edit.classList.remove('ban-user-button');
		edit.innerText = "Edit";
		edit.removeAttribute('id');
		edit.addEventListener('click', onclick, { passive: true });
		edit.addEventListener('save', event => {
			return Application.Helpers.AjaxHelper.post("moderator/change_email", {
				u_id: data.u_id,
				email: event.detail
			}).then(r => (alert(r.msg), r));
		});
		email.querySelector('#pm-unban-user').remove();
		let username = pm.appendChild(email.cloneNode(true));
		property = username.querySelector('.pm-property');
		property.innerText = "Username: ";
		input = username.querySelector('input');
		input.setAttribute('placeholder', "New username");
		input.setAttribute('type', 'text');
		input.setAttribute('value', data.u_name);
		edit = username.querySelector('a');
		edit.addEventListener('click', onclick, { passive: true });
		edit.addEventListener('save', event => {
			return Application.Helpers.AjaxHelper.post("moderator/change_username", {
				u_id: data.u_id,
				username: event.detail
			}).then(r => (alert(r.msg), r))
		});
		let password = pm.appendChild(email.cloneNode());
		property = password.appendChild(property.cloneNode());
		property.innerText = "Password: ";
		edit = password.appendChild(this.constructor.createElement('button.new-button.ban-user-button', {
			innerText: 'Reset Password'
		}));
		edit.addEventListener('click', () => {
			return Application.Helpers.AjaxHelper.post("auth/forgot_password", {
				email: data.u_name
			}).then(r => (alert(r.msg), r));
		}, { passive: true })
	}

	initUserTrackAnalytics() {
		document.querySelectorAll("#created_tracks .bottom").forEach(metadata => {
			metadata.innerHTML = metadata.innerHTML.replace(/<!--|-->/g, '')
		})
	}

	async modifyCommentNotifications() {
		Application.Helpers.TemplateHelper.getTemplates(['notifications/t_uname_mention'], templates => {
			for (const key in templates)
				Application.Helpers.TemplateHelper.cached_templates[key] = templates[key].replace(/(?<={{track.url}})/, '?c_id={{comment.id}}')
		});
		const { notification_days: d } = Application.router.current_view.ajax && /^notifications$/i.test(Application.router.current_view.ajax.header_title) ? Application.router.current_view.ajax : await Application.Helpers.AjaxHelper.get('notifications')
			, notifications = d && d.length > 0 && d.flatMap(({ notifications: n }) => n)
			, commentNotifications = notifications.filter(({ t_uname_mention: t }) => t);
		for (const { comment, track, ts } of commentNotifications) {
			const notification = document.querySelector('.notification[data-ts="' + ts + '"] p > a[href$="' + track.url + '"]')
			notification && (notification.href += '?c_id=' + comment.id)
		}
	}

	refreshAchievements() {
		return this.constructor.fetchAchievements(...arguments).then(async res => {
			const children = await Promise.all(res.achievements.filter(a => !a.complete).sort((a, b) => b.tot_num - a.tot_num).slice(0, 3).map(this.constructor.createProgressElement.bind(this.constructor)));
			this.achievementMonitor.container.replaceChildren(...children);
			return res
		})
	}

	static externalApi(endpoint, payload, method) {
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
	}

	static fetchRequestData({ attributeFilter, timeout = 10, typedFilter } = {}) {
		return new Promise((resolve, reject) => {
			var event = 'ajax.request';
			var listener = data => {
				data = typeof data == 'object' && typeof data.data == 'object' ? data.data : data;
				if (typeof attributeFilter == 'object' && attributeFilter instanceof Array) {
					const attributes = Object.keys(data);
					if (attributeFilter.find(attribute => !attributes.includes(attribute))) return;
				} else if (typeof typedFilter == 'object') {
					for (let attribute of typedFilter) {
						if (typeof data[attribute] !== typedFilter[attribute]) return;
					}
				}
				Application.events.unsubscribe(event, listener),
				Application.events.unsubscribe(timeoutEvent, listener),
				resolve(data)
			};
			Application.events.subscribe(event, listener);
			var timeoutEvent = 'mainview.loaded';
			var timeoutListener = () => {
				Application.events.unsubscribe(event, listener),
				Application.events.unsubscribe(timeoutEvent, listener),
				reject('Request timed out.')
			};
			Application.events.subscribe(timeoutEvent, timeoutListener),
			typeof timeout == 'number' && setTimeout(timeoutListener, timeout * 1e3)
		})
	}

	static #styleSheet = document.head.appendChild(this.createElement('style', { id: 'frhd-toolkit.style' }));
	static ajaxResponse = null;
	static debug = false;
	static modules = new Map();
	static styleSheet = GameStyleManager.createProxyStyle(this.#styleSheet);
	static compareUsers(a, b) {
		return a.u_id == b.u_id || a.u_name == b.u_name || a.d_name == b.d_name
	}

	static createAccountContainer({ asr, name }) {
		let container = this.createElement("div", {
			children: [
				this.createElement("button.new-button.button-type-1", {
					innerText: name,
					style: { width: '-webkit-fill-available' },
					click: event => {
						event.target.closest("#frhd-toolkit\\.account-manager").close();
						this.setCookie('frhd_app_sr', asr, { days: 365 }),
						location.reload()
					}
				}),
				this.createElement("button.new-button.button-type-3", {
					innerText: "X",
					style: {
						aspectRatio: 1,
						marginRight: 0
					},
					click: () => {
						let accounts = this.getStorageEntry('account-manager') || {};
						accounts.length > 0 && (accounts.splice(accounts.indexOf(accounts.find((account) => account.login === login)), 1),
						this.setStorageEntry('account-manager', accounts)),
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

	static getAccountManager({ createIfNotExists, showLogin } = {}) {
		(this.accountManager || createIfNotExists) && (Object.defineProperty(this, 'accountManager', {
			value: document.body.appendChild(this.createElement("dialog#frhd-toolkit\\.account-manager", {
				children: [
					this.createElement("span.core_icons.core_icons-icon_close.signup-login-modal-close", {
						style: {
							position: 'absolute',
							right: '.5em',
							top: '.5em'
						},
						click: () => this.accountManager.close()
					}),
					this.createElement("div.accounts-container", {
						children: Object.values(this.getStorageEntry('account-manager') ?? {}).map(account => this.createAccountContainer(account)),
						style: {
							display: 'flex',
							flexDirection: 'column',
							gap: '0.4rem'
						}
					}),
					this.createElement("button.new-button.button-type-2", {
						id: 'add-account',
						innerText: "Add account",
						click: () => this.accountManager.close('add-account')
					}),
					this.createElement("button.new-button.button-type-3", {
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
	}

	static async createProgressElement(achievement) {
		let container = this.createElement('div.achievement-info', {
			children: [
				this.createElement('div', {
					children: [
						this.createElement('span.achievements-coin.store_icons.store_icons-coin_icon_lg.achievement-coin-value', {
							innerText: achievement.coins,
							style: {
								color: 'white',
								lineHeight: '45px',
								textAlign: 'center',
								textShadow: '0 -1px 1px #9E8500'
							}
						}),
						this.createElement('div.achievement-info', {
							children: [
								this.createElement('a.title', {
									children: [
										this.createElement('b', {
											innerText: achievement.title
										})
									],
									href: await (description => {
										switch (description) {
										case 'Buy 1 item from the shop':
											return 'store/gear';
										case 'Complete 1 friend race':
										case 'Win 5 friend(s) race':
											return this.fetchCurrentUser().then(async ({ friends }) => {
												if (friends.friend_cnt > 0) {
													let track;
													for (let friend of friends.friends_data) {
														if (track = await fetch('/u/' + friend.u_name).then(r => r.json()).then(({ recently_ghosted_tracks: { tracks }}) => {
															return tracks[Math.floor(Math.random() * tracks.length)];
														})) {
															return track;
														}
													}
												}
												return 'random/track'
											});
										case 'Improve 5 best times':
										case 'Send 5 friend race challenges':
											return this.fetchCurrentUser().then(({ recently_ghosted_tracks: { tracks }}) => {
												let track = tracks[Math.floor(Math.random() * tracks.length)];
												return track ? track.slug : 'random/track';
											});
										default:
											return 'random/track'
										}
									})(achievement.desc),
									style: { width: '-webkit-fill-available' }
								}),
								this.createElement('h6.achievement-info-desc.condensed', {
									innerText: achievement.desc,
									style: {
										color: 'hsl(190deg 25% 60%)',
										fontFamily: 'roboto_bold',
										margin: 0
									}
								})
							]
						})
					],
					style: {
						alignItems: 'center',
						display: 'flex',
						gap: '0.5rem'
					}
				}),
				// achievement.coins
				this.createElement('span', {
					innerText: achievement.progress, // achievement.current, // achievement.progress // achievement.current + '/' + achievement.max
					style: { fontSize: '1.25rem' }
				})
			],
			style: {
				alignItems: 'center',
				display: 'flex',
				justifyContent: 'space-between'
			}
		});
		return container;
	}

	static createElement(type, options = {}) {
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
	}

	static async downloadFile(name, contents, { desc } = {}) {
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
	}

	static async downloadRace(tid, uid) {
		return Application.Helpers.AjaxHelper.post("track_api/load_races", {
			t_id: tid,
			u_ids: uid
		}).done(({ data: [entry], result: r }) => {
			if (!r) throw new Error();
			r && this.downloadFile('frhd_ghost_' + tid + '-' + uid, Object.assign(entry.race, {
				code: this.encodeReplayString(JSON.parse(entry.race.code)),
				metadata: {
					t_id: tid,
					u_id: entry.user.u_id
				}
			}), { desc: 'Race' })
		})
	}

	static async downloadTrack(id) {
		return fetch('/track_api/load_track?id=' + id + '&fields[]=code&fields[]=id&fields[]=title').then(r => r.json()).then(({ data: { track } = {}, result }) => {
			if (!result) return;
			this.downloadFile(track.title + '-' + track.id, track.code, { desc: 'Track' })
		})
	}

	static async downloadAllTracks(username) {
		return fetch('/u/' + username + '/created?ajax').then(r => r.json()).then(async ({ created_tracks }) => {
			const zip = new Zip()
				, tracks = await Promise.all(created_tracks.tracks.map(track => fetch('/track_api/load_track?id=' + track.id + '&fields[]=code&fields[]=id&fields[]=title').then(r => r.json())))
				.then(tracks => tracks.filter(({ result }) => result).map(({ data }) => data.track));
			for (let track of tracks)
				zip.newFile(track.title + '-' + track.id + '.txt', track.code);
			this.downloadFile('created-tracks', await zip.blob(), { desc: 'Created' })
		})
	}

	static encodeReplayString(t, e = {}) {
		let i = {
			version: e.replayVersion ?? 1
		};
		for (let s in t) {
			let n = t[s];
			i[s] = "";
			for (let r in n) {
				let o = n[r];
				i[s] += o.toString(32) + " "
			}
			i[s] = i[s].slice(0, -1)
		}
		return btoa(JSON.stringify(i))
	}

	static async openRace({ desc, multiple } = {}) {
		let races = [];
		if ('showOpenFilePicker' in window) {
			let results = await showOpenFilePicker({
				excludeAcceptAllOption: true,
				multiple: true,
				types: [{
					accept: { 'application/json': ['.json'] },
					description: 'Free Rider HD ' + (desc || 'File')
				}]
			});
			for (let fileHandle of results) {
				let file = await fileHandle.getFile();
				races.push(JSON.parse(await file.text()))
			}
		} else {
			let results = await new Promise((resolve, reject) => {
				let filePicker = this.createElement('input', {
					accept: 'application/json',
					multiple: true,
					type: 'file'
				});
				filePicker.addEventListener('cancel', () => resolve([]), { once: true, passive: true });
				filePicker.addEventListener('change', event => {
					resolve(event.target.files)
				}, { once: true, passive: true }),
				filePicker.click();
			});
			for (let file of results) {
				races.push(JSON.parse(await file.text()))
			}
		}

		for (let i in races) {
			let metadata = races[i].metadata;
			delete races[i].metadata;
			races[i].code = JSON.stringify(GameManager.game.currentScene.playerManager.firstPlayer._gamepad.constructor.decodeReplayString(races[i].code));
			let user, userPage = window.hasOwnProperty('toolkit') && toolkit.storage.get('importRaceMetadata') && await this.fetchUserById(metadata.u_id);
			if (userPage.user && 1 >= Object.keys(userPage.user.cosmetics.head).length) {
				let recentGhosts = userPage.recently_ghosted_tracks.tracks;
				recentGhosts && recentGhosts.length > 0 && (user = await Application.Helpers.AjaxHelper.get('t/' + recentGhosts[0].slug).then(({ game_settings: { raceData }}) => raceData[0].user))
			}
			user ||= {
				cosmetics: { head: { type: '1' }},
				d_name: 'Guest',
				guest: true,
				img_url_small: 'https://cdn.freeriderhd.com/free_rider_hd/sprites/guest_profile_v2.png',
				u_id: metadata.u_id
			}
			races[i] = {
				race: races[i],
				user
			}
		}

		GameManager.game.currentScene.addRaces(races)
	}

	static async fetchUserById(uid) {
		// check current user, then friend list, then remove friend
		let currentUser = await this.fetchCurrentUser();
		if (currentUser) {
			if (currentUser.user.u_id === uid) return currentUser;
			let friend = currentUser.friends.friends_data.find(friend => friend.u_id === uid);
			if (friend) return this.fetchUser(friend.u_name)
		}
		return this.fetchUser(await Application.Helpers.AjaxHelper.post('friends/remove_friend', { u_id: uid }).then(r => r.result || /\w+(?=,)/.exec(r.msg).toString()))
	}

	static async fetchAchievements({ force } = {}) {
		const KEY = this.keyify('achievements');
		let cache = sessionStorage.getItem(KEY);
		if (cache && !force) {
			return JSON.parse(cache);
		}

		let data = await fetch('/achievements?ajax').then(r => r.json());
		sessionStorage.setItem(KEY, JSON.stringify(data));
		return data
	}

	static async updateAchievements(data, { force } = {}) {
		const KEY = this.keyify('achievements');
		const entry = await this.fetchAchievements({ force });
		sessionStorage.setItem(KEY, JSON.stringify(Object.assign(entry, data)));
		return entry
	}

	static async fetchCurrentUser({ force } = {}) {
		const KEY = this.keyify('current_user');
		let cache = sessionStorage.getItem(KEY);
		if (cache && !force) {
			return JSON.parse(cache);
		}

		const { ajax } = Application.router.current_view;
		const entry = ajax && ajax.header_title && ((ajax.user && Application.settings.user.u_id === ajax.user.u_id) || Application.settings.user.u_name === ajax.header_title.toLowerCase()) ? ajax : await fetch('/u/' + Application.settings.user.u_name + '?ajax').then(r => r.json());
		sessionStorage.setItem(KEY, JSON.stringify(entry));
		return entry || null
	}

	static async fetchCurrentUserCosmetics({ force } = {}) {
		const KEY = this.keyify('current_user.cosmetics');
		let cache = sessionStorage.getItem(KEY);
		if (cache && !force) {
			return JSON.parse(cache);
		}

		let data = await fetch('/store/gear?ajax').then(r => r.json());
		sessionStorage.setItem(KEY, JSON.stringify(data));
		return data
	}

	static users = [];
	static async fetchUser(uid, { cache, force } = {}) {
		uid = String(uid).toLowerCase();
		if (uid == Application.settings.user.u_id || uid == Application.settings.user.u_name) return this.fetchCurrentUser();
		let entry = this.users.find(({ user: { u_id, u_name }}) => u_id == uid || u_name === uid.toLowerCase());
		if (entry && !force) {
			return entry;
		}
		const { ajax } = Application.router.current_view;
		entry = ajax && ajax.header_title && ((ajax.user && uid === ajax.user.u_id) || uid === ajax.header_title.toLowerCase()) ? ajax : await fetch('/u/' + uid + '?ajax').then(r => r.json());
		// let entry = await fetch('/u/' + uid + '?ajax').then(r => r.json());
		!1 !== cache && this.users.push(entry);
		return entry || null
	}

	static fetchComment(trackId, commentId) {
		return Application.Helpers.AjaxHelper.post('track_comments/load_more/' + trackId + '/' + (commentId + 1)).then(r => r.result && r.data.track_comments[0]);
	}

	static isFeaturedRace(user) {
		// GameSettings.track.id
		let data = this.getStorageEntry('featured_ghosts', null, { temp: true });
		if (!data) return !1;
		return Object.entries(data).filter(([, entries]) => Object.keys(entries).find(t => t.includes(GameSettings.track.id))).map(([u]) => u.toLowerCase()).includes(user.u_name)
	}

	static integrateBadges(user) {
		Object.defineProperty(user, 'badges', {
			value: new Set(),
			writable: true
		}),
		/^5815066$/.test(user.u_id) && user.badges.add('🛠️');
		(user.admin || user.moderator || /^(?:10(?:18|82)|5(?:0(?:00(?:1|3)|1(?:15|7935))|815066))$/.test(user.u_id)) && user.badges.add('🛡️');
		this.isFeaturedRace(user) && user.badges.add('⭐');
		Object.defineProperty(user, 'r_name', {
			value: (user.badges.size > 0 ? Array.from(user.badges).join('').concat(' ') : '') + user.d_name,
			writable: true
		}),
		Object.defineProperty(user, 'gradient', { value: [], writable: true });
		if (user.badges.has('🛡️')) {
			user.gradient.push('#e95f4d');
			return '#d34836';
		} else if (user.badges.has('⭐')) {
			user.gradient.push('#fac51f');
			return '#e8a923'
		}
	}

	static async fetchRaceBestDate({ force } = {}) {
		const KEY = this.keyify('race_best_dates');
		let cache = JSON.parse(sessionStorage.getItem(KEY)) || {}
		  , t = GameSettings.track.id;
		if (!force && cache[t]) {
			return cache[t]
		}
		const { ajax } = Application.router.current_view;
		const { user_track_stats: { best_date: date } = {}} = ajax && ajax.track && ajax.track.id === t ? ajax : await fetch(location.pathname + '?ajax').then(r => r.json());
		sessionStorage.setItem(KEY, JSON.stringify(Object.assign(cache, { [t]: date })));
		return date
	}

	static async fetchTrackLastPlayedDate({ force } = {}) {
		const KEY = this.keyify('track_last_played_dates');
		let cache = JSON.parse(sessionStorage.getItem(KEY)) || {}
		  , t = GameSettings.track.id;
		if (!force && cache[t]) {
			return cache[t]
		}
		const { ajax } = Application.router.current_view;
		const { user_track_stats: { last_played_date: date } = {}} = ajax && ajax.track && ajax.track.id === t ? ajax : await fetch(location.pathname + '?ajax').then(r => r.json());
		sessionStorage.setItem(KEY, JSON.stringify(Object.assign(cache, { [t]: date })));
		return date
	}

	static async fetchRace(uid, { trackId = GameManager.trackId } = {}) {
		if (typeof uids == 'object') return this.fetchRaces(...arguments);
		let data = GameManager.trackId === trackId && GameSettings.raceData && GameSettings.raceData.find(data => data.user.u_id == userId);
		if (!data) {
			data = await Application.Helpers.AjaxHelper.post('track_api/load_races', {
				t_id: trackId,
				u_ids: uid
			}).then(r => {
				if (!r.result) throw new Error(r.msg || 'Something went wrong! Failed to fetch race.');
				return r.data
			});
		}
		return data && data[0] || null
	}

	static async fetchRaces(uids, { trackId = GameManager.trackId } = {}) {
		if (typeof uids != 'object') return this.fetchRace(...arguments);
		let races = GameManager.trackId === trackId && GameSettings.raceData && GameSettings.raceData.filter(data => uids.includes(data.user.u_id)) || [];
		if (!races || races.length !== uids.length) {
			await Application.Helpers.AjaxHelper.post('track_api/load_races', {
				t_id: trackId,
				u_ids: uids.filter(uid => -1 === races.findIndex(data => data.user.u_id == uid)).toString()
			}).then(r => {
				if (!r.result) throw new Error(r.msg || 'Something went wrong! Failed to fetch race.');
				races.push(...r.data)
			});
		}
		return races
	}

	static fetchRaceRow(data, { parent, placement }) {
		const racerProfile = 'https://' + location.host + '/u/' + data.user.d_name.toLowerCase();
		const racerAvatar = racerProfile + '/pic?sz=50';
		let row = parent.querySelector('tr.track-leaderboard-race-' + data.user.u_id);
		if (row === null) {
			row = this.createElement('tr', {
				className: 'track-leaderboard-race-' + data.user.u_id + ' track-leaderboard-race-row',
				dataset: {
					u_id: data.user.u_id,
					d_name: data.user.d_name,
					run_time: data.runTime,
					// type: 'tas'
				},
				children: [
					this.createElement('td.num', { innerText: placement + '.' }),
					this.createElement('td.name', {
						children: [
							this.createElement('a.profile-icon', {
								href: racerProfile,
								title: 'View Profile',
								children: [
									this.createElement('div.circular', {
										style: {
											background: 'url(' + racerAvatar + ') no-repeat center center',
											backgroundSize: '100%'
										},
										children: [
											this.createElement('img', {
												src: racerAvatar,
												width: 35,
												height: 35,
												alt: data.user.d_name
											})
										]
									})
								]
							}),
							this.createElement('span.track-leaderboard-race', {
								innerText: data.user.d_name,
								title: 'Race ' + data.user.d_name
							})
						]
					}),
					document.createElement('td'),
					this.createElement('td', {
						innerText: data.runTime,
						style: { textAlign: 'left' }
					}),
					this.createElement('td.track-leaderboard-action', {
						style: { width: '20%' }
					})
				]
			})
		}
		row.dataset.d_name = data.user.d_name,
		data.runTime && (row.dataset.run_time = data.runTime);
		let time = row.querySelector('td:nth-child(4)');
		time !== null && data.runTime && (time.innerText = data.runTime);
		return row
	}

	static formatRaceTime(t) {
		t = parseInt(t, 10);
		let e = t % 6e4 / 1e3;
		return Math.floor(t / 6e4) + ":" + e.toFixed(2).padStart(5, 0)
	}

	static isUserModerator(data) {
		data.hasOwnProperty('user') && (data = data.user);
		return data.moderator || data.admin
	}

	static _attachShortcuts(key, target) {
		return Object.defineProperties(target, {
			delete: {
				value: () => localStorage.removeItem(this.keyify(key)),
				writable: true
			},
			set: {
				value: value => this.setStorageEntry(key, value),
				writable: true
			},
			update: {
				value: value => this.setStorageEntry(key, value),
				writable: true
			}
		})
	}

	static deleteStorageEntry(key, { temp } = {}) {
		return globalThis[(temp ? 'session' : 'local') + 'Storage'].removeItem(this.keyify(key))
	}

	static getStorageEntry(key, value, { temp } = {}) {
		let entry = globalThis[(temp ? 'session' : 'local') + 'Storage'].getItem(this.keyify(key));
		if (!entry && value) {
			return this.setStorageEntry(key, value)
		}
		return entry !== null && /^[\[{]]|[}\]]$/g.test(entry) ? this._attachShortcuts(this.keyify(key), JSON.parse(entry)) : entry
	}

	static setStorageEntry(key, value, { temp } = {}) {
		return globalThis[(temp ? 'session' : 'local') + 'Storage'].setItem(this.keyify(key), typeof value == 'object' ? JSON.stringify(value) : value),
		typeof value == 'object' ? this._attachShortcuts(this.keyify(key), structuredClone(value)) : value
	}

	static updateStorageEntry(key, value, { temp } = {}) {
		let entry = this.getStorageEntry(key) || new value.constructor;
		entry instanceof Array && typeof value[Symbol.iterator] == 'function' ? entry.push(...value) : Object.assign(entry, value); // recurse?
		return this.setStorageEntry(key, entry)
	}

	static keyify(key) {
		return key.replace(/^(?:frhd-toolkit\.)?(.+)/i, 'frhd-toolkit.$1')
	}

	static report(message, data = {}, { type } = {}) {
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
	}

	static reportRegex(message, data, { type } = {}) {
		const hrefify = a => "<a\\shref=\"" + location.origin + "\\/u\\/" + a.toLowerCase() + "\">" + a + "<\/a>";
		message = message.replace(/{data-(\w+)}/g, (_, key) => data[key]).replace(/([\(\)])/g, '\\$1').replace(/@([\w\._-]+)/, (_, t) => hrefify(t));
		return new RegExp((message ? "^" + type.replace(/^\w/, c => c.toUpperCase()) + "\\s" + message : '') + " was reported with frhd-toolkit. \\(" + hrefify('Calculus') + "\\/" + hrefify('Eric') + "\\/" + hrefify('Totoca12') + "\\)$", 'i')
	}

	static fetchReports(...args) {
		args.length < 1 && (args.splice(0, 1, '.+'),
		args.splice(1, 1, { d_name: '\\w+', u_id: '\\d+' }),
		args.splice(2, 1, type = '\\w+'));
		const comments = Array.from(document.querySelectorAll('.track-comment-msg'));
		const reportRegex = this.reportRegex(...args);
		return comments.filter(t => t.innerHTML.match(reportRegex))
	}

	static setCookie(key, value, { days, domain, reload } = {}) {
		let entries = { [key]: value ?? '' };
		days && (entries.expires = new Date(864e5 * days + Date.now()).toUTCString());
		entries.domain = domain ?? ('.' + location.host);
		entries.path = '/';
		document.cookie = Object.entries(entries).map(([key, value]) => key + '=' + value).join('; ');
		reload && location.reload()
	}

	static verifyRaceData(data) {
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
	}

	static waitForElm(selector, limit) {
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
	}

	static warn(err) {
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
	}
}

Object.defineProperty(self, 'FreeRiderToolkit', {
	value: FreeRiderToolkit,
	writable: true
});

Object.defineProperty(self, 'toolkit', {
	value: new FreeRiderToolkit(),
	writable: true
});

function m(t, e) {
	for (var i in e)
		try {
			t[i] = e[i].constructor == Object ? m(t[i], e[i]) : e[i]
		} catch (s) {
			t[i] = e[i]
		}
	return t
}