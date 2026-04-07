toolkit.modules.register('reportRelay', function() {
	let confirm = document.querySelector('.track-flag ~ .track-confirm-flag > .yes');
	if (!confirm || confirm.classList.contains('frhd-toolkit.track-report')) return;
	confirm.classList.add('frhd-toolkit.track-report');
	confirm.addEventListener('click', () => {
		toolkit.report('This track', {}, { type: 'track' }).then(r => alert(r.result ? "You have successfully reported this track." : r.msg))
	}, { passive: true })
})