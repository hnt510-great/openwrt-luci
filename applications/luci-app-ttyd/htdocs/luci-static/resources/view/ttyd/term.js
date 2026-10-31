'use strict';
'require view';
'require uci';

return view.extend({
	load: function() {
		return uci.load('ttyd');
	},
	render: function() {
		var port = uci.get_first('ttyd', 'ttyd', 'port') || '7681',
			ssl = uci.get_first('ttyd', 'ttyd', 'ssl') || '0',
			url = uci.get_first('ttyd', 'ttyd', 'url_override');
		if (port === '0')
			return E('div', { class: 'alert-message warning' },
					_('Random ttyd port (port=0) is not supported.<br />Change to a fixed port and try again.'));

		var host = window.location.hostname;
		if (host.indexOf(':') !== -1)
			host = '[' + host + ']';

		var src = url || ((ssl === '1' ? 'https' : 'http') + '://' + host + ':' + port),
			nodes = [];

		/* An http:// frame inside an https:// page is blocked as mixed content. */
		if (window.location.protocol === 'https:' && /^http:/i.test(src))
			nodes.push(E('div', { class: 'alert-message warning' },
				_('LuCI is served over HTTPS but ttyd is not. Enable SSL in the ttyd configuration, or open the terminal in a new tab.')));

		nodes.push(E('iframe', {
			src: src,
			style: 'flex: 1; width: 100%; min-height: 500px; border: none; border-radius: 3px; resize: vertical;'
		}));

		nodes.push(E('p', {}, E('a', { href: src, target: '_blank', rel: 'noopener' },
			_('Open the terminal in a new tab (also accepts its certificate if the frame stays blank)'))));

		return E('div', { style: 'display: flex; flex-direction: column; height: 100%;' }, nodes);
	},
	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
