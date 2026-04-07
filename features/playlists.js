{

let currentUserRegex = null;
toolkit.modules.register('playlists', function() {
	if (!location.pathname.startsWith('/u/')) return;
	if (!currentUserRegex) {
		currentUserRegex = new RegExp(`^/u/${Application.settings.user.u_name}\\b`);
	}

	if (!location.pathname.match(currentUserRegex)) return;

	let recentlyPlayedTab = document.querySelector('.tab-entry.recently-played-tab');
	if (!recentlyPlayedTab || document.querySelector('.tab-entry.frhd-toolkit\\.play-later-tab')) return;
	let playlist = toolkit.fetchAndCachePlaylists('playlater');
	if (playlist.size < 1) return;
	let tab = recentlyPlayedTab.parentElement.appendChild(recentlyPlayedTab.cloneNode(true));
	tab.classList.add('frhd-toolkit.play-later-tab');
	tab.dataset.panel = '#frhd-toolkit\\.play-later';
	tab.firstElementChild.lastChild.data = 'Play Later';
	let recentlyPlayedPanel = document.querySelector('#profile_recently_played');
	if (!recentlyPlayedPanel) return;
	let panel = recentlyPlayedPanel.parentElement.appendChild(recentlyPlayedPanel.cloneNode(true));
	panel.setAttribute('id', 'frhd-toolkit.play-later');
	let list = panel.querySelector('.track-list');
	list.replaceChildren(...Array.from(playlist && playlist.values()).map(entry => {
		const authorUrl = 'https://' + location.host + '/u/' + entry.author;
		const trackUrl = 'https://' + location.host + '/t/' + entry.slug;
		return toolkit.createElement('li', {
			children: [
				toolkit.createElement('div.track-list-tile.trackTile', {
					children: [
						toolkit.createElement('a.top', {
							href: trackUrl,
							children: [
								toolkit.createElement('img.track-list-tile-thumb.top-image', {
									src: entry.img
								}),
								toolkit.createElement('img.track-list-tile-thumb', {
									alt: 'Track Preview',
									src: 'https://cdn.' + location.host.split('.').slice(-2).join('.') + '/free_rider_hd/sprites/track_preview_250x150.png'
								}),
								toolkit.createElement('span.bestTime', {
									innerText: ' ' + entry.averageTime + ' ',
									title: 'Average Time'
								})
							]
						}),
						toolkit.createElement('div.bottom', {
							children: [
								toolkit.createElement('a.name', {
									href: trackUrl,
									innerText: entry.title
								}),
								toolkit.createElement('div.profileGravatarIcon', {
									style: { backgroundImage: 'url(' + authorUrl + '/pic?size=50)' }
								}),
								toolkit.createElement('a.author', {
									href: authorUrl + '/created',
									innerHTML: '&ensp;' + entry.author
								})
							]
						})
					]
				})
			]
		})
	}))
});

}