chrome.runtime.onMessageExternal.addListener(function(message, sender, sendResponse) {
	if (typeof message != 'object' || message == null) {
		if (typeof message != 'string') {
			return sendResponse({
				error: {
					code: 'Invalid format',
					message: 'Message must be of type: object'
				},
				status: 400
			});
		}

		message = { action: message };
	}

	if (typeof message.action != 'string') {
		return sendResponse({
			error: {
				code: 'Missing property',
				message: '[Message.action] must be of type: string'
			},
			status: 400
		});
	}

	// Add option to add/manage context menu items
	switch (message.action.toUpperCase()) {
	case 'CREATE_CONTEXT_MENU_OPTION':
		break;
	case 'HELP':
		return sendResponse({
			message: "Actions:\nCREATE_CONTEXT_MENU_OPTION\n",
			status: 200
		});
	case 'VERSION':
		const manifest = chrome.runtime.getManifest();
		return sendResponse({ version: manifest.version });
	default:
		return sendResponse("418 I'm a teapot")
	}
});