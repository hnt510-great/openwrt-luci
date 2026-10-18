'use strict';
'require baseclass';
'require fs';
'require rpc';
'require uci';

var callGetUnixtime = rpc.declare({
	object: 'luci',
	method: 'getUnixtime',
	expect: { result: 0 }
});

var callLuciVersion = rpc.declare({
	object: 'luci',
	method: 'getVersion'
});

var callSystemBoard = rpc.declare({
	object: 'system',
	method: 'board'
});

var callSystemInfo = rpc.declare({
	object: 'system',
	method: 'info'
});

var cpuHwmonDrivers = [
	'coretemp', 'k10temp', 'zenpower', 'cpu_thermal', 'soc_thermal'
];

function readSysfs(path) {
	return fs.read(path).then(function(str) {
		return (str || '').trim();
	}).catch(function() {
		return null;
	});
}

function listSysfs(path) {
	return fs.list(path).then(function(entries) {
		return (entries || []).map(function(entry) {
			return entry.name;
		});
	}).catch(function() {
		return [];
	});
}

function readHwmonCpuTemperature() {
	return listSysfs('/sys/class/hwmon').then(function(entries) {
		var hwmons = entries.filter(function(name) {
			return /^hwmon\d+$/.test(name);
		});

		return Promise.all(hwmons.map(function(name) {
			var dir = '/sys/class/hwmon/%s'.format(name);

			return readSysfs('%s/name'.format(dir)).then(function(driver) {
				if (cpuHwmonDrivers.indexOf(driver) < 0)
					return null;

				return readSysfs('%s/temp1_input'.format(dir)).then(function(value) {
					var temp = parseFloat(value);

					return isNaN(temp) ? null : temp / 1000;
				});
			});
		}));
	}).then(function(temps) {
		for (var i = 0; i < temps.length; i++)
			if (temps[i] != null)
				return temps[i];

		return null;
	});
}

function readThermalZoneTemperature() {
	return listSysfs('/sys/class/thermal').then(function(entries) {
		var zones = entries.filter(function(name) {
			return /^thermal_zone\d+$/.test(name);
		});

		return Promise.all(zones.map(function(name) {
			var dir = '/sys/class/thermal/%s'.format(name);

			return Promise.all([
				readSysfs('%s/type'.format(dir)),
				readSysfs('%s/temp'.format(dir))
			]).then(function(data) {
				var temp = parseFloat(data[1]);

				if (!data[0] || isNaN(temp))
					return null;

				return { type: data[0], temp: temp / 1000 };
			});
		}));
	}).then(function(zones) {
		var valid = zones.filter(function(zone) {
			return zone != null;
		});

		for (var i = 0; i < valid.length; i++)
			if (/(pkg|cpu|soc|core)/i.test(valid[i].type))
				return valid[i].temp;

		return valid.length ? valid[0].temp : null;
	});
}

function readCpuTemperature() {
	return readHwmonCpuTemperature().then(function(temp) {
		return (temp != null) ? temp : readThermalZoneTemperature();
	}).catch(function() {
		return null;
	});
}

function parseCpuList(str) {
	var cpus = [];

	(str || '').split(',').forEach(function(range) {
		var m = range.trim().match(/^(\d+)(?:-(\d+))?$/);

		if (!m)
			return;

		var from = +m[1],
		    to = m[2] ? +m[2] : from;

		for (var i = from; i <= to && cpus.length < 1024; i++)
			cpus.push(i);
	});

	return cpus;
}

function readProcCpuFrequency() {
	return readSysfs('/proc/cpuinfo').then(function(content) {
		if (!content)
			return null;

		var freqs = [];

		content.split('\n').forEach(function(line) {
			var m = line.match(/^cpu MHz\s*:\s*([\d.]+)/);

			if (m)
				freqs.push(parseFloat(m[1]));
		});

		if (!freqs.length)
			return null;

		return freqs.reduce(function(a, b) { return a + b; }, 0) / freqs.length * 1000;
	});
}

function readCpuFrequency() {
	/*
	 * The status page refreshes all includes at once, and the burst of RPC
	 * calls briefly drives every core to its boost clock. Sampling right
	 * away would report the dashboard's own load, so give the poll burst a
	 * moment to settle before reading the current frequency.
	 */
	return new Promise(function(resolve) {
		setTimeout(resolve, 800);
	}).then(function() {
		return readSysfs('/sys/devices/system/cpu/online');
	}).then(function(online) {
		var cpus = parseCpuList(online);

		return Promise.all(cpus.map(function(cpu) {
			return readSysfs('/sys/devices/system/cpu/cpu%d/cpufreq/scaling_cur_freq'.format(cpu));
		}));
	}).then(function(freqs) {
		var values = (freqs || []).map(parseFloat).filter(function(freq) {
			return !isNaN(freq) && freq > 0;
		});

		if (!values.length)
			return readProcCpuFrequency();

		return values.reduce(function(a, b) { return a + b; }, 0) / values.length;
	}).catch(function() {
		return null;
	});
}

function formatFrequency(khz) {
	return (khz >= 1000000)
		? '%.2f GHz'.format(khz / 1000000)
		: '%.0f MHz'.format(khz / 1000);
}

return baseclass.extend({
	title: _('System'),

	load: function() {
		return Promise.all([
			L.resolveDefault(callSystemBoard(), {}),
			L.resolveDefault(callSystemInfo(), {}),
			L.resolveDefault(callLuciVersion(), { revision: _('unknown version'), branch: 'LuCI' }),
			L.resolveDefault(callGetUnixtime(), 0),
			uci.load('system'),
			readCpuTemperature(),
			readCpuFrequency()
		]);
	},

	render: function(data) {
		var boardinfo   = data[0],
		    systeminfo  = data[1],
		    luciversion = data[2],
		    unixtime    = data[3],
		    cputemp     = data[5],
		    cpufreq     = data[6];

		luciversion = luciversion.branch + ' ' + luciversion.revision;

		var datestr = null;

		if (unixtime) {
			var date = new Date(unixtime * 1000),
				zn = uci.get('system', '@system[0]', 'zonename')?.replaceAll(' ', '_') || 'UTC',
				ts = uci.get('system', '@system[0]', 'clock_timestyle') || 0,
				hc = uci.get('system', '@system[0]', 'clock_hourcycle') || 0;

			datestr = new Intl.DateTimeFormat(undefined, {
				dateStyle: 'medium',
				timeStyle: (ts == 0) ? 'long' : 'full',
				hourCycle: (hc == 0) ? undefined : hc,
				timeZone: zn
			}).format(date);
		}

		var fields = [
			_('Hostname'),         boardinfo.hostname,
			_('Model'),            boardinfo.model,
			_('Architecture'),     boardinfo.system,
			_('Target Platform'),  (L.isObject(boardinfo.release) ? boardinfo.release.target : ''),
			_('Firmware Version'), (L.isObject(boardinfo.release) ? boardinfo.release.description + ' / ' : '') + (luciversion || ''),
			_('Kernel Version'),   boardinfo.kernel,
			_('Local Time'),       datestr,
			_('Uptime'),           systeminfo.uptime ? '%t'.format(systeminfo.uptime) : null,
			_('Load Average'),     Array.isArray(systeminfo.load) ? '%.2f, %.2f, %.2f'.format(
				systeminfo.load[0] / 65535.0,
				systeminfo.load[1] / 65535.0,
				systeminfo.load[2] / 65535.0
			) : null
		];

		if (cputemp != null)
			fields.push(_('CPU Temperature'), '%.1f °C'.format(cputemp));

		if (cpufreq != null)
			fields.push(_('CPU Frequency'), formatFrequency(cpufreq));

		var table = E('table', { 'class': 'table' });

		for (var i = 0; i < fields.length; i += 2) {
			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '33%' }, [ fields[i] ]),
				E('td', { 'class': 'td left' }, [ (fields[i + 1] != null) ? fields[i + 1] : '?' ])
			]));
		}

		return table;
	}
});
