{

let trackData = null;
document.addEventListener('contextmenu', async function(event) {
	let currentUser = event.target.closest('.left-nav-profile-top');
	if (null !== currentUser) {
		event.preventDefault();
		const options = await buildUserContextMenu(Application.settings.user);
		options.splice(3, 0, {
			name: 'Logout',
			styles: ['danger'],
			click: () => Application.User.logout()
		});
		if (toolkit.config.get('accountManager')) {
			const accounts = Object.values(toolkit.storage.getEntry('account-manager') || {});
			const subOptions = accounts.map(account => ({
				name: account.name,
				styles: account.name.toLowerCase() === Application.settings.user.u_name && ['disabled'],
				click: () => {
					toolkit.setCookie('frhd_app_sr', account.asr, { days: 365 });
					location.reload()
				}
			}));
			accounts.length > 0 && subOptions.push({ type: 'hr' }) || subOptions.push({
				name: 'Add Account',
				// click: () => toolkit.getAccountManager({ createIfNotExists: true, showLogin: true }).showModal('login')
				click: () => Application.Helpers.TemplateHelper.getTemplates(["auth/signup_login"], function(t) {
					Application.router.auth_dialog_view.template = t["auth/signup_login"],
					Application.router.auth_dialog_view.options = Object.assign({}, Application.settings, { login: true }),
					Application.router.auth_dialog_view.setup()
				})
			}),
			subOptions.push({
				name: 'Manage Accounts',
				click: () => toolkit.getAccountManager({ createIfNotExists: true }).showModal()
			}),
			options.splice(3, 0, toolkit.config.get('accountManager') && {
				name: 'Switch Accounts',
				options: subOptions
			})
		}
		ContextMenu.create(options, event);
		return;
	}

	trackData === null && cacheTrackData();
	// track-list-tile
	let race = event.target.closest('.track-leaderboard-race-row');
	if (null !== race) {
		event.preventDefault();
		if (event.target.closest('.name')) {
			ContextMenu.create(await buildUserContextMenu(race.dataset), event);
			return;
		}

		const reports = toolkit.fetchReports('\'{data-u_id}\' by @{data-d_name}', race.dataset, { type: 'race' });
		const options = [{
			name: 'Race',
			click: () => GameManager.loadRace(GameManager.trackId, race.dataset.u_id)
		}, {
			name: 'Copy Race Data', // 'Request Race Data' if data is not loaded,
			click: () => fetchRace(race.dataset.u_id)
				.then(data => navigator.clipboard.writeText(JSON.stringify(data, '\t', 4))
				.catch(err => alert(err.message)))
		}, {
			name: race.dataset.legitimacy || 'Test Legitimacy',
			styles: race.dataset.legitimacy && ['disabled'],
			click: () => Application.Helpers.AjaxHelper.post('track_api/load_races', { // grab race data from GameSettings.raceData instead
				t_id: trackData.t_id,
				u_ids: race.dataset.u_id
			}).then(({ data, result: r }) => {
				if (!r) return alert('Race not found.');
				let [entry] = GameManager.game.currentScene.formatRaces(data);
				let isTas = !toolkit.verifyRaceData(entry);
				race.dataset.legitimacy = isTas ? 'Illegitimate (TAS)' : 'Legit';
				isTas && updateTASLeaderboard([entry])
			})
		}, toolkit.isUserModerator(Application.settings.user) || (Application.settings.user.u_id == race.dataset.u_id ? {
			name: 'Delete',
			styles: ['danger', race.dataset.requested && 'disabled'],
			click: async () => {
				confirm('Are you sure you want to permanently remove your race?\nThis action is irreversible and prevents you from creating another race on this track.') && await toolkit.externalApi(`tracks/${trackData.id ?? trackData.t_id}/races`, 'DELETE')
					.then(r => console.log(r.message))
			}
		} : {
			name: 'Report',
			styles: ['danger', (race.dataset.reported || reports.length > 0) && 'disabled'],
			click: () => toolkit.report('Race \'{data-u_id}\' by @{data-d_name}', race.dataset, { type: 'race' }).then(() => {
				race.dataset.reported = true
			})
		})];
		if (Application.settings.user.u_id != race.dataset.u_id) {
			const raceData = GameManager.game.currentScene.races.find(({ user: u }) => u.u_id == race.dataset.u_id);
			if (raceData) {
				const cosmetics = await fetchCurrentUserCosmetics();
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
			click: () => toolkit.fetchRaceBestDate().then(date => race.setAttribute('title', date))
		}, {
			name: 'Download',
			click: () => toolkit.downloadRace(trackData.t_id, race.dataset.u_id)
		});
		if (Application.settings.user.moderator) {
			let targetUser = await fetchUser(race.dataset.d_name);
			options.splice(options.length - 1, 0, {
				name: 'Feature',
				click: () =>  navigator.clipboard.writeText('"frhd.co/t/' + trackData.t_id + '/r/' + race.dataset.d_name.toLowerCase() + '": ""').then(() => {
					window.open('https://github.com/Calculamatrise/frhd-featured-ghosts/edit/master/data.json', 'blank')
				})
			}, {
				name: 'Delete',
				styles: ['danger'],
				click: () => Application.Helpers.AjaxHelper.post('moderator/remove_race', {
					t_id: trackData.t_id,
					u_id: race.dataset.u_id
				}).then(r => r.result && (race.remove(),
				Application.router.current_view.refresh_leaderboard())).fail(err => alert('Something went wrong! ' + err.message))
			}, {
				name: 'Delete & Ban', // only show if mod
				styles: ['danger', targetUser.user.banned && 'disabled'],
				click: () => Application.Helpers.AjaxHelper.post('moderator/remove_race', {
					t_id: trackData.t_id,
					u_id: race.dataset.u_id
				}).then(r => r.result && (race.remove(),
				Application.router.current_view.refresh_leaderboard(),
				Application.Helpers.AjaxHelper.post('moderator/ban_user', {
					u_id: race.dataset.u_id
				}))).fail(err => alert('Something went wrong! ' + err.message))
			});
		}
		toolkit.config.get('developerMode') && options.push({ type: 'hr' }, {
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
				t_id: trackData.t_id,
				u_ids: Array.from(leaderboard.querySelectorAll('.track-leaderboard-race-row')).map(row => row.dataset.u_id).join(',')
			}).then(r => r.result && GameManager.game.currentScene.addRaces(r.data))
		}, toolkit.isUserModerator(Application.settings.user) && {
			name: 'Copy Race Data',
			click: () => toolkit.fetchRaces(Array.from(leaderboard.querySelectorAll('.track-leaderboard-race-row')).map(row => row.dataset.u_id)).then(races => navigator.clipboard.writeText(JSON.stringify(races, '\t', 4)).catch(err => alert(err.message)))
		}, { type: 'hr' }, toolkit.isUserModerator(Application.settings.user) ? {
			name: 'Delete All',
			styles: ['danger', 'disabled'],
			click: () => confirm('Are you sure you want to delete ALL races on this leaderboard? This cannot be undone.') && Promise.all(Array.from(leaderboard.querySelectorAll('.track-leaderboard-race-row')).map(row => {
				return Application.Helpers.AjaxHelper.post('moderator/remove_race', {
					t_id: trackData.t_id,
					u_id: row.dataset.u_id
				})
			}))
		} : {
			name: 'Report',
			styles: ['danger'], // check session storage and disable button
			click: () => toolkit.report('Leaderboard', {}, { type: 'leaderboard' })
		}];
		ContextMenu.create(options, event);
		return;
	}

	let comment = event.target.closest('.track-comment');
	if (null !== comment) {
		event.preventDefault();
		if (event.target.closest('.track-comment-img, a.bold')) {
			ContextMenu.create(await buildUserContextMenu(comment.dataset), event);
			return;
		} else if (event.target.tagName === 'A') {
			let href = event.target.href;
			let user = await fetchUser(href.replace(/.+\//, '')).then(r => r.user);
			ContextMenu.create(await buildUserContextMenu(user), event);
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
			click: () => Application.router.current_view._delete_comment(trackData.t_id, comment.dataset.c_id, r => r.result && comment.remove())
		} : toolkit.isUserModerator(Application.settings.user) || {
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
		toolkit.config.get('developerMode') && options.push({ type: 'hr' }, {
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
			const options = await buildUserContextMenu(trackData.author);
			let subscribe = document.querySelector('#subscribe_to_author');
			Application.settings.user.u_id != trackData.author_id && options.splice(3, 0, {
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
			click: () => fetchTrackLastPlayedDate().then(date => track.dataset.last_played_date = date)
		} /* , {
			name: 'Add to Playlist',
			options: [{
				name: 'Play Later'
			}, {
				name: 'Create a new Playlist'
			}]
		} */];
		let playlist = toolkit.fetchAndCachePlaylists('playlater');
		let savedToPlaylater = playlist && playlist.has(trackData.t_id);
		let showPlaylistButton = savedToPlaylater || toolkit.config.get('playlists');
		if (showPlaylistButton) {
		// if (toolkit.config.get('playlists')) {
			// let playlist = toolkit.fetchAndCachePlaylists('playlater');
			// let savedToPlaylater = playlist && playlist.has(trackData.t_id);
			// let showPlaylistButton = savedToPlaylater || toolkit.config.get('playlists');
			showPlaylistButton && options.splice(2, 0, {
				name: (savedToPlaylater ? 'Remove from' : 'Add to') + ' Playlist',
				styles: [savedToPlaylater && 'danger', savedToPlaylater && !toolkit.config.get('playlists') && 'disabled'],
				click: () => Application.Helpers.AjaxHelper.get('t/' + trackData.t_id).then(({ track, user_track_stats }) => {
					const playlist = toolkit.fetchAndCachePlaylists('playlater');
					playlist[savedToPlaylater ? 'delete' : 'set'](trackData.t_id, {
						author: track.author,
						averageTime: user_track_stats.avg_time,
						featured: track.featured,
						id: trackData.t_id,
						img: track.img,
						slug: track.slug,
						title: track.title
					});
					playlist.size > 0 ? toolkit.storage.setEntry('playlists.playlater', Array.from(playlist.values())) : toolkit.storage.deleteEntry('playlists.playlater')
				})
			});
		}
		Application.settings.user.u_id == trackData.author_id ? (options.push({
			name: 'Download',
			click: () => toolkit.downloadTrack(trackData.t_id)
		}, toolkit.isUserModerator(Application.settings.user) || {
			name: 'Delete',
			styles: ['danger'],
			click: async () => {
				confirm('Are you sure you want to hide your track?\nThis action can only be reversed by a moderator.') && await toolkit.externalApi(`tracks/${trackData.id ?? trackData.t_id}`, 'DELETE')
					.then(r => {
						const hiddenTracks = new Set(toolkit.storage.getEntry('hiddenTracks') || []);
						hiddenTracks.add(trackData.id ?? trackData.t_id);
						toolkit.storage.setEntry('hiddenTracks', Array.from(hiddenTracks));
						console.log(r.message)
					})
			}
		})) : toolkit.isUserModerator(Application.settings.user) || options.push({
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
			click: () => Application.Helpers.AjaxHelper.post('track_api/feature_track/' + trackData.t_id + '/' + (1 - GameSettings.track.featured)).then(r => {
				r.result && (trackData.featured = !trackData.featured,
				GameSettings.track.featured = trackData.featured)
			})
		}, {
			name: (trackData.hide ? 'Unh' : 'H') + 'ide', // unhide if hidden
			styles: ['danger'],
			click: () => Application.Helpers.AjaxHelper.get('moderator/hide_track/' + trackData.t_id).then(r => {
				r.result && (trackData.hide = 1 - trackData.hide,
				GameSettings.track.hide = trackData.hide)
			})
		});
		Application.settings.user.admin && options.push({ type: 'hr' }, {
			name: 'Remove Track of the Day',
			styles: ['danger'],
			click: () => Application.Helpers.AjaxHelper.post('admin/removeTrackOfTheDay', {
				t_id: trackData.t_id
			})
		}, {
			name: (trackData.hide ? 'Unh' : 'H') + 'ide', // unhide if hidden
			styles: ['danger'],
			click: () => Application.Helpers.AjaxHelper.post('admin/' + (trackData.hide ? 'un' : '') + 'hide_track', { track_id: trackData.t_id }).then(r => {
				r.result && (trackData.hide = 1 - trackData.hide,
				GameSettings.track.hide = trackData.hide)
			})
		}, {
			name: 'Set Uploading Ban',
			styles: ['danger'],
			click: () => Application.Helpers.AjaxHelper.post('admin/user_ban_uploading', {
				uploading_ban_uname: trackData.author.u_name
			})
		});
		toolkit.config.get('developerMode') && options.push({ type: 'hr' }, {
			name: 'Copy Track Id',
			click: () => navigator.clipboard.writeText(trackData.t_id)
		});
		ContextMenu.create(options, event);
		return;
	}
});

async function buildUserContextMenu(data) {
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
		let currentUser = await toolkit.fetchCurrentUser();
		let isFriend = currentUser.friends.friends_data.find(compareUsers.bind(this, data));
		let request = currentUser.friend_requests.request_cnt > 0 && currentUser.friend_requests.request_data.find(compareUsers.bind(this, data));
		const reports = toolkit.fetchReports('@{data-d_name} ({data-u_id})', data, { type: 'user' });
		const cachedReports = toolkit.storage.getEntry('reports.users');
		const reported = cachedReports && cachedReports.includes(data.u_id);
		options.splice(2, 0, {
			name: !request || !request.outgoing ? (isFriend ? 'Remove' : 'Add') + ' Friend' : 'Pending',
			styles: [isFriend && 'danger', (!isFriend && currentUser.friends.friend_cnt >= 30 || request && request.outgoing) && 'disabled'],
			click: () => Application.Helpers.AjaxHelper.post('friends/' + (isFriend ? 'remove_friend' : 'send_friend_request'), { u_name: data.d_name }).done(({ result }) => {
				!isFriend && (currentUser.friend_requests.request_data.push(Object.assign({ outgoing: true }, data)),
				currentUser.friend_requests.request_cnt = currentUser.friend_requests.request_data.length,
				toolkit.storage.setEntry('current_user', currentUser, { temp: true }))
			})
		}, toolkit.isUserModerator(Application.settings.user) || {
			name: 'Report',
			styles: ['danger', (reported || reports.length > 0) && 'disabled'], // check session storage and disable button
			// if more than one ghost is reported, report the leaderboard instead and disable all ghost reports on track
			click: () => toolkit.report('User @{data-d_name} ({data-u_id})', data, { type: 'user' }).then(() => {
				toolkit.storage.updateEntry('reports.users', [data.u_id])
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
		let targetUser = await fetchUser(data.d_name || data.u_name || data.u_id);
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
	toolkit.config.get('developerMode') && options.push({ type: 'hr' }, {
		name: 'Copy User Id',
		click: () => navigator.clipboard.writeText(data.u_id)
	});
	return options
}

function cacheTrackData() {
	const data = document.querySelector('#track-data');
	let combined = Object.assign({}, data && data.dataset, Object.hasOwn(window, 'GameSettings') && GameSettings.track);
	trackData = Object.keys(combined).length > 0 ? Object.assign(combined, {
		author: {
			d_name: combined.author,
			u_id: parseInt(combined.author_id || combined.u_id),
			u_name: combined.u_url || combined.author?.toLowerCase()
		}
	}) : null
}

function compareUsers(a, b) {
	return a.u_id == b.u_id || a.u_name == b.u_name || a.d_name == b.d_name
}

function updateTASLeaderboard(races) {
	let leaderboard = fetchTASLeaderboard({ createIfNotExists: true });
	for (let data of races) {
		let row = leaderboard.appendChild(fetchRaceRow(data, { parent: leaderboard, placement: 1 + races.indexOf(data) }))
			, num = row.querySelector('.num');
		num.innerText = (1 + races.indexOf(data)) + '.';
		let stats = Object.fromEntries(Object.keys(data.race.code.tas).slice(1).map(value => value.split(/:\s*/).map(value => isFinite(value) ? parseFloat(value) : value.replace(/\s+/g, '_'))))
			, time = row.querySelector(':nth-child(4)');
		time.innerText = formatRaceTime(stats.run_ticks / GameSettings.drawFPS * 1e3);
		let actionRow = row.querySelector('.track-leaderboard-action');
		actionRow.querySelector('span.core_icons.core_icons-btn_add_race.track-leaderboard-race') || actionRow.appendChild(toolkit.createElement('span.core_icons.core_icons-btn_add_race.track-leaderboard-race', {
			title: 'Race ' + data.user.d_name,
			click() {
				let row = this.closest('.track-leaderboard-race-row');
				// toolkit.scene.removeRaces([row.dataset.u_id])
			}
		}))
	}
}

function fetchTASLeaderboard({ createIfNotExists } = {}) {
	let leaderboard = document.querySelector('#frhd-toolkit\\.tas-leaderboard > table > tbody');
	if (!leaderboard && createIfNotExists) {
		let globalLeaderboard = document.querySelector('#track_leaderboard');
		if (!globalLeaderboard) return;
		leaderboard = globalLeaderboard.cloneNode(true);
		leaderboard.setAttribute('id', toolkit.keyify('tas-leaderboard'));
		let title = leaderboard.querySelector('h3:first-child');
		title.setAttribute('title', 'Tool-assisted speedruns');
		title.innerText = 'TAS BEST TIMES';
		globalLeaderboard.after(leaderboard);
		leaderboard = leaderboard.querySelector('table > tbody');
		leaderboard.replaceChildren();
	}
	return leaderboard || null
}

async function fetchRace(uid, { trackId = GameManager.trackId } = {}) {
	if (typeof uids == 'object') return fetchRaces(...arguments);
	let data = GameManager.trackId === trackId && GameSettings.raceData && GameSettings.raceData.find(data => data.user.u_id == uid);
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

async function fetchRaces(uids, { trackId = GameManager.trackId } = {}) {
	if (typeof uids != 'object') return fetchRace(...arguments);
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

function fetchRaceRow(data, { parent, placement }) {
	const racerProfile = 'https://' + location.host + '/u/' + data.user.d_name.toLowerCase();
	const racerAvatar = racerProfile + '/pic?sz=50';
	let row = parent.querySelector('tr.track-leaderboard-race-' + data.user.u_id);
	if (row === null) {
		row = toolkit.createElement('tr', {
			className: 'track-leaderboard-race-' + data.user.u_id + ' track-leaderboard-race-row',
			dataset: {
				u_id: data.user.u_id,
				d_name: data.user.d_name,
				run_time: data.runTime,
				// type: 'tas'
			},
			children: [
				toolkit.createElement('td.num', { innerText: placement + '.' }),
				toolkit.createElement('td.name', {
					children: [
						toolkit.createElement('a.profile-icon', {
							href: racerProfile,
							title: 'View Profile',
							children: [
								toolkit.createElement('div.circular', {
									style: {
										background: 'url(' + racerAvatar + ') no-repeat center center',
										backgroundSize: '100%'
									},
									children: [
										toolkit.createElement('img', {
											src: racerAvatar,
											width: 35,
											height: 35,
											alt: data.user.d_name
										})
									]
								})
							]
						}),
						toolkit.createElement('span.track-leaderboard-race', {
							innerText: data.user.d_name,
							title: 'Race ' + data.user.d_name
						})
					]
				}),
				document.createElement('td'),
				toolkit.createElement('td', {
					innerText: data.runTime,
					style: { textAlign: 'left' }
				}),
				toolkit.createElement('td.track-leaderboard-action', {
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

async function fetchTrackLastPlayedDate({ force } = {}) {
	const KEY = toolkit.keyify('track_last_played_dates');
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

const users = [];
async function fetchUser(uid, { cache, force } = {}) {
	uid = String(uid).toLowerCase();
	if (uid == Application.settings.user.u_id || uid == Application.settings.user.u_name) return toolkit.fetchCurrentUser();
	let entry = users.find(({ user: { u_id, u_name }}) => u_id == uid || u_name === uid.toLowerCase());
	if (entry && !force) {
		return entry;
	}
	const { ajax } = Application.router.current_view;
	entry = ajax && ajax.header_title && ((ajax.user && uid === ajax.user.u_id) || uid === ajax.header_title.toLowerCase()) ? ajax : await fetch('/u/' + uid + '?ajax').then(r => r.json());
	// let entry = await fetch('/u/' + uid + '?ajax').then(r => r.json());
	!1 !== cache && users.push(entry);
	return entry || null
}

function formatRaceTime(t) {
	t = parseInt(t, 10);
	let e = t % 6e4 / 1e3;
	return Math.floor(t / 6e4) + ":" + e.toFixed(2).padStart(5, 0)
}

async function fetchCurrentUserCosmetics({ force } = {}) {
	const KEY = toolkit.keyify('current_user.cosmetics');
	let cache = sessionStorage.getItem(KEY);
	if (cache && !force) {
		return JSON.parse(cache);
	}

	let data = await fetch('/store/gear?ajax').then(r => r.json());
	sessionStorage.setItem(KEY, JSON.stringify(data));
	return data
}

}

toolkit.styleSheet.set('context-menu', {
	'--background-color': 'hsl(200deg 15% 15%)',
	'--border-color': 'hsl(200deg 25% 25% / 50%)',
	'--color': 'hsl(0 0% 90%)',
	fontSize: 'clamp(9px, .75rem, 13px)'
})