import sys
import math
import sqlite3
import json
import getopt
import requests
from datetime import datetime
from calendar import monthrange

#Глобальные перменные
update_chance = False
fill_db = False
file_data = ''
db = ''
service_token = ''

#----------------------------------------------------------------------------------------------------------------------#

#Достаем аргументы коммандной строки
try:
	opts, args = getopt.getopt( sys.argv[1:], "ht:d:j:" )
except getopt.GetoptError:
	print( 'gufenator.py -t <vk_service_token> -d [database] -j [js_output]' )
	sys.exit( 'Ошибка: неизвестные параметры командной строки!' )

for opt, arg in opts:
	if opt == '-h':
		print( 'gufenator.py -t <vk_service_token> -d [database] -j [js_output]' )
		sys.exit( 0 )
	elif opt == '-t':
		service_token = arg
	elif opt == '-d':
		db = arg
	elif opt == '-j':
		file_data = arg

if file_data == '': sys.exit( 'Ошибка: не определен путь к js-файлу для записи вероятностей.' )
if db == '': sys.exit( 'Ошибка: не определен путь к файлу базы данных!' )
if service_token == '': sys.exit( 'Ошибка: не определен сервисный токен для доступа к api вкотнтакта!' )

#----------------------------------------------------------------------------------------------------------------------#

#Открытие/создание БД
try:
	connDB = sqlite3.connect( db )
	query = connDB.cursor();
	query.execute('SELECT COUNT(*) FROM sqlite_master WHERE type="table" AND name="streams"')
	if query.fetchone()[0] == 0:
		query.execute('CREATE TABLE streams (id INTEGER PRIMARY KEY, date INTEGER, name TEXT, img TEXT)')
		connDB.commit()
except sqlite3.Error:
	sys.exit( 'Ошибка: база данных не открывается/создается!' )

#----------------------------------------------------------------------------------------------------------------------#

#ФУНКЦИЯ Загружает через api вконтакта посты со стены гуфени, где упоминается твич.
def loadWall( count, offset=0 ):
	print( 'JSON: Загружаем ['+ str( offset ) + '-' + str( offset + count ) + '] посты со стены...' )
	api_query = 'https://api.vk.com/method/wall.search?owner_id=172785834&query=twitch.tv/gufovicky&owners_only=1&v=5.103&access_token=' +\
	service_token  + '&count=' + str( count ) + '&offset=' + str( offset )

	#-----------------------
	try:
		response = requests.get( api_query )
	except requests.exceptions.RequestException:
		return None
	json_obj = json.loads( response.text )
	#-----------------------
	print( 'JSON: Загружено.' )
	#Проверяем json-данные на корректность.
	if 'response' not in json_obj or 'items' not in json_obj['response']:
		return None
	if len( json_obj['response']['items'] ) == 0:
		return None
	return json_obj

#ФУНКЦИЯ Удаляет из описаний стримов опасные символы, иначе базе беда будет.
html_escape_table = {
	"\n": " ",
	"\\": "&#92;",
	"&": "&amp;",
	'"': "&quot;",
	"'": "&apos;",
	">": "&gt;",
	"<": "&lt;",
}
def html_escape( text ):
    return "".join( html_escape_table.get( c,c ) for c in text )

#ФУНКЦИЯ Заносит в БД данные о стримах.
def JsonToDB ( src_json ):
	many_query = []
	
	#Перебираем json-ответ с записями со стены
	for item in src_json['response']['items']:
		int_id = item['id']
		int_date = 0
		str_name = ''
		str_img = ''
		
		#Проверка на репост стрима из игрожука
		if 'copy_history' in item:
			item = item['copy_history'][0]
		
		#Проверка нахождения ссылки на стрим в тексте со стены
		if 'twitch.tv/gufovicky' not in item['text']:
			continue
		
		#Удаление ссылки на стрим из зазывательной хохмочки
		int_date = item['date']
		str_name = item['text'].replace( 'twitch.tv/gufovicky', ' ' )
		str_name = str_name.replace( 'http://www. ', '' ).replace( 'https://www. ', '' )
		str_name = html_escape( str_name ).lstrip()
		
		#Проверяем вложение, наналичие картинок
		if 'attachments' in item and len( item['attachments'] ) > 0:
			attach_type = None
			
			if 'photo' in item['attachments'][0]:
				attach = item['attachments'][0]['photo']['sizes']
				attach_type = 1
			elif 'doc' in item['attachments'][0] and item['attachments'][0]['doc']['ext'] == 'gif':
				attach = item['attachments'][0]['doc']['preview']['photo']['sizes']
				attach_type = 2
			
			#Ищем самую больщую картинку
			if attach_type != None:
				max_width = 0
				for pic in attach:
					if pic['width'] > max_width:
						max_width = pic['width']
						str_img = pic[ ('src', 'url')[ attach_type == 1 ]  ]
		
		#Вносим в массив данные со стены
		many_query.append( [ int_id, int_date, str_name, str_img ] )
	
	#Вносим в БД данные из записей на стене
	query.executemany( 'INSERT OR IGNORE INTO streams VALUES(?, ?, ?, ?)', many_query)
	connDB.commit()
	
#Загрузка последних трех постов со страницы гуфена.
last_w = loadWall( 3 )
if last_w == None:
	connDB.close()
	sys.exit( 'Ошибка: не удалось загрузить посты со стены!' )
else:
	#Формируем список id
	id_str=''
	for item in last_w['response']['items']:
		id_str += str( item['id'] ) + ','
	id_str = id_str[:-1] #Удаляем последнюю запятую.
	
	#Проверяем наличие данных в БД.
	query.execute( 'SELECT COUNT(id) FROM streams WHERE id IN (' + id_str + ') ' )
	query_count = query.fetchone()[0]
	if query_count == 0:
		#Не нашло ни одной записи. Будем выкачивать полностью таблицу.
		print( 'БД: База устарела, запуск обновления.' )
		update_chance = True
		fill_db = True
	elif query_count != len( last_w['response']['items'] ):
		#Появилась новая запись/си. Добавляем её/их в БД.
		print( 'БД: В базу добавлено записей: ' + str( query_count ) )
		update_chance = True
		JsonToDB ( last_w )
	else:
		print( 'БД: База актуальна, изменений нет.' )

#Загрузка всех дат стримов со страницы гуфена.
if fill_db == True:
	cnt = math.ceil( last_w['response']['count'] / 100.0 )
	for x in range( cnt ):
		x_json = loadWall( 100, x*100 )
		if x_json != None:
			JsonToDB ( x_json )

#Рассчет вероятностей стримов по дням.
if update_chance == True:
	print( 'Рассчет вероятностей стримов...' )
	#-------------------------------------------------------------------------------
	#Извлечение из БД в массивы дат стримов (для обучения сетки) и запись в файл событий для календаря.
	streams = {}
	try:
		data_js = open( file_data, 'w' )
	except IOError:
		connDB.close()
		sys.exit( 'Ошибка: невозможно открыть файл "' + file_data + '" на запись!' )
	data_js.write( 'var events = {\n' )

	data = query.execute('SELECT date, name, img FROM streams ORDER BY date ASC').fetchall()
	data_len = len( data )
	for i in range( data_len ):
		d = datetime.fromtimestamp( data[i][0] )
		year = d.year
		month = d.month
		day = d.day
		t_hour = d.hour
		t_min = d.minute
		
		if year not in streams: streams[year] = []
		streams[year].append( [ d.month, d.day, d.weekday() ] )
		
		data_js.write( '\t\'' +\
			"%02d"%month + '-' + "%02d"%day + '-' + str( year ) + '-' + "%02d"%t_hour + '-' + "%02d"%t_min +\
			'\' : [{pic: \'' + ( data[i][2] , 'https://sun9-61.userapi.com/c628529/v628529834/36db/eh_XK9AUM5Q.jpg' )[ data[i][2] == '' ] +\
			'\', text: \'' + ( data[i][1] , 'NO COMMENTS' )[ data[i][1] == '' ]  + '\'}]' +\
			(',\n', '\n')[ data_len-1 == i ] )
		
	data_js.write( '};\n\n' )

	#-------------------------------------------------------------------------------
	#Обучение нейросети и подсчет вероятностей стримов.
	chance_arr = {}
	day_mask = [ [0]*31, [0]*29, [0]*31, [0]*30, [0]*31, [0]*30, [0]*31, [0]*31, [0]*30, [0]*31, [0]*30, [0]*31 ]
	week_mask = [ [0]*7, [0]*7, [0]*7, [0]*7, [0]*7, [0]*7, [0]*7, [0]*7, [0]*7, [0]*7, [0]*7, [0]*7 ]

	#Усиление весов от дней недели
	year_weigth = 3 #Крайние 3 года тем сильнее, чем ближе к текущему году
	for year in sorted(streams, reverse=True):
		for day in streams[year]:
			week_mask[day[0]-1][day[2]] += 1 + year_weigth
			day_mask[day[0]-1][day[1]-1] += 1 + ( year_weigth * 2)
		if year_weigth > 0: year_weigth -= 1

	#Подсчет вероятностей на конкретный год
	year_calc = 5
	now_date = datetime.now()
	year = now_date.year - ( year_calc - 2 ) #Будущий, текущий, и прошлые

	min_val = 9999999
	max_val = 0
	for i in range( year_calc ):
		chance_arr[year] = []
		start_week_day = datetime(year, 1, 1).weekday()
		for month in range( 12 ):
			m_days = monthrange( year, month+1)[1]
			chance_arr[year].append( [0]*m_days )
			for day in range( m_days ):
				#Ты думал тут правда нейросеть? Ахаха, ну ты и лалка.
				chance = week_mask[month][start_week_day] + day_mask[month][day]
				chance_arr[year][month][day] = chance
				if chance < min_val: min_val = chance
				if chance > max_val: max_val = chance
				start_week_day = (start_week_day + 1, 0)[ start_week_day == 6 ]
		year += 1

	#Перевод в проценты
	koeff = 100 / (max_val - min_val)
	for year in chance_arr:
		for month in chance_arr[year]:
			for day in range( len( month ) ):
				month[day] = int( month[day] * koeff )

	#-------------------------------------------------------------------------------
	#Запись в файл вероятностей стримов, для отображения их в календаре.

	data_js.write( 'var chance = {\n' )
	i = 1
	for year in chance_arr:
		data_js.write( '\t\'' + str( year ) + '\': [\n' )
		for month in range( len( chance_arr[year] ) ):
			month_str = '\t\t['
			
			for day in chance_arr[year][month]:
				month_str += str( day ) + ','
			month_str = month_str[:-1]
			
			month_str += ']' + (',\n', '\n')[ month == 11 ]
			data_js.write( month_str )
		data_js.write( '\t]' + (',\n', '\n')[ i >= year_calc ] )
		i += 1
	data_js.write( '};\n' )

#Закрытие БД
connDB.close()
