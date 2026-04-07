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
})

}