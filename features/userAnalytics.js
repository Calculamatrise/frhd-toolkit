{

let currentUserRegex = null;
toolkit.modules.register('userAnalytics', function() {
	if (!location.pathname.startsWith('/u/')) return;
	if (!currentUserRegex) {
		currentUserRegex = new RegExp(`^/u/${Application.settings.user.u_name}\\b`);
	}

	if (!location.pathname.match(currentUserRegex)) return;

	document.querySelectorAll("#created_tracks .bottom").forEach(metadata => {
		metadata.innerHTML = metadata.innerHTML.replace(/<!--|-->/g, '')
	})
});

toolkit.styleSheet
	.set('#created_tracks .trackTile .bottom :is(.profileGravatarIcon, .author)', { display: 'none' })
	.set('#created_tracks .trackTile .bottom .stat', {
		display: 'inline-block',
		// float: 'right' // Only float right if avatar+username are shown
	})

}