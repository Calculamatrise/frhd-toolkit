{

const parseTicks = time => {
	if (!time) return 0;
	let parts = time.split(':').map(value => parseFloat(value));
	return Math.round((parts[1] * 1e3 + parts[0] * 6e4) * (GameSettings.drawFPS / 1e3))
};

toolkit.modules.register('raceMetadata', function() {
	toolkit._nativeEvents.has('leaderboardEvent') || toolkit.initLeaderboardEvent();
	Application.events.subscribe('leaderboard.rendered', ({ track_leaderboard: trackLeaderboard }) => {
		trackLeaderboard = trackLeaderboard.filter(({ user_no_race_data }) => !user_no_race_data);
		const averageTicks = trackLeaderboard.reduce((total, { run_time }) => total += parseTicks(run_time), 0) / trackLeaderboard.length;
		for (let player of trackLeaderboard.filter(({ run_time: runTime, u_id: userId }, index) => {
			if (!runTime) return true;
			const filteredAverageTicks = trackLeaderboard.filter(({ u_id }) => u_id !== userId).reduce((total, { run_time }) => total += parseTicks(run_time), 0) / trackLeaderboard.length;
			const max = parseTicks(trackLeaderboard.at(-1).run_time);
			const calculatedMargin = max - parseTicks(trackLeaderboard[Math.min(trackLeaderboard.length - 1, index + 1)].run_time);
			toolkit.debug && console.debug(averageTicks, parseTicks(runTime), 'diff', averageTicks - parseTicks(runTime), 'max diff', max - averageTicks, max - filteredAverageTicks, filteredAverageTicks, calculatedMargin, 'max', max, 'max divided by 100', max / 100, calculatedMargin / max, calculatedMargin * (max / 100), max / calculatedMargin)
			if (averageTicks - parseTicks(runTime) > (max - filteredAverageTicks) * toolkit.config.get('flagSensitivity')) return true;
			return false
		})) {
			for (let flag of document.querySelectorAll('.track-leaderboard-race-row[data-u_id="' + player.u_id + '"] > .num:not(:has(> #frhd-toolkit\\.flagged))')) {
				flag.setAttribute('id', 'frhd-toolkit.flagged');
				flag.setAttribute('title', 'This race has been flagged by frhd-toolkit under suspicion of misconduct.');
				flag.innerText = '⚠️';
			}
		}
	})
});

}