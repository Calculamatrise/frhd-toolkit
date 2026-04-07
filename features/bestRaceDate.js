Object.defineProperty(toolkit, 'fetchRaceBestDate', {value: async function fetchRaceBestDate({ force } = {}) {
	const KEY = toolkit.keyify('race_best_dates');
	let cache = JSON.parse(sessionStorage.getItem(KEY)) || {}
		, t = GameSettings.track.id;
	if (!force && cache[t]) {
		return cache[t]
	}
	const { lastRequest: ajax } = Application.Helpers.AjaxHelper;
	const { user_track_stats: { best_date: date } = {}} = ajax && ajax.track && ajax.track.id === t ? ajax : await fetch(location.pathname + '?ajax').then(r => r.json());
	sessionStorage.setItem(KEY, JSON.stringify(Object.assign(cache, { [t]: date })));
	return date
}});

toolkit.modules.register('bestRaceTimestamp', function() {
	toolkit._nativeEvents.has('leaderboardEvent') || toolkit.initLeaderboardEvent();
	Application.events.subscribe('leaderboard.rendered', () => {
		document.querySelectorAll(`.track-leaderboard-race-row[data-u_id="${Application.settings.user.u_id}"]`).forEach(race => {
			race.setAttribute('title', 'Loading...'),
			race.addEventListener('pointerover', () => toolkit.fetchRaceBestDate().then(date => race.setAttribute('title', date)), { once: true, passive: true })
		})
	})
});