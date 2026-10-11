'use strict';
'require view';
'require form';
'require fs';
'require ui';

return view.extend({
	load: function() {
		return fs.exec('/usr/libexec/luci-openssh', [ 'read' ]).then(function(result) {
			if (result.code !== 0)
				throw new Error(result.stderr || _('Unable to read SSH configuration.'));

			var settings = {};
			(result.stdout || '').split(/\n/).forEach(function(line) {
				var match = line.match(/^(\S+)\s+(.+)$/);
				if (match && settings[match[1].toLowerCase()] == null)
					settings[match[1].toLowerCase()] = match[2];
			});
			return settings;
		});
	},

	render: function(settings) {
		var m = new form.JSONMap({ sshd: {
			Port: settings.port || '22',
			PasswordAuthentication: settings.passwordauthentication || 'yes',
			PubkeyAuthentication: settings.pubkeyauthentication || 'yes',
			PermitRootLogin: settings.permitrootlogin || 'prohibit-password',
			GatewayPorts: settings.gatewayports || 'no'
		} }, _('SSH Access'), _('OpenSSH offers SSH access and SFTP file transfers.'));
		m.readonly = !L.hasViewPermission();

		var s = m.section(form.NamedSection, 'sshd', 'sshd', _('OpenSSH Server'));
		var o = s.option(form.Value, 'Port', _('Port'));
		o.datatype = 'port';
		o.rmempty = false;

		o = s.option(form.Flag, 'PasswordAuthentication', _('Password authentication'), _('Allow <abbr title="Secure Shell">SSH</abbr> password authentication'));
		o.enabled = 'yes';
		o.disabled = 'no';
		o.rmempty = false;

		o = s.option(form.Flag, 'PubkeyAuthentication', _('Public key authentication'));
		o.enabled = 'yes';
		o.disabled = 'no';
		o.rmempty = false;

		o = s.option(form.ListValue, 'PermitRootLogin', _('Root login'));
		o.value('yes', _('Password or public key'));
		o.value('prohibit-password', _('Public key only'));
		o.rmempty = false;

		o = s.option(form.ListValue, 'GatewayPorts', _('Gateway Ports'), _('Allow remote hosts to connect to local SSH forwarded ports'));
		o.value('no', _('Disabled'));
		o.value('yes', _('Enabled'));
		o.value('clientspecified', _('Specified by the SSH client'));
		o.rmempty = false;

		this.map = m;
		return m.render();
	},

	handleSaveApply: function() {
		var m = this.map;
		return m.save(function() {
			var settings = m.data.get('json', 'sshd');
			return fs.exec('/usr/libexec/luci-openssh', [ 'save', settings.Port,
				settings.PasswordAuthentication, settings.PubkeyAuthentication,
				settings.PermitRootLogin, settings.GatewayPorts ]).then(function(result) {
				if (result.code !== 0)
					throw new Error(result.stderr || _('Unable to save SSH configuration.'));
				ui.addNotification(null, E('p', _('SSH settings have been saved and applied.')), 'info');
			});
		});
	},

	handleSave: null,
	handleReset: null
});
