{

toolkit.modules.register('featuredGhosts', function() {
	if (!location.pathname.match(/^\/t\//i) || !GameSettings.track) return;
	toolkit._nativeEvents.has('leaderboardEvent') || toolkit.initLeaderboardEvent();
	// Application.router.current_view.on('leaderboard.rendered', async () => {
	Application.events.subscribe('leaderboard.rendered', async () => {
		const matches = Object.fromEntries(Object.entries(await fetchFeaturedGhosts()).filter(e => Object.keys(e[1] = Object.fromEntries(Object.entries(e[1]).filter(([t]) => parseInt(t.split('/t/')[1]) == Application.router.current_view._get_track_id()))).length));
		for (const player in matches) {
			for (const ghost in matches[player]) {
				let name = ghost.split('/r/')[1];
				for (const row of document.querySelectorAll('.track-page .track-leaderboard .track-leaderboard-race-row[data-d_name="' + name + '" i]')) {
					let hue = 10;
					switch(matches[player][ghost]) {
						case 'fast': hue = 180; break;
						case 'vehicle': hue = 40; break;
						case 'trick': hue = 120;
					}

					let num = row.querySelector('.num');
					num.classList.add('core_icons', 'core_icons-icon_featured_badge'),
					num.classList.remove('num'),
					num.innerText = null,
					num.setAttribute('title', 'Featured'),
					row.style.setProperty('background-color', `hsl(${hue}deg 60% 50% / 40%)`)
				}
			}
		}
	})
});

async function fetchFeaturedGhosts({ force } = {}) {
	const KEY = toolkit.keyify('featured_ghosts');
	let cache = sessionStorage.getItem(KEY);
	if (cache && !force) {
		return JSON.parse(cache);
	}

	let data = await fetch("https://raw.githubusercontent.com/calculamatrise/frhd-featured-ghosts/master/data.json").then(r => r.json());
	sessionStorage.setItem(KEY, JSON.stringify(data));
	return data
}

function isFeaturedRace(user) {
	// GameSettings.track.id
	let data = toolkit.storage.getEntry('featured_ghosts', null, { temp: true });
	if (!data) return !1;
	return Object.entries(data).filter(([, entries]) => Object.keys(entries).find(t => t.includes(GameSettings.track.id))).map(([u]) => u.toLowerCase()).includes(user.u_name)
}

}