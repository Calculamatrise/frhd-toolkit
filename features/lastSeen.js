{

let currentUserRegex = null;
toolkit.modules.register('lastSeen', async function() {
	if (!location.pathname.startsWith('/u/')) return;
	if (!currentUserRegex) {
		currentUserRegex = new RegExp(`^/u/${Application.settings.user.u_name}\\b`);
	}

	if (location.pathname.match(currentUserRegex)) return;

	const { friends, is_profile_owner } = await fetch(location.pathname + '?ajax').then(r => r.json());
	if (is_profile_owner || (friends.friend_cnt ?? friends.friends_data.length) == 0) return;
	document.querySelectorAll('.friend-list-item-name:not(:has(+ div.friend-list-item-date))').forEach(item => {
		item.after(toolkit.createElement('div.friend-list-item-date', {
			innerText: "Last seen: " + friends.friends_data.find(({ d_name }) => d_name == item.innerText).activity_time_ago
		}))
	});

	if (!toolkit.config.get('lastSeenProfile')) return;

	const { u_name: first } = friends.friends_data[0];
	const activityTimeAgo = await fetch(`/u/${first}/friends?ajax`)
		.then(r => r.json())
		.then(({ friends }) => {
			if ((friends.friend_cnt ?? friends.friends_data.length) == 0) return;
			const { activity_time_ago } = friends.friends_data.find(({ u_name }) => u_name === Application.router.current_view.username);
			return activity_time_ago
		});

	const span = document.querySelector("div.profile-username.flex-item ~ span:not(.last-seen)");
	span.classList.add('last-seen');
	span.textContent = activityTimeAgo;
	span.style.setProperty('font-size', 'smaller');
	span.style.setProperty('padding', '0 1em');
	const key = document.createElement('span');
	key.textContent = 'Last seen:';
	key.style.setProperty('color', 'gray');
	key.style.setProperty('margin-right', '.25em');
	key.style.setProperty('user-select', 'none');
	span.prepend(key)
})

}