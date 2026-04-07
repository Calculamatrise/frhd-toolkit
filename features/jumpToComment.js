{

let lastLoadedComment;
toolkit.modules.register('jumpToComment', async function() {
	if (!location.search.includes('c_id=')) {
		if (!location.pathname.startsWith('/notifications')) return;
		const { notification_days: d } = Application.Helpers.AjaxHelper.lastRequest && /^notifications$/i.test(Application.Helpers.AjaxHelper.lastRequest.header_title) ? Application.Helpers.AjaxHelper.lastRequest : await Application.Helpers.AjaxHelper.get('notifications')
			, notifications = d && d.length > 0 && d.flatMap(({ notifications: n }) => n)
			, commentNotifications = notifications.filter(({ t_uname_mention: t }) => t);
		for (const { comment, track, ts } of commentNotifications) {
			const notification = document.querySelector('.notification[data-ts="' + ts + '"] p > a[href$="' + track.url + '"]')
			notification && (notification.href += '?c_id=' + comment.id)
		}
		return;
	}

	const searchParams = new URLSearchParams(location.search);
	const commentId = searchParams.get('c_id');
	if (!commentId || lastLoadedComment == commentId /* || document.querySelector('.track-comment[data-c_id="' + commentId + '"]') */) return;
	lastLoadedComment = commentId;
	if (typeof Application.router.current_view.load_comments_until != 'function') {
		const prototype = Object.getPrototypeOf(Application.router.current_view);
		prototype.load_comments_until = async function(cid, callback) {
			let c = document.querySelector(`.track-comment[data-c_id="${commentId}"]`);
			if (c) return callback(c);
			let o = await toolkit.waitForElm(".track-comments-list div.track-comment:last-child").then(e => e.dataset.c_id)
				, r = this._get_track_id()
				, i = document.querySelector('.track-prev-comments');
			i.style.setProperty('display', 'none');
			let s = document.querySelector('.track-comments-loading');
			s.style.setProperty('display', 'block');
			this._get_comment_template(() => {
				Application.Helpers.AjaxHelper.post("track_comments/load_more/" + r + "/" + o).then(e => {
					if (e.result === !0 && e.data.track_comments.length > 0) {
						var a = Application.Helpers.TemplateHelper.render(this.templates["track/track_comment"], {}, e.data)
							, o = this.$el.find(".track-comments-list")
							, n = e.data.track_comments.findIndex(({ comment }) => comment.id == cid) > 0;
						o.append(a),
						e.data.track_comments_load_more === !0 && (n ? i.style.removeProperty('display') : this.load_comments_until(...arguments)),
						n && typeof callback == 'function' && callback(document.querySelector('.track-comment[data-c_id="' + cid + '"]'))
					}
					s.style.setProperty('display', 'none'),
					Application.events.publish('resize')
				})
			})
		};
		Object.setPrototypeOf(Application.router.current_view, prototype);
	}

	Application.router.current_view.load_comments_until(commentId, comment => {
		comment.scrollIntoView({ behavior: 'smooth' });
		addEventListener('scrollend', () => {
			comment.classList.add('animated', 'flash');
			setTimeout(() => comment.classList.remove('animated', 'flash'), 2e3)
		}, { once: true, passive: true })
	})
});

}

Application.Helpers.TemplateHelper.getTemplates(['notifications/t_uname_mention'], templates => {
	for (const key in templates)
		Application.Helpers.TemplateHelper.cached_templates[key] = templates[key].replace(/(?<={{track.url}})/, '?c_id={{comment.id}}')
});