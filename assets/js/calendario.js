/**
* [jquery.calendario.js] (v5.0.0) #Copyright 2015, Boží Ďábel#
*/

+function ($) {
	'use strict';
	
	var Calendario = function (element, options) {
		this.init('calendario', element, options)
	}
	
	Calendario.DEFAULTS = {
		weekabbrs : ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
		months : ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
		months2 : ['Января', 'Февраля', 'Марта', 'Апреля', 'Мая', 'Июня', 'Июля', 'Августа', 'Сентября', 'Октября', 'Ноября', 'Декабря'],
		startIn : 1,
		fillEmpty: true,
		events : ['click', 'focus'],
		chance: {},
		format: 'MM-DD-YYYY-HR-MN'
	}
	
	Calendario.prototype.init = function (type, element, options) {
		this.type      = type
		this.$element  = $(element)
		this.options   = $.extend({}, Calendario.DEFAULTS, this.$element.data(), options)
		this.today     = new Date()
		this.month     = (isNaN(this.options.month) || this.options.month === null) ? this.today.getMonth() : this.options.month - 1
		this.year      = (isNaN(this.options.year) || this.options.year === null) ? this.today.getFullYear() : this.options.year
		this.caldata   = this.processCaldata(this.options.caldata)
		this.curData   = []
		this.syncData  = {}
		this.generateTemplate()
		this.initEvents()
	}
	
	Calendario.prototype.initEvents = function () {
		this.$element.on(
			this.options.events.join('.calendario ').trim() + '.calendario',
			'div.fc-row > div:not(:empty)',
			function(e) {
				$(this).trigger(
					$.Event('onDay' + e.type.charAt(0).toUpperCase() + e.type.slice(1)),
					[$(this).data('bz.calendario.dateprop')]
				)
		})
	}
	
	Calendario.prototype.propDate = function () {
		var self = this, month, year, day, hc, hour, minute, day_id, evn
		this.$element.find('div.fc-row > div').filter(':not(:empty)').each(function() {
			hc = $(this).children('span.fc-date').hasClass('fc-emptydate')
			day = $(this).children('span.fc-date').text()
			month = (hc && day <= 31 && day >= 24 ? self.month - 1 : (hc && day >= 1 && day <= 7 ? self.month + 1 : self.month))
			year = (month == 12 ? self.year + 1 : (month == -1 ? self.year - 1 : self.year))
			month = (month == 12 ? 0 : (month == -1 ? 11 : month))
			day_id = parseInt( (month+1).toString() + day.toString() )
			evn = self.curData[day_id] ? true : false
			hour = evn ? self.curData[day_id].t_hour : ''
			minute = evn ? self.curData[day_id].t_min : ''
			var dateProp = {
				'day' : day,
				'month' : month + 1,
				'year' : year,
				'hour' : hour,
				'minute' : minute,
				'monthname' : self.options.months2[month],
				'chance' : ( self.options.chance[year] !== undefined ? self.options.chance[year][month][day-1] : 0 ),
				'data' : evn ? self.curData[day_id] : false
			}
			$(this).data('bz.calendario.dateprop', dateProp)
		})
	}
	
	Calendario.prototype.insertToCaldata = function(key, c, date, data, f) {
		if(!data[key]) data[key] = []
		c.day = date[f.DD]
		c.month = date[f.MM]
		c.year = date[f.YYYY]
		c.hour = date[f.HR]
		c.minute = date[f.MN]
		c.category = c.category ? 'calendar-' + c.category.split('-').pop() : 'calendar-default'
		data[key].push(c)
		return data
	}
	
	Calendario.prototype.processCaldata = function (obj) {
		var data = {}, self = this
		var format = {}
		$.each(this.options.format.toUpperCase().split('-'), function(key, val) {
			format[val] = key
		})
		$.each(obj, function(key, val) {
			$.each(val, function(i, c) {
				data = self.insertToCaldata(
					parseInt(key.split('-')[format.DD]),
					c,
					key.split('-'),
					data,
					format
				)
			})
		})
		return data
	}
	
	Calendario.prototype.parseDay = function(c, day) {
		this.curData[day] = {html: '', text: '', pic: ''}
		if ( c.text ) this.curData[day].text = c.text 
		if ( c.pic ) this.curData[day].pic = c.pic
		this.curData[day].t_hour = c.hour
		this.curData[day].t_min = c.minute
		this.curData[day].html += '<span class="' + c.category + '"><img class="stream-pic" src="' + c.pic + '" />' + c.text + '</span>'
		this.isProperlyParsed = true
	}

	Calendario.prototype.parseDataToDay = function(data, day, dbobj) {
		var self = $.extend({}, this, dbobj)
		self.isProperlyParsed = false
		$.each(data, function(i, c) {
			if(!c) {
				/*ignore*/
			} else if(self.year == c.year && (self.month + 1) == c.month) {
				self.parseDay(c, day)
			}
		})
		
		if(this.curData[day] && self.isProperlyParsed) {
			return '<div class="fc-calendar-event">' + this.curData[day].html + '</div>'
			//return '<div class="fc-calendar-event">' + this.curData[day].html.join('</div><div class="fc-calendar-event">') + '</div>'
		} else {
			return ''
		}
	}

	Calendario.prototype.generateTemplate = function(callback) {
		this.curData = []
		var head     = this.getHead()
		var body     = this.getBody()
		var rowClass = ''
		
		if(this.rowTotal == 4) {
			rowClass = 'fc-four-rows'
		} else if(this.rowTotal == 5) {
			rowClass = 'fc-five-rows'
		} else if(this.rowTotal == 6) {
			rowClass = 'fc-six-rows'
		}
		this.$cal = $('<div class="fc-calendar ' + rowClass + '">').append(head, body)
		this.$element.find('div.fc-calendar').remove().end().append(this.$cal)
		this.propDate()
		this.$element.trigger($.Event('shown.calendar.calendario'))
		if(callback) callback.call()
		return true
	}

	Calendario.prototype.getHead = function () {
		var html = '<div class="fc-head">', pos, j
		for(var i = 0; i <= 6; i++) {
			pos = i + this.options.startIn
			j = pos > 6 ? pos - 6 - 1 : pos
			html += '<div>' + this.options.weekabbrs[j] + '</div>'
		}
		return html + '</div>'
	}

	Calendario.prototype.getBody = function() {
		var d            = new Date(this.year, this.month + 1, 0)
		var monthLength  = d.getDate()
		var firstDay     = new Date(this.year, d.getMonth(), 1)
		var pMonthLength = new Date(this.year, this.month, 0).getDate()
		var html         = '<div class="fc-body"><div class="fc-row">'
		var day          = 1
		var month        = 1
		var year         = 1
		var empDay       = 1
		var startingDay  = firstDay.getDay()
		var pos          = 0
		var p            = 0
		var inner        = ''
		var today        = false
		var past         = false
		var content      = ''
		var idx          = 0
		var data         = ''
		var dbobj        = {}
		var cellClasses  = ''
		var curr_chance = 0
		var day_id = 0

		for (var i = 0; i < 7; i++) {
		for (var j = 0; j <= 6; j++) {
			pos     = startingDay - this.options.startIn
			p       = pos < 0 ? 6 + pos + 1 : pos
			inner   = ''
			today   = this.month === this.today.getMonth() && this.year === this.today.getFullYear() && day === this.today.getDate()
			past    = this.year < this.today.getFullYear() || this.month < this.today.getMonth() && this.year === this.today.getFullYear() ||
					this.month === this.today.getMonth() && this.year === this.today.getFullYear() && day < this.today.getDate()
			content = ''
			idx     = j + this.options.startIn > 6 ? j + this.options.startIn - 6 - 1 : j + this.options.startIn
			dbobj   = {}

			if(this.options.fillEmpty && (j < p || i > 0)) {
				if(day > monthLength) {
					empDay = day++ - monthLength
					year = (this.month + 1) == 12 ? this.year + 1 : this.year
					month = (this.month + 1) == 12 ? 0 : this.month + 1
				} else if (day == 1) {
					empDay = pMonthLength++ - p + 1
					year = (this.month - 1) == -1 ? this.year - 1 : this.year
					month = (this.month - 1) == -1 ? 11 : this.month - 1
				}
				if(day > monthLength || day == 1) {
					today = month === this.today.getMonth() && year === this.today.getFullYear() && empDay === this.today.getDate()
					past = year < this.today.getFullYear() || month < this.today.getMonth() && year === this.today.getFullYear() ||
						month === this.today.getMonth() && year === this.today.getFullYear() && empDay < this.today.getDate()
					dbobj = {'month': month, 'year': year}
					curr_chance = ( this.options.chance[year] !== undefined ? this.options.chance[year][month][empDay - 1] : 0 );
					inner = '<span class="fc-date fc-emptydate">' + empDay + '</span><span class="fc-weekday">' + curr_chance + '%</span>'
					day_id = parseInt( (month+1).toString() + empDay.toString() )
					data = this.caldata[empDay]
					if(data) content += this.parseDataToDay(data, day_id, dbobj)
				}
			}
			
			if (day <= monthLength && (i > 0 || j >= p)) {
				curr_chance = ( this.options.chance[this.year] !== undefined ? this.options.chance[this.year][this.month][day - 1] : 0 );
				inner = '<span class="fc-date">' + day + '</span><span class="fc-weekday">' + curr_chance + '%</span>'
				day_id = parseInt( (this.month+1).toString() + day.toString() )
				data = this.caldata[day]
				if(data) content += this.parseDataToDay(data, day_id, dbobj)
				++day;
			}
			
			cellClasses = (today ? 'fc-today ' : (past ? 'fc-past ' : 'fc-future ')) + (content !== '' ? 'fc-content ' : '')
			if( curr_chance >= 40 ) cellClasses += ( curr_chance >= 70 ? 'chance-over9000 ' : 'chance-meh ')
			
			html += (cellClasses !== '' ? '<div class="' + cellClasses.trim() + '">' : '<div>') + inner + '</div>'
		}

		if(day > monthLength) {
			this.rowTotal = i + 1
			break
		} else html += '</div><div class="fc-row">'
		}
		return html + '</div></div>'
	}

	Calendario.prototype.move = function(dir, callback) {
		if(dir === 'previous') {
			this.year = this.month > 0 ? this.year : --this.year
			this.month = this.month > 0 ? --this.month : 11
		} else if(dir === 'next') {
			this.year = this.month < 11 ? this.year : ++this.year
			this.month = this.month < 11 ? ++this.month : 0
		}
		return this.generateTemplate(callback)
	}

	Calendario.prototype.option = function(option, value) {
		if(value) return this.options[option] = value
		else return this.options[option]
	}
	
	Calendario.prototype.getYear = function() {
		return this.year
	}
	
	Calendario.prototype.getMonth = function() {
		return this.month + 1
	}
	
	Calendario.prototype.getMonthName = function() {
		return this.options.months[this.month]
	}
	
	Calendario.prototype.gotoPreviousMonth = function(callback) {
		return this.move('previous', callback)
	}
	
	Calendario.prototype.gotoNextMonth = function(callback) {
		return this.move('next', callback)
	}
	
	function Plugin(option, value1, value2, value3) {
		var val = ''
		this.each(function () {
			var $this   = $(this)
			var data    = $this.data('bz.calendario')
			var options = typeof option == 'object' && option
			
			if (!data) $this.data('bz.calendario', (data = new Calendario(this, options)))
			if (typeof option == 'string' && $.isFunction(data[option])) return val = data[option](value1, value2, value3)
			else if (typeof option == 'string') return val = data['option'](value1, value2)
		})
		if(val) {
			return val
		} else {
			$(document).trigger($.Event('finish.calendar.calendario'))
		}
	}
	
	var old = $.fn.calendario
	
	$.fn.calendario             = Plugin
	$.fn.calendario.Constructor = Calendario

	$.fn.calendario.noConflict = function () {
		$.fn.calendario = old
		return this
	}  
}(jQuery);