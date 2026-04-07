import "../../utils/Storage.js";
import AjaxHelper from "../../utils/AjaxHelper.js";
import { createElement, m } from "./utils.js";

const user = await AjaxHelper.get('/account/settings');
m(user, await AjaxHelper.get(`/u/${user.user.u_name}`));
Object.defineProperty(window, 'user', { value: user });

const username = document.querySelector('.username');
username.textContent = user.user.d_name;

const email = document.querySelector('.email');
const [emailId, emailProvider] = user.user.email.split('@');
email.textContent = emailId;
const provider = email.appendChild(document.createElement('span'));
provider.classList.add('provider');
provider.textContent = '@' + emailProvider;

const avatar = document.querySelector('.avatar');
avatar.src = user.user.img_url_medium;

// Overview
const usernameInput = document.querySelector('[data-id=username]');
usernameInput.value = user.user.d_name;

// Friends
if ((user.friends.friend_cnt ?? user.friends.friends_data.length) > 0) {
	const friendContainer = document.querySelector('div.details:has(> #friends)');
	for (const friend of user.friends.friends_data) {
		const userCard = createElement('div.user-card', {
			children: [
				createElement('img.avatar', { src: friend.img_url_small }),
				createElement('div.metadata', {
					children: [
						createElement('span.username', {
							textContent: friend.d_name
						}),
						createElement('span.last-seen', {
							textContent: friend.activity_time_ago,
							title: new Date(friend.a_ts * 1e3)
						})
					]
				}),
				createElement('div.action-row', {
					children: [
						createElement('button', {
							textContent: 'Message'
						}),
						createElement('button.danger', {
							textContent: 'Remove'
						})
					]
				})
			],
			data: { id: friend.u_id }
		});
		friendContainer.appendChild(userCard);
	}
}

// Recent races
if (user.recently_ghosted_tracks.tracks.length > 0) {
	const createdTracksContainer = document.querySelector('div.details:has(> #races)');
	for (const track of user.recently_ghosted_tracks.tracks) {
		console.log(track)
		const trackCard = createElement('div.track-card', {
			children: [
				createElement('div.thumbnail-wrapper', {
					children: [
						createElement('img.thumbnail', {
							src: track.thmb,
							title: track.title
						}),
						createElement('img.avatar.author', {
							src: track.img_url_small,
							title: track.author
						})
					]
				}),
				createElement('div.metadata', {
					children: [
						createElement('a.title', {
							href: `http://frhd.co/t/${track.slug}`,
							textContent: track.title
						}),
						createElement('span.best-time', {
							textContent: track.best_time
						})
					]
				}),
				createElement('div.action-row', {
					children: [
						createElement('button.danger', {
							textContent: 'Delete'
						})
					]
				})
			],
			data: { id: parseInt(track.slug) }
		});
		createdTracksContainer.appendChild(trackCard);
	}
}

// Created tracks
if (user.created_tracks.tracks.length > 0) {
	const createdTracksContainer = document.querySelector('div.details:has(> #tracks)');
	for (const track of user.created_tracks.tracks) {
		console.log(track)
		const trackCard = createElement('div.track-card', {
			children: [
				createElement('img.thumbnail', {
					src: track.thmb,
					title: track.title
				}),
				createElement('div.metadata', {
					children: [
						createElement('a.title', {
							href: `http://frhd.co/t/${track.slug}`,
							textContent: track.title
						}),
						createElement('span.rating', {
							innerHTML: `<b>${track.vote_percent}%</b> on <b>${track.votes}</b> votes`
						})
					]
				}),
				createElement('div.action-row', {
					children: [
						createElement('button.danger', {
							textContent: 'Delete'
						})
					]
				})
			],
			data: { id: parseInt(track.slug) }
		});
		createdTracksContainer.appendChild(trackCard);
	}
}