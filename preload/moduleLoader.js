if (!self.ModuleLoader) {
	const domReady = new Promise(r => document.addEventListener("DOMContentLoaded", r, { once: true }));
	class ModuleLoader {
		#ctx = null;
		#initialized = false;
		#initialization = null;
		#initialLoad = false;
		constructor(context, cancelInit) {
			this.#ctx = context;
			Object.defineProperty(this, 'cache', {
				configurable: false,
				enumerable: false,
				value: new Map(),
				writable: false
			});
			!cancelInit && this.init()
		}

		// Replace #initialLoad with #loaded since state can change on navigate/route
		// Track loaded state with "router.back"/"router.navigate" events on Application.events
		// get #loaded() {
		// 	return window.Application?.router?.current_view.initial_page_load
		// }

		async init() {
			if (this.#initialized) {
				console.warn(`ModuleLoader already initialized`);
				return;
			}

			if (this.#initialization)
				return this.#initialization;

			this.#initialization = this.#init();

			try {
				await this.#initialization;
				this.#initialized = true;
				this.#trigger();
			} finally {
				this.#initialization = null;
			}
		}

		register(name, fn) {
			if (this.cache.has(name)) {
				console.warn(`Module ${name} already registered`);
				return;
			}

			this.cache.set(name, fn);
			if (this.#initialLoad)
				this.#fire(name, fn)
		}

		async #init() {
			await domReady;
			if (typeof Application == "undefined")
				throw new ReferenceError("Application not found on window");

			if (!Application.router?.current_view.initial_page_load) {
				await new Promise(resolve => {
					let listener;
					Application.events.subscribe("mainview.loaded", listener = () => {
						Application.events.unsubscribe("mainview.loaded", listener);
						resolve();
					});
				});
			}

			this.#initialLoad = true;
			Application.events.subscribe("mainview.loaded", this.#trigger);
		}

		#trigger = () => {
			const ctx = this.#getContext();
			for (const [name, fn] of this.cache)
				this.#fire(name, fn, ctx)
		}

		#fire(name, fn, ctx = this.#getContext()) {
			try {
				fn(ctx);
			} catch (e) {
				console.error(name, e)
			}
		}

		#getContext() {
			const ctx = {
				app: window.Application,
				pathname: location.pathname,
				url: location.href
			};

			if (this.#ctx) ctx.loader = this.#ctx;
			if (Application.settings?.user) ctx.user = Application.settings.user;

			return Object.freeze(ctx)
		}
	}

	Object.defineProperty(self, 'ModuleLoader', { value: ModuleLoader });
}