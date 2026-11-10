

toolkit.modules.register('deleteRaces', function() {
	if ((!location.pathname.startsWith('/t/') && !location.pathname.startsWith('/random/track')) || !GameSettings.track) return;

	toolkit._nativeEvents.has('leaderboardEvent') || toolkit.initLeaderboardEvent();
	Application.events.subscribe('leaderboard.rendered', () => {
		for (const actionRow of document.querySelectorAll('.track-leaderboard-race-row[data-u_id="' + Application.settings.user.u_id + '"] > .track-leaderboard-action:not(:has(> #frhd-toolkit\\.delete-race))')) {
			const addRace = actionRow.querySelector('.core_icons-btn_add_race');
			addRace?.style.setProperty('display', 'none');

			const btn = toolkit.createElement('span.btn.new-button.button-type-1#frhd-toolkit\\.delete-race', {
				innerText: 'X',
				title: 'Delete Race',
				style: {
					backgroundImage: 'linear-gradient(to bottom,#e95f4d,#d34836)',
					height: '1.5em',
					lineHeight: '1.5em',
					marginRight: '.33em',
					paddingLeft: '.33em',
					textAlign: 'left',
					width: '1.5em'
				}
			});
			btn.addEventListener('click', async () => {
				confirm('Are you sure you want to permanently remove your race?\nThis action is irreversible and prevents you from creating another race on this track.') && await toolkit.externalApi(`tracks/${GameSettings.track.id}/races`, 'DELETE')
					.then(r => console.log(r.message))
			}, { passive: true });
			actionRow.style.setProperty('width', '25%'),
			actionRow.prepend(btn),
			actionRow.textContent.length > 0 && actionRow.replaceChildren(...actionRow.children)
		}
	})
});