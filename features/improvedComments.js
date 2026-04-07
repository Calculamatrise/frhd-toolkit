toolkit.modules.register('improvedComments', function() {
	if ((!location.pathname.startsWith('/t/') && !location.pathname.startsWith('/random/track')) || !GameSettings.track) return;
	toolkit.styleSheet.set('.track-comment:has(.track-comment-msg > a[href="' + location.origin + '/u/' + Application.settings.user.u_name + '"])', { backgroundColor: 'hsl(55 70% 85% / 1) !important' })
}, { once: true });