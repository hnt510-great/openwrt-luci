'use strict';
'require view';
'require dom';
'require poll';
'require fs';
'require network';
'require ui';

return view.extend({
	handleToggleSection: function(include, container, ev) {
		var btn = ev.currentTarget;

		include.hide = !include.hide;

		btn.setAttribute('data-style', include.hide ? 'active' : 'inactive');
		btn.setAttribute('class', include.hide ? 'label notice' : 'label');
		btn.firstChild.data = include.hide ? _('Show') : _('Hide');
		btn.blur();

		container.style.display = include.hide ? 'none' : 'block';

		if (include.hide) {
			localStorage.setItem(include.id, 'hide');
		} else {
			dom.content(container,
				E('p', {}, E('em', { 'class': 'spinning' },
					[ _('Collecting data...') ])
				)
			);

			localStorage.removeItem(include.id);
		}
	},

	invokeIncludesLoad: function(includes, first_load) {
		var tasks = [], has_load = false;

		for (var i = 0; i < includes.length; i++) {
			if (includes[i].hide && !first_load) {
				tasks.push(null);
				continue;
			}

			if (typeof(includes[i].load) == 'function') {
				tasks.push(includes[i].load().catch(L.bind(function() {
					this.failed = true;
				}, includes[i])));

				has_load = true;
			}
			else {
				tasks.push(null);
			}
		}

		return has_load ? Promise.all(tasks) : Promise.resolve(null);
	},

	/*
	 * Update the children of container to content, replacing only the
	 * top-level nodes whose rendered markup differs. Rebuilding identical
	 * markup on every poll recreates <img> elements, which browsers briefly
	 * paint blank while the new image decodes, so unchanged icons visibly
	 * flicker. Comparing per top-level node keeps e.g. the wireless radio
	 * boxes in place while the station list, whose widgets carry unique
	 * data-idref values, is rebuilt.
	 */
	updateContent: function(container, content) {
		var scratch = E('div'), bin = E('div'), changed = false;

		dom.content(scratch, content);

		var next = Array.prototype.slice.call(scratch.childNodes),
		    prev = Array.prototype.slice.call(container.childNodes);

		if (next.length != prev.length) {
			dom.content(container, next);
			return true;
		}

		for (var i = 0; i < next.length; i++) {
			if (next[i].isEqualNode(prev[i]))
				continue;

			container.replaceChild(next[i], prev[i]);
			bin.appendChild(prev[i]);
			changed = true;
		}

		/* release dom.data registry entries of replaced and discarded nodes */
		dom.content(bin, null);
		dom.content(scratch, null);

		return changed;
	},

	poll_status: function(includes, containers, first_load) {
		return network.flushCache().then(L.bind(
			this.invokeIncludesLoad, this, includes, first_load
		)).then(L.bind(function(results) {
			for (var i = 0; i < includes.length; i++) {
				var content = null;

				if (includes[i].hide && !first_load)
					continue;

				if (includes[i].failed)
					continue;

				if (typeof(includes[i].render) == 'function')
					content = includes[i].render(results ? results[i] : null);
				else if (includes[i].content != null)
					content = includes[i].content;

				if (typeof (includes[i].oneshot) == 'function') {
					includes[i].oneshot(results ? results[i] : null);
					includes[i].oneshot = null;
				}

				if (content != null) {
					containers[i].parentNode.style.display = '';
					containers[i].parentNode.classList.add('fade-in');

					if (!includes[i].hide)
						this.updateContent(containers[i], content);
				}
			}

			var ssi = document.querySelector('div.includes');
			if (ssi) {
				ssi.style.display = '';
				ssi.classList.add('fade-in');
			}
		}, this));
	},

	load: function() {
		return L.resolveDefault(fs.list('/www' + L.resource('view/status/include')), []).then(function(entries) {
			return Promise.all(entries.filter(function(e) {
				return (e.type == 'file' && e.name.match(/\.js$/));
			}).map(function(e) {
				return 'view.status.include.' + e.name.replace(/\.js$/, '');
			}).sort().map(function(n) {
				return L.require(n);
			}));
		});
	},

	render: function(includes) {
		var rv = E([]), containers = [];

		for (var i = 0; i < includes.length; i++) {
			var title = null;

			if (includes[i].title != null)
				title = includes[i].title;
			else
				title = String(includes[i]).replace(/^\[ViewStatusInclude\d+_(.+)Class\]$/,
					function(m, n) { return n.replace(/(^|_)(.)/g,
						function(m, s, c) { return (s ? ' ' : '') + c.toUpperCase() })
					});

			includes[i].id = title;
			includes[i].hide = localStorage.getItem(includes[i].id) == 'hide';

			var container = E('div');

			rv.appendChild(E('div', { 'class': 'cbi-section', 'style': 'display: none' }, [
				E('div', { 'class': 'cbi-title' },[
					E('h3', { 'style': 'display: flex; justify-content: space-between' }, [
						title || '-',
						E('span', {
							'class': includes[i].hide ? 'label notice' : 'label',
							'role': 'button',
							'style': 'display: flex; align-items: center; justify-content: center; min-width: 4em',
							'data-style': includes[i].hide ? 'active' : 'inactive',
							'data-indicator': 'poll-status',
							'data-clickable': 'true',
							'click': ui.createHandlerFn(this, 'handleToggleSection',
										    includes[i], container)
						}, [ _(includes[i].hide ? 'Show' : 'Hide') ])
					]),
				]),
				container
			]));

			containers.push(container);
		}

		return this.poll_status(includes, containers, true).then(L.bind(function() {
			return poll.add(L.bind(this.poll_status, this, includes, containers))
		}, this)).then(function() {
			return rv;
		});
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
