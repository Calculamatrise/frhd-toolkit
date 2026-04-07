{
	Object.defineProperty(toolkit, 'downloadRace', {value: async function downloadRace(tid, uid) {
		return Application.Helpers.AjaxHelper.post("track_api/load_races", {
			t_id: tid,
			u_ids: uid
		}).done(({ data: [entry], result: r }) => {
			if (!r) throw new Error();
			r && toolkit.downloadFile('frhd_ghost_' + tid + '-' + uid, Object.assign(entry.race, {
				code: encodeReplayString(JSON.parse(entry.race.code)),
				metadata: {
					t_id: tid,
					u_id: entry.user.u_id
				}
			}), { desc: 'Race' })
		})
	}});

	function encodeReplayString(t, e = {}) {
		let i = { version: e.replayVersion ?? 1 };
		for (let s in t) {
			let n = t[s];
			i[s] = "";
			for (let r in n) {
				let o = n[r];
				i[s] += o.toString(32) + " "
			}
			i[s] = i[s].slice(0, -1)
		}
		return btoa(JSON.stringify(i))
	}
}

toolkit.modules.register('downloadRaces', function() {
	if ((!location.pathname.startsWith('/t/') && !location.pathname.startsWith('/random/track')) || !GameSettings.track) return;

	toolkit._nativeEvents.has('leaderboardEvent') || toolkit.initLeaderboardEvent();
	Application.events.subscribe('leaderboard.rendered', () => {
		for (const actionRow of document.querySelectorAll('.track-leaderboard-race-row[data-u_id="' + Application.settings.user.u_id + '"] > .track-leaderboard-action:not(:has(> #frhd-toolkit\\.download-race))')) {
			let download = toolkit.createElement('span.btn.new-button.button-type-1#frhd-toolkit\\.download-race', {
				innerText: '⭳',
				title: 'Download Race'
			});
			download.addEventListener('click', () => toolkit.downloadRace(GameSettings.track.id, download.parentElement.parentElement.dataset.u_id), { passive: true });
			actionRow.style.setProperty('width', '20%'),
			actionRow.prepend(download),
			actionRow.textContent.length > 0 && actionRow.replaceChildren(...actionRow.children)
		}
	})
});

toolkit.styleSheet
	.set('.track-page .track-leaderboard .track-leaderboard-action', { textAlign: 'right' })
	.set('.track-page .track-leaderboard .track-leaderboard-action > :is(span.core_icons, div.moderator-remove-race)', { right: '6px' })
	.set('#frhd-toolkit\\.download-race', {
		aspectRatio: 1,
		fontSize: '15px',
		height: '22px',
		lineHeight: '1.5em',
		marginRight: '8px',
		textAlign: 'center'
	})