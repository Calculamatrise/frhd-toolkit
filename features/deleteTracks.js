toolkit.modules.register('deleteTracks', function() {
	if ((!location.pathname.startsWith('/t/') && !location.pathname.startsWith('/random/track')) || !GameSettings.track || Application.settings.user.u_id !== GameSettings.track.u_id) return;

	const subscribeToAuthor = document.querySelector('.subscribe-to-author');
	let deleteTrack = document.querySelector('#frhd-toolkit\\.delete-track');
	if (!deleteTrack) {
		deleteTrack = toolkit.createElement('button.new-button#frhd-toolkit\\.delete-track', {
			textContent: 'Delete',
			style: {
				backgroundImage: 'linear-gradient(to bottom,#e95f4d,#d34836)',
				borderColor: '#d34836',
				display: 'inline-block',
				fontSize: '.8em',
				lineHeight: '22px',
				marginLeft: '.5em',
				maxHeight: '22px',
				padding: '0 1em',
				textTransform: 'capitalize'
			},
			async click() {
				confirm('Are you sure you want to hide your track?\nThis action can only be reversed by a moderator.') && await toolkit.externalApi(`tracks/${GameSettings.track.id}`, 'DELETE')
					.then(r => {
						const hiddenTracks = new Set(toolkit.storage.getEntry('hiddenTracks') || []);
						hiddenTracks.add(GameSettings.track.id);
						toolkit.storage.setEntry('hiddenTracks', Array.from(hiddenTracks));
						console.log(r.message)
					})
			}
		});
		subscribeToAuthor.after(deleteTrack);
	}
});