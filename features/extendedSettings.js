{

toolkit.modules.register('extendedSettings', function() {
	if (!location.pathname.startsWith('/account/settings')) return;

	initChangeEmail();
	initRequestTrackData()
});

function initChangeEmail() {
	const emailTitle = document.querySelector('.account-settings-content:has(#email-text) > div:nth-child(2) > div > div.label.show-button-inline');
	if (emailTitle) {
		const displayEmailContainer = document.getElementById('display-email-container');
		const emailText = displayEmailContainer.querySelector('#email-text');
		const emailResponse = toolkit.createElement('div.response.alert-message.success#email_response', {
			style: {
				display: 'none',
				marginTop: '5px'
			}
		});
		const emailInput = toolkit.createElement('input', {
			type: 'email',
			value: emailText.innerText,
			style: {
				marginTop: '6px',
				width: '100%'
			},
			oninput: () => {
				const changed = emailText.innerText.trim() !== emailInput.value.trim();
				saveButton.classList.toggle('disabled', !changed)
			}
		});
		const saveButton = toolkit.createElement('button.profile.new-button.green-button.small-button.show-button-inline.disabled', {
			innerText: 'Save',
			click: e => {
				e.stopPropagation();
				e.stopImmediatePropagation();
				emailForm.style.setProperty('display', 'none');
				editEmail.style.removeProperty('display');
				// displayEmailContainer.style.removeProperty('display');

				const newEmail = emailInput.value.trim();
				if (emailText.innerText.trim() === newEmail) {
					emailResponse.innerText = 'No changes made.';
					emailResponse.style.removeProperty('display');
					displayEmailContainer.style.removeProperty('display');
					return;
				}

				emailResponse.style.setProperty('background-image', 'linear-gradient(hsl(43 81% 65%), hsl(45 57% 49%))');
				emailResponse.innerText = 'Pending password entry...';
				emailResponse.style.removeProperty('display');

				const pwdResponse = toolkit.createElement('div.response.alert-message.error#email_response', {
					style: {
						display: 'none',
						marginTop: '5px',
						textAlign: 'left'
					}
				});
				const pwdInput = toolkit.createElement('input', {
					type: 'password',
					style: {
						marginTop: '6px',
						width: '100%'
					}
				});
				const overlay = document.body.appendChild(toolkit.createElement('dialog.account-settings-page', {
					children: [
						toolkit.createElement('div.account-settings-panel', {
							children: [
								toolkit.createElement('div.account-settings-item', {
									children: [
										toolkit.createElement('div.account-settings-header', {
											children: [
												toolkit.createElement('div.title', {
													children: [
														toolkit.createElement('div.span', {
															innerText: 'Confirm & Verify Account Ownership'
														})
													]
												})
											]
										}),
										toolkit.createElement('div.account-settings-content', {
											children: [
												toolkit.createElement('div.list-item', {
													children: [
														toolkit.createElement('div.label', { innerText: 'Old Email' }),
														toolkit.createElement('div.display-text.text', {
															children: [
																toolkit.createElement('p', { innerText: emailText.innerText.trim() })
															]
														})
													]
												}),
												toolkit.createElement('div.list-item', {
													children: [
														toolkit.createElement('div.label', { innerText: 'New Email' }),
														toolkit.createElement('div.display-text.text', {
															children: [
																toolkit.createElement('p', { innerText: emailInput.value.trim() })
															]
														})
													]
												}),
												toolkit.createElement('div.list-item', {
													children: [
														toolkit.createElement('div.label', { innerText: 'Password' }),
														pwdResponse,
														pwdInput,
														toolkit.createElement('button.cancel-button.new-button.blue-button.small-button', {
															innerText: 'Cancel',
															click: () => overlay.close('cancel')
														}),
														toolkit.createElement('button.profile.new-button.green-button.small-button.show-button-inline', {
															innerText: 'Save',
															click: async e => {
																e.stopPropagation();
																e.stopImmediatePropagation();
																pwdResponse.style.setProperty('display', 'none');

																const r = await toolkit.externalApi('user/email', {
																	email: newEmail,
																	password: pwdInput.value
																}, 'PATCH');
																if (r.status !== 200) {
																	pwdResponse.innerText = r.error.message || 'Incorrect password';
																	pwdResponse.style.removeProperty('display');
																	return;
																}

																emailText.innerText = newEmail;
																emailResponse.innerText = r.message;
																emailResponse.classList.replace('error', 'success');
																emailResponse.style.removeProperty('display');
																overlay.close('success')
															}
														})
													],
													style: { textAlign: 'center' }
												})
											]
										})
									]
								})
							]
						})
					],
					style: {
						background: 'none',
						border: 'none',
						// padding: 0
					},
					click(event) {
						const rect = this.getBoundingClientRect()
							, isInDialog = (rect.top <= event.clientY && event.clientY <= rect.top + rect.height &&
								rect.left <= event.clientX && event.clientX <= rect.left + rect.width);
						!isInDialog && this.close('cancel')
					},
					close() {
						e.stopPropagation();
						e.stopImmediatePropagation();
						this.returnValue !== 'success' && emailResponse.style.setProperty('display', 'none');
						emailForm.style.setProperty('display', 'none');
						editEmail.style.removeProperty('display');
						displayEmailContainer.style.removeProperty('display');
						this.remove()
					}
				}));
				overlay.showModal()
			}
		});
		const emailForm = toolkit.createElement('div.edit-form-container.email-form', {
			children: [
				emailInput,
				toolkit.createElement('button.cancel-button.new-button.blue-button.small-button', {
					innerText: 'Cancel',
					click: e => {
						e.stopPropagation();
						e.stopImmediatePropagation();
						emailForm.style.setProperty('display', 'none');
						editEmail.style.removeProperty('display');
						displayEmailContainer.style.removeProperty('display')
					}
				}),
				saveButton
			],
			style: {
				display: 'none',
				textAlign: 'center'
			}
		});
		const editEmail = toolkit.createElement('button.toggle-edit-button.edit-button.new-button.blue-button.small-button', {
			innerText: 'Edit',
			style: { marginLeft: '21px' }
		});
		editEmail.addEventListener('click', e => {
			e.stopPropagation();
			e.stopImmediatePropagation();
			emailResponse.style.setProperty('display', 'none');
			editEmail.style.setProperty('display', 'none');
			displayEmailContainer.style.setProperty('display', 'none');
			emailForm.style.setProperty('display', 'block')
		}, { passive: true });
		emailTitle.parentElement.append(emailForm);
		emailTitle.after(editEmail, emailResponse);
	} else {
		console.warn("Request track data failed to load! Personal data is not present.")
	}
}

function initRequestTrackData() {
	const parentElement = document.querySelector('#delete-all-personal-data')?.parentElement || document.querySelector('.account-settings-header');
	if (parentElement) {
		let requestTrackData = parentElement.appendChild(toolkit.createElement('button.blue-button.settings-header.new-button', {
			innerText: 'Request All Data',
			style: {
				float: 'right',
				fontSize: '13px',
				height: 'auto',
				lineHeight: '23px',
				marginTop: '6px',
				marginRight: '14px',
				padding: '0 1rem'
			}
		}));
		requestTrackData.addEventListener('click', () => downloadAllTracks(), { passive: true });
	} else {
		console.warn("Request track data failed to load! Personal data is not present.")
	}
}

function downloadAllTracks(username) {
	return fetch(`/u/${Application.settings.user.u_name}/created?ajax`).then(r => r.json()).then(async ({ created_tracks }) => {
		const zip = new Zip()
			, tracks = await Promise.all(created_tracks.tracks.map(track => fetch('/track_api/load_track?id=' + track.id + '&fields[]=code&fields[]=id&fields[]=title').then(r => r.json())))
			.then(tracks => tracks.filter(({ result }) => result).map(({ data }) => data.track));
		for (let track of tracks)
			zip.newFile(track.title + '-' + track.id + '.txt', track.code);
		toolkit.downloadFile('created-tracks', await zip.blob(), { desc: 'Created' })
	})
}

}