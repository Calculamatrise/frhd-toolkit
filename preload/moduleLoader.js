if (!self.ModuleLoader) {
	class ModuleLoader {
		#ctx = null;
		#initialized = false;
		#initialLoad = false;
		#subscribed = false;

		constructor(context, cancelInit) {
			this.#ctx = context;

			Object.defineProperty(this, 'cache', {
				configurable: false,
				enumerable: false,
				value: new Map(),
				writable: false
			});

			if (!cancelInit) {
				this.init()
			}
		}

		#addTrigger() {
			if (!this.#subscribed) {
				Application.events.subscribe('mainview.loaded', this.trigger.bind(this));
				this.#subscribed = true;
			}

			if (!this.#initialLoad && Application.router?.current_view.initial_page_load) {
				this.trigger();
				this.#initialLoad = true
			}
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

		init() {
			if (this.#initialized) {
				console.warn(`ModuleLoader already initialized`);
				return;
			}

			if (window.Application?.router?.current_view.initial_page_load) {
				this.#addTrigger();
			} else {
				document.addEventListener('DOMContentLoaded', () => {
					if (window.Application) {
						this.#addTrigger();
					} else {
						console.warn('Application not loaded!');
					}
				}, { once: true, passive: true });
			}

			this.#initialized = true
		}

		register(name, fn) {
			if (this.cache.has(name)) {
				console.warn(`Module ${name} already registered`);
				return;
			}

			this.cache.set(name, fn);
			if (this.#initialLoad) {
				this.#fire(name, fn)
			}
		}

		trigger() {
			this.#initialLoad = true;

			const ctx = this.#getContext();
			for (const [name, fn] of this.cache)
				this.#fire(name, fn, ctx)
		}
	}

	Object.defineProperty(self, 'ModuleLoader', { value: ModuleLoader });
}