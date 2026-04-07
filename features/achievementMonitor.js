{

let achievementMonitor;
toolkit.modules.register('achievementMonitor', function() {
	if (!location.pathname.match(/^\/t\//i) || !GameSettings.track) return;
	toolkit._nativeEvents.has('notificationEvent') || initNotificationEvent();
	if (!achievementMonitor) {
		Application.events.subscribe('notification.received', ({ data }) => {
			if ('undefined' != typeof data && ('undefined' != typeof data.achievements_earned)) {
				'undefined' != typeof data.achievements_earned && Application.events.publish('achievementsEarned', data.achievements_earned);
				toolkit.refreshAchievements({ force: true }) // only update percentages // updateAchievements?
			}
		});
		achievementMonitor = {
			container: toolkit.createElement('div#achievements-container', {
				style: {
					display: 'flex',
					flexDirection: 'column',
					fontFamily: 'riffic',
					gap: '.4rem'
				}
			})
		};
		achievementMonitor.wrapper = toolkit.createElement('div#frhd-toolkit\\.achievement-monitor', {
			children: [
				toolkit.createElement('a', {
					children: [
						toolkit.createElement('span', {
							innerText: 'Daily Achievements',
							style: { float: 'left' }
						}),
						achievementMonitor.countdown = toolkit.createElement('span.time-remaining', {
							innerText: '00:00:00',
							style: { float: 'right' }
						})
					],
					href: '/achievements',
					style: {
						borderBottom: '1px solid var(--brdr-clr, hsl(190deg 25% 60%))',
						color: 'currentColor',
						fontFamily: 'helsinki',
						paddingBottom: '5px'
					}
				}),
				achievementMonitor.container
			],
			style: {
				backgroundColor: 'var(--bg-clr, hsl(190 25% 95% / 1))',
				// backgroundImage: 'linear-gradient(transparent, hsl(191 25% 90% / 1))',
				border: '1px solid var(--brdr-clr, hsl(190deg 25% 60%))',
				borderRadius: '1rem',
				display: 'flex',
				flexDirection: 'column',
				gap: '.6rem',
				margin: '0 .6rem',
				padding: '1.5rem',
				width: '-webkit-fill-available'
			}
		})
	}

	refreshAchievements().then(r => {
		achievementMonitor.countdown.innerText = [String(Math.floor(r.time_left / 3600)).padStart(2, '0'), String(Math.floor((r.time_left % 3600) / 60)).padStart(2, '0'), String(Math.floor(r.time_left % 60)).padStart(2, '0')].join(':');
		achievementMonitor.countdownTimer ||= setInterval(() => {
			let lastTime = achievementMonitor.countdown.innerText.split(':').map(e => parseInt(e));
			lastTime[2] === 0 && (lastTime[1] === 0 && (lastTime[0]--,
			lastTime[1] = 59),
			lastTime[1]--,
			lastTime[2] = 59);
			lastTime[2]--;
			lastTime.reduce((sum, remainingTime) => sum += remainingTime, 0) === 0 && clearInterval(achievementMonitor.countdownTimer);
			achievementMonitor.countdown.innerText = lastTime.map(e => String(e).padStart(2, '0')).join(':');
			r.time_left -= 1,
			window.navigation && navigation.addEventListener('navigate', e => e.navigationType != 'replace' && updateAchievements({ time_left: r.time_left }), { once: true, passive: true })
		}, 1e3);
		const rightContent = document.querySelector('#right_content');
		rightContent.prepend(achievementMonitor.wrapper)
	})
});

function refreshAchievements() {
	return fetchAchievements(...arguments).then(async res => {
		const children = await Promise.all(res.achievements.filter(a => !a.complete).sort((a, b) => b.tot_num - a.tot_num).slice(0, 3).map(createProgressElement.bind(toolkit)));
		achievementMonitor.container.replaceChildren(...children);
		return res
	})
}

async function updateAchievements(data, { force } = {}) {
	const KEY = toolkit.keyify('achievements');
	const entry = await fetchAchievements({ force });
	sessionStorage.setItem(KEY, JSON.stringify(Object.assign(entry, data)));
	return entry
}

async function fetchAchievements({ force } = {}) {
	const KEY = toolkit.keyify('achievements');
	let cache = sessionStorage.getItem(KEY);
	if (cache && !force) {
		return JSON.parse(cache);
	}

	let data = await fetch('/achievements?ajax').then(r => r.json());
	sessionStorage.setItem(KEY, JSON.stringify(data));
	return data
}

async function createProgressElement(achievement) {
	let container = toolkit.createElement('div.achievement-info', {
		children: [
			toolkit.createElement('div', {
				children: [
					toolkit.createElement('span.achievements-coin.store_icons.store_icons-coin_icon_lg.achievement-coin-value', {
						innerText: achievement.coins,
						style: {
							color: 'white',
							lineHeight: '45px',
							textAlign: 'center',
							textShadow: '0 -1px 1px #9E8500'
						}
					}),
					toolkit.createElement('div.achievement-info', {
						children: [
							toolkit.createElement('a.title', {
								children: [
									toolkit.createElement('b', {
										innerText: achievement.title
									})
								],
								href: await (description => {
									switch (description) {
									case 'Buy 1 item from the shop':
										return 'store/gear';
									case 'Complete 1 friend race':
									case 'Win 5 friend(s) race':
										return toolkit.fetchCurrentUser().then(async ({ friends }) => {
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
										return toolkit.fetchCurrentUser().then(({ recently_ghosted_tracks: { tracks }}) => {
											let track = tracks[Math.floor(Math.random() * tracks.length)];
											return track ? track.slug : 'random/track';
										});
									default:
										return 'random/track'
									}
								})(achievement.desc),
								style: { width: '-webkit-fill-available' }
							}),
							toolkit.createElement('h6.achievement-info-desc.condensed', {
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
			toolkit.createElement('span', {
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

function initNotificationEvent() {
	const prototype = Object.getPrototypeOf(Application.Helpers.AjaxHelper);
	const checkNotificationEvent = prototype._check_event_notification;
	toolkit._nativeEvents.set('notificationEvent', checkNotificationEvent);
	prototype._check_event_notification = function(e) {
		checkNotificationEvent.apply(this, arguments);
		e.result && Application.events.publish('notification.received', ...arguments);
	}
	Object.setPrototypeOf(Application.Helpers.AjaxHelper, prototype)
}

}