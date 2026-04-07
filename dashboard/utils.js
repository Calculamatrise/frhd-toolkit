export function m(t, e) {
	for (var i in e)
		try {
			t[i] = e[i].constructor == Object ? m(t[i], e[i]) : e[i]
		} catch (s) {
			t[i] = e[i]
		}
	return t
}

export function createElement(type, options = {}) {
	const callback = arguments[arguments.length - 1];
	const element = document.createElement(type.replace(/[\.#].+/g, ''));
	const matchId = type.match(/(?<=#)([^\.]+((?<=\\)\.)?)+/);
	null !== matchId && (element.setAttribute('id', matchId[0].replace(/\\/g, '')),
	type = type.replace('#' + matchId[0], ''));
	const classList = type.match(/(?<=\.)([^\.#]+((?<=\\)\.)?)+/g);
	null !== classList && element.classList.add(...classList.map(name => name.replace(/\\/g, '')));
	if ('innerText' in options) {
		element.innerText = options.innerText,
		delete options.innerText;
	}

	for (const attribute in options) {
		if (typeof options[attribute] == 'object') {
			if (options[attribute] instanceof Array) {
				if (/^children$/i.test(attribute)) {
					element.append(...options[attribute]);
				} else if (/^classlist$/i.test(attribute))
					element.classList.add(...options[attribute]);
			} else if (/^(data|dataset|style)$/i.test(attribute)) {
				Object.assign(element[attribute == 'data' ? 'dataset' : attribute.toLowerCase()], options[attribute]);
			} else continue;
		} else if (typeof options[attribute] == 'function') {
			if (/^mutation$/i.test(attribute)) {
				typeof options['MutationObserverOptions'] == 'object' && (new MutationObserver(options[attribute]).observe(element, options['MutationObserverOptions']),
				delete options['MutationObserverOptions']);
			} else if (element['on' + attribute] !== undefined)
				element.addEventListener(attribute, options[attribute], { passive: !/\.preventDefault\(\)/g.test(options[attribute].toString()) });
			else continue;
		} else continue;
		delete options[attribute]
	}

	Object.assign(element, options);
	typeof callback == 'function' && callback(element);
	return element
}

export function modifyAll(selector, callback) {
	for (const e of document.querySelectorAll(selector, callback)) callback(e)
}