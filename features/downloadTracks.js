Object.defineProperty(toolkit, 'downloadTrack', {value: async function downloadTrack(id) {
	return fetch('/track_api/load_track?id=' + id + '&fields[]=code&fields[]=id&fields[]=title').then(r => r.json()).then(({ data: { track } = {}, result }) => {
		if (!result) return;
		toolkit.downloadFile(track.title + '-' + track.id, track.code, { desc: 'Track' })
	})
}});

toolkit.modules.register('downloadTracks', function() {
	if ((!location.pathname.startsWith('/t/') && !location.pathname.startsWith('/random/track')) || !GameSettings.track || Application.settings.user.u_id !== GameSettings.track.u_id) return;

	let subscribeToAuthor = document.querySelector('.subscribe-to-author-button');
	let downloadTrack = document.querySelector('#frhd-toolkit\\.download-track');
	if (!downloadTrack) {
		subscribeToAuthor.addEventListener('click', () => toolkit.downloadTrack(GameSettings.track.id), { passive: true }),
		subscribeToAuthor.setAttribute('id', 'frhd-toolkit.download-track'),
		subscribeToAuthor.innerText = 'Download'
	}
});