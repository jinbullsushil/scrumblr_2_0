/**************
 SYSTEM INCLUDES
**************/
var	http = require('https');
const fs = require('fs');
var sys = require('util');
var	async = require('async');
var sanitizer = require('sanitizer');
var compression = require('compression');
var express = require('express');
// var conf = require('./config.js').server;
// var ga = require('./config.js').googleanalytics;
var nconf = require('nconf');
var cors = require('cors');
const bodyParser = require('body-parser');
/*************
 * nconf SETUP
 *************/

// Set up nconf to include configuration first
// From command line args, then env, then
// config file
nconf.argv()
.env()
.file({ file: 'config.json' });

// Now set default config values:
nconf.set('server:baseurl', '/');
nconf.set('server:port', 443);

//nconf.set('ga:account', 'UA-2069672-4');

nconf.set('redis:url', 'redis://127.0.0.1:6379');
nconf.set('redis:prefix', '#scrumblr#');

console.log('NODE_ENV: ' + nconf.get('NODE_ENV'));
console.log('server: ' + JSON.stringify(nconf.get('server')));
console.log('redis: ' + JSON.stringify(nconf.get('redis')));

/**************
 LOCAL INCLUDES
**************/
var	rooms	= require('./lib/rooms.js');
var	data	= require('./lib/data/redis.js').db;


/**************
 GLOBALS
**************/
//Map of sids to user_names
var sids_to_user_names = [];

/**************
 SETUP EXPRESS
**************/
var app = express();
var router = express.Router();

app.set('view engine', 'ejs');

app.use(cors());
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    next();
});


app.use(compression());
app.use(nconf.get('server:baseurl'), router);
//app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


// app.locals.ga = ga.enabled;
// app.locals.gaAccount = ga.account;

router.use(express.static(__dirname + '/client'));

const options2 = {
  key: fs.readFileSync('keys/certificate.key'),
  cert: fs.readFileSync('keys/certificate.cer'),
  ca: fs.readFileSync('keys/certificate.ca'),
};

var server = require('https').Server(options2,app);

//var server = require('http').Server(app);

/**************
 SETUP Socket.IO
**************/
// var io = require('socket.io')(server, {
// 	path: conf.baseurl == '/' ? '' : conf.baseurl + "/socket.io"
// });
// We move socket.io from it's default URL (/socket.io) to (/socketio) because during
// the upgrade to new socket.io, old clients on production server were hitting old
// URL and crashing the server.
const options = { path: '/socketio' };
const io = require('socket.io')(server, options);

server.listen(nconf.get('server:port'));
console.log('Server running at port:' + nconf.get('server:port') + '/');


/**************
 ROUTES
**************/
router.get('/', function(req, res) {
	//console.log(req.header('host'));
	var url = req.header('host') + req.baseUrl;

	var clientsCount = io.of("/").sockets.size;

	res.render('home.pug', {
		url: url,
		connected: clientsCount
	});
});


router.get('/demo', function(req, res) {
	res.render('index', {
		pageTitle: 'Pin Board - demo',
		demo: true
	});
});


router.get('/pinboard', function(req, res){	
	res.render('404', {
		pageTitle: ('Pin Board - ' + req.params.id)	
	});
});


router.get('/:id', function(req, res){
	var url = req.header('host') + req.baseUrl;
	if(req.params.id =='share'){
		res.render('share', {
			pageTitle: 'Share board ',
			baseurl:url,
			errormessage:''
		});	 
	}
	else
	{
		res.render('index', {
			pageTitle: ('Pinboard - ' + req.params.id)
		});
	}
	
});


router.get('/share/:id', function(req, res){
	var url = req.header('host') + req.baseUrl;

	console.log('req.params.id', req.params.id);


	db.getShareCode( req.params.id, function(sharecodeData) {

			console.log('sizesizesizesize', sharecodeData);
			var sharecodeDataArr = sharecodeData.split('@@');
			console.log(sharecodeDataArr);
			var sharePadId = sharecodeDataArr[1];
			var sharePadType = sharecodeDataArr[0];

			db.getSectionName( sharePadId, function(sectionnameData) {
					if (sharecodeData !== null) {
							if(sharePadType =='planner'){
								res.render('planner', {
									pageTitle: ('Planner - ' + sectionnameData),
									boardId: sharePadId,
									sectionname: sectionnameData,
									baseurl:url,
									fullUrl:''
								});
							}
							else{
								res.render('pinboard', {
									pageTitle: ('Pin board - ' + sectionnameData),
									boardId: sharePadId,
									sectionname: sectionnameData,
									baseurl:url,
									fullUrl:''
								});	
							}
					}
					else{
						res.render('share', {
								pageTitle: ('Pin board - ' + sectionnameData),
								boardId: sharePadId,
								sectionname: sectionnameData,
								baseurl:url,
								fullUrl:'',
								errormessage:'Please enter correct code'
							});	
					}
			});


			
		});



	//console.log(req.params.sectionname);
	
});

// Handle checkbox changes and keypress
app.post('/setTabDataToDb', (req, res) => {
	try {
        const postData = req.body.postData;
        const getPadID = req.body.getPadID;
        // Validate if postData and getPadID are present in the request body
        if (!postData || !getPadID) {
            throw new Error('Invalid request body');
        }
        db.setDbTabData(getPadID, postData);
        //console.log('Data stored in database:', postData);
        res.status(200).send('Data stored in database');
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).send('Internal Server Error');
    }
	/*
	const postData = req.body.postData;
	const getPadID = req.body.getPadID;
	db.setDbTabData( getPadID, postData );
	console.log('Data stored in database:', postData);
	res.status(200).send('Data stored in database');
	*/
});

router.get('/pinboard/:id/:sectionname', async function (req, res) {
    try {
        var uniqueID = Math.round(Math.random() * 99999999);
        console.log('uniqueIDuniqueID', uniqueID);
        var url = req.header('host') + req.baseUrl;
        res.cookie(`scrumscrum-username`, req.query.name, 365);
        var fullUrl = req.protocol + '://' + req.get('host') + req.path;

        // Use async/await to fetch data
        const size = await new Promise((resolve, reject) => {
            db.getSectionName(req.params.id, function (result) {
                resolve(result);
            });
        });
		var getPadID = req.params.id+'_pinboard_tab';
        var dbTabData = await new Promise((resolve, reject) => {
            db.getTabData(getPadID, function (result) {
                resolve(result);
            });
        });	
		if (!dbTabData || dbTabData.length === 0) {
			// Assign default value only if dbTabData is empty or undefined
			const defaultTabData = [
				[
					{ enable: true, label: 'Notes', icon :'',tabindex:0 },
					{ enable: true, label: 'Resources', icon :'',tabindex:1 },
					{ enable: true, label: 'Tasks', icon :'',tabindex:2 },
					{ enable: true, label: 'Q&A', icon :'',tabindex:3 },
					{ enable: true, label: 'Subject', icon :'',tabindex:4 },
					{ enable: true, label: 'Ideas',icon :'',tabindex:5 }
				]
			];
			// Update dbTabData with the default value
			dbTabData = defaultTabData;
		}
		
		/*
		var tabDefaultArr = [];
		for (var i = 0; i < dbTabData[0].length; i++) {
			//	var tabDataItem = locals.tabData[0][i] || {};
			console.log(i);
			var tabDefaultObj = {}
			tabDefaultObj.icon = ``;
			tabDefaultObj.tabname = ``;
		}	
		*/
		var mainDefaultArr =[
			{ tabname: 'notes', 'active' : false , icon: `<svg xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xl="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="-5 -25 22 27" width="22" height="27"><defs/><g id="Pinboard-note" stroke-opacity="1" stroke="none" fill="none" fill-opacity="1" stroke-dasharray="none"><title>Pinboard-note</title><g id="Pinboard-note_Layer_1"><title></title><g id="Graphic_19"><text transform="translate(-4.5 -24.5)" fill="black"><tspan font-family="Apple Color Emoji" font-size="16" fill="black" x="0" y="20">📝</tspan></text></g></g></g></svg>` },
			{ tabname: 'research','active' : false , icon: `<svg xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xl="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="-22 -1 21 26" width="21" height="26"><defs/><g id="Pinboard-resources" stroke-opacity="1" stroke="none" fill="none" fill-opacity="1" stroke-dasharray="none"><title>Pinboard-resources</title><g id="Pinboard-resources_Layer_1"><title></title><g id="Graphic_15"><text transform="translate(-22 -1)" fill="black"><tspan font-family="Apple Color Emoji" font-size="16" fill="black" x="0" y="20">⚛️</tspan></text></g></g></g></svg>`},
			{ tabname: 'tasks','active' : true, icon: `<svg xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xl="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="-8 -10 23 26" width="23" height="26"><defs/><g id="Pinboard-tasks" stroke-opacity="1" stroke="none" fill="none" fill-opacity="1" stroke-dasharray="none"><title>Pinboard-tasks</title><g id="Pinboard-tasks_Layer_1"><title></title><g id="Graphic_15"><text transform="translate(-8 -10)" fill="black"><tspan font-family="Apple Color Emoji" font-size="16" fill="black" x="0" y="20">✅</tspan></text></g></g></g></svg>` },
			{ tabname: 'questionanswer','active' : true, icon: `<svg xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xl="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="-18 -4 23 26" width="23" height="26"><defs/><g id="Pinboard-QandA" stroke-opacity="1" stroke="none" fill="none" fill-opacity="1" stroke-dasharray="none"><title>Pinboard-QandA</title><g id="Pinboard-QandA_Layer_1"><title></title><g id="Graphic_15"><text transform="translate(-18 -4)" fill="black"><tspan font-family="Apple Color Emoji" font-size="16" fill="black" x="0" y="20">✴️</tspan></text></g></g></g></svg>` },
			{ tabname: 'subject','active' : true, icon: `<svg xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xl="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="-18 2 21 26" width="21" height="26"><defs/><g id="Pinboard-subject" stroke-opacity="1" stroke="none" fill="none" fill-opacity="1" stroke-dasharray="none"><title>Pinboard-subject</title><g id="Pinboard-subject_Layer_1"><title></title><g id="Graphic_16"><text transform="translate(-18 2)" fill="black"><tspan font-family="Apple Color Emoji" font-size="16" fill="black" x="0" y="20">🛄</tspan></text></g></g></g></svg>` },
			{ tabname: 'ideas','active' : true, icon: `<svg xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xl="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="-24 -35 22 27" width="22" height="27"><defs/><g id="Pinboard-ideas" stroke-opacity="1" stroke="none" fill="none" fill-opacity="1" stroke-dasharray="none"><title>Pinboard-ideas</title><g id="Pinboard-ideas_Layer_1"><title></title><g id="Graphic_16"><text transform="translate(-23.097656 -34.539062)" fill="black"><tspan font-family="Apple Color Emoji" font-size="16" fill="black" x="0" y="20">💡</tspan></text></g></g></g></svg>` },
		]
		/*
		 dbTabData = [
			[
			  { enable: true, label: 'Notes' },
			  { enable: false, label: 'Notes' },
			  { enable: false, label: 'Notes' }
			]
		  ];
		 */ 

		//console.log(mainDefaultArr);
		//console.log('size2size2size2', size2);
		//console.log('size2size2size2', size);

        res.render('pinboard', {
            pageTitle: ('Pin board - ' + size),
            boardId: req.params.id,
            sectionname: size,
            baseurl: url,
            fullUrl: fullUrl,
            tabData: dbTabData,
			mainFullData: mainDefaultArr
        });
    } catch (error) {
        // Handle errors
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});



router.get('/pinboard2/:id/:sectionname', function(req, res){
	var uniqueID = Math.round(Math.random() * 99999999); //is this big enough to assure
	//console.log('uniqueIDuniqueID',uniqueID);
	var url = req.header('host') + req.baseUrl;
	res.cookie(`scrumscrum-username`,req.query.name,365);	
	//console.log('------------------------------- page = ',req.query.name);

	//var fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
	var fullUrl = req.protocol + '://' + req.get('host') + req.path;
	db.getSectionName( req.params.id, function(size) {
		res.render('pinboard', {
			pageTitle: ('Pin board - ' + size),
			boardId: req.params.id,
			sectionname: size,
			baseurl:url,
			fullUrl:fullUrl
		});
	});
});

router.get('/pinboard/:id', function(req, res){
	var url = req.header('host') + req.baseUrl;
	var fullUrl = req.protocol + '://' + req.get('host') + req.path;
	//console.log(req.params.sectionname);
	res.render('pinboard', {
		pageTitle: ('Pin board - ' + req.params.id),
		boardId: req.params.id,
		sectionname: '',
		baseurl:url,
		fullUrl:fullUrl
	});
});

router.get('/planner/:id/:sectionname', function(req, res){
	var url = req.header('host') + req.baseUrl;
	//console.log('req.params.username = ' , req.params.name);
	//console.log('req.params.username = ' , req.query.name);
	res.cookie('scrumscrum-username',req.query.name);	
	
	var fullUrl = req.protocol + '://' + req.get('host') + req.path;
	db.getSectionName( req.params.id, function(size) {
		res.render('planner', {
			pageTitle: ('Planner - ' + size),
			boardId: req.params.id,
			sectionname: size,
			baseurl:url,
			fullUrl:fullUrl
		});
	});
});


router.get('/planner/:id', function(req, res){
	var url = req.header('host') + req.baseUrl;
	//console.log(req.params.sectionname);
	res.render('planner', {
		pageTitle: ('Planner - ' + req.params.id),
		boardId: req.params.id,
		sectionname: '',
		baseurl:url
	});
});

router.get('/clone/:sourceSection/:targetSection', function(req, res){
	var url = req.header('host') + req.baseUrl;	
	const boardTabArray = ["_tasks", "_notes", "_research","_introduction","_keypoints","_paragraph","_summary"];
	for (var i in boardTabArray) {
		boardTab = boardTabArray[i];
		var cloneMsg = {};
		cloneMsg.sourceSection = '/'+req.params.sourceSection+boardTab;
		cloneMsg.targetSection = '/'+req.params.targetSection+boardTab;		
		cloneCards(cloneMsg);
	}
	var sendMessage = {};
	sendMessage.status = 200;
	sendMessage.message = 'Data has been cloned successfully.';
	res.send(sendMessage);	
});

router.get('/setSection/:id/:sectionname/:username', function(req, res){
	var sendMessage = {};
	//console.log('req.params.username', req.params.username);
	res.cookie('scrumscrum-username',req.params.username);	
	//res.cookie('scrumscrum-username2',req.params.username);	
	//res.cookie('username', 'Flavio', { domain: 'localhost:', path: '/administrator', secure: true })
	//console.log(res.cookies);	
	sendMessage.status = 200;
	sendMessage.sectionname = req.params.sectionname;
	sendMessage.username = req.params.username;
	sendMessage.id = req.params.id;
	sendMessage.cook = res.cookies;
	db.setDbSectionName( req.params.id, req.params.sectionname );
	db.getSectionName( req.params.id, function(size) {
			sendMessage.dbSectionname = size;
			res.send(sendMessage);
	});
});



/**************
 SOCKET.I0
**************/
io.on('connection', (client) => {
	//santizes text
	function scrub( text ) {
		if (typeof text != "undefined" && text !== null)
		{
			//clip the string if it is too long
			if (text.length > 65535)
			{
				text = text.substr(0,65535);
			}

			return sanitizer.sanitize(text);
		}
		else
		{
			return null;
		}
	}



	client.on('message', function( message ){
		//console.log(message.action + " -- " + sys.inspect(message.data) );

		var clean_data = {};
		var clean_message = {};
		var message_out = {};

		if (!message.action)	return;

		switch (message.action)
		{
			case 'initializeMe':
				initClient(client);
				break;

			case 'setShareCode':
					//console.log(message);
					//console.log('dddddddddddddddddddddddddddd');
					db.setDbShareCode( message.data.padId,message.data.sharecode, message.data.item );
				break;	

			case 'joinRoom':

				joinRoom(client, message.data, function(clients) {

						client.send( { action: 'roomAccept', data: '' } );

				});

				break;

			case 'moveCard':
				//report to all other browsers
				message_out = {
					action: message.action,
					data: {
						id: scrub(message.data.id),
						position: {
							left: scrub(message.data.position.left),
							top: scrub(message.data.position.top)
						}
					}
				};


				broadcastToRoom( client, message_out );

				// console.log("-----" + message.data.id);
				// console.log(JSON.stringify(message.data));

				getRoom(client, function(room) {
					db.cardSetXY( room , message.data.id, message.data.position.left, message.data.position.top);
				});

				break;

			case 'createCard':
				data = message.data;
				clean_data = {};
				clean_data.text = scrub(data.text);
				clean_data.id = scrub(data.id);
				clean_data.x = scrub(data.x);
				clean_data.y = scrub(data.y);
				clean_data.rot = scrub(data.rot);
				clean_data.colour = scrub(data.colour);
				clean_data.type = scrub(data.type);
				clean_data.createdby = scrub(data.createdby);
				getRoom(client, function(room) {
					createCard( room, clean_data.id, clean_data.text, clean_data.x, clean_data.y, clean_data.rot, clean_data.colour, clean_data.type,clean_data.createdby);
				});

				message_out = {
					action: 'createCard',
					data: clean_data
				};

				//report to all other browsers
				broadcastToRoom( client, message_out );
				break;

			case 'editCard':

				clean_data = {};
				clean_data.value = scrub(message.data.value);
				clean_data.id = scrub(message.data.id);
				clean_data.colour = scrub(message.data.colour);

				// console.log("cardupdate:");
				// console.log(clean_data);

				//send update to database
				getRoom(client, function(room) {
					db.cardEdit( room , clean_data.id, clean_data.value, clean_data.colour );
				});

				message_out = {
					action: 'editCard',
					data: clean_data
				};

				broadcastToRoom(client, message_out);

				break;


			case 'deleteCard':
				clean_message = {
					action: 'deleteCard',
					data: { id: scrub(message.data.id) }
				};

				getRoom( client, function(room) {
					db.deleteCard ( room, clean_message.data.id );
				});

				//report to all other browsers
				broadcastToRoom( client, clean_message );

				break;

			case 'createColumn':
				clean_message = { data: scrub(message.data) };

				getRoom( client, function(room) {
					db.createColumn( room, clean_message.data, function() {} );
				});

				broadcastToRoom( client, clean_message );

				break;

			case 'deleteColumn':
				getRoom( client, function(room) {
					db.deleteColumn(room);
				});
				broadcastToRoom( client, { action: 'deleteColumn' } );

				break;

			case 'updateColumns':
				var columns = message.data;

				if (!(columns instanceof Array))
					break;

				var clean_columns = [];

				for (var i in columns)
				{
					clean_columns[i] = scrub( columns[i] );
				}
				getRoom( client, function(room) {
					db.setColumns( room, clean_columns );
				});

				broadcastToRoom( client, { action: 'updateColumns', data: clean_columns } );

				break;

			case 'changeTheme':
				clean_message = {};
				clean_message.data = scrub(message.data);

				getRoom( client, function(room) {
					db.setTheme( room, clean_message.data );
				});

				clean_message.action = 'changeTheme';

				broadcastToRoom( client, clean_message );
				break;

			case 'setUserName':
				clean_message = {};

				clean_message.data = scrub(message.data);

				setUserName(client, clean_message.data);

				var msg = {};
				msg.action = 'nameChangeAnnounce';
				msg.data = { sid: client.id, user_name: clean_message.data };
				broadcastToRoom( client, msg );
				break;

			case 'addSticker':
				var cardId = scrub(message.data.cardId);
				var stickerId = scrub(message.data.stickerId);

				getRoom(client, function(room) {
					db.addSticker( room , cardId, stickerId );
				});

				broadcastToRoom( client, { action: 'addSticker', data: { cardId: cardId, stickerId: stickerId }});
				break;

			case 'setBoardSize':

				var size = {};
				size.width = scrub(message.data.width);
				size.height = scrub(message.data.height);

				getRoom(client, function(room) {
					db.setBoardSize( room, size );
				});

				broadcastToRoom( client, { action: 'setBoardSize', data: size } );
				break;

			case 'editText':
				var text = "";
				text = scrub(message.data.text);

				//shorten string in case it is long
				text = text.substring(0,64);

				//save Board Name to DB @TODO
				getRoom(client, function(room) {
					db.textEdit( room, 'board-title', text );
				});

				var msg = {};
				msg.action = 'editText';
				msg.data = { item: 'board-title', text: text };
				broadcastToRoom( client, msg );
				break;

			case 'editDescriptionText':
				var text = "";
				text = scrub(message.data.text);
				//shorten string in case it is long
				text = text.substring(0,600);
				//save Board Name to DB @TODO
				getRoom(client, function(room) {
					db.setDescriptionEdit( room, 'board-description', text );
				});

				var msg = {};
				msg.action = 'editDescriptionText';
				msg.data = { item: 'board-description', text: text };
				broadcastToRoom( client, msg );
				break;
			default:
				//console.log('unknown action');
				break;
		}
	});

	client.on('disconnect', function() {
			leaveRoom(client);
	});

  //tell all others that someone has connected
  //client.broadcast('someone has connected');
});






/**************
 FUNCTIONS
**************/

function cloneCards(dataParams){
	db.getAllColumns( dataParams.sourceSection , function (sourceCards) {
		db.getAllColumns( dataParams.targetSection , function (targetCard) {
			if(sourceCards.length != targetCard.length){		
				var blackArray = [];						
				/* Delete All Previous Column*/
				db.setColumns( dataParams.targetSection, blackArray);
				/* Create Columns*/
				db.createColumn(dataParams.targetSection, sourceCards, function() {					
				} );				
				//console.log(targetCard.length);
				//console.log(sourceCards.length);
			}
		});		
	});	
	/* Delete All Previous Cards*/
	db.getAllCards( dataParams.targetSection , function (cardArray) {
		cards = cardArray;
		for (var i in cardArray) {
			card = cardArray[i];
			db.deleteCard ( dataParams.targetSection, card.id );
		}
	});
	/* Create Cards*/
	db.getAllCards( dataParams.sourceSection , function (cardArray) {
		cards = cardArray;
		for (var i in cardArray) {
			card = cardArray[i];	
			uniqueID = Math.round(Math.random() * 99999999);				
			clean_data = {};
			clean_data.text = (card.text);
			clean_data.id = uniqueID;
			clean_data.x = (card.x);
			clean_data.y = (card.y);
			clean_data.rot = (card.rot);
			clean_data.colour = (card.colour);
			clean_data.type = (card.type);
			clean_data.createdby = (card.createdby);
			createCard( dataParams.targetSection, clean_data.id, clean_data.text, clean_data.x, clean_data.y, clean_data.rot, clean_data.colour, clean_data.type,clean_data.createdby);			
		}
	});
	/* Copy Description */
	db.getAllDescriptions( dataParams.sourceSection , function (texts) {		
		db.setDescriptionEdit( dataParams.targetSection, 'board-description', sanitizer.sanitize(texts) );
	});

	/* Copy Description */
	db.getAllTexts( dataParams.sourceSection , function (texts) {		
		db.textEdit( dataParams.targetSection, 'board-title', sanitizer.sanitize(texts) );		
	});

	return true;	
}

function initClient ( client )
{
	//console.log ('initClient Started');
	getRoom(client, function(room) {

		db.getAllCards( room , function (cards) {

			client.send(
				{
					action: 'initCards',
					data: cards
				}
			);

		});


		db.getAllColumns ( room, function (columns) {
			client.send(
				{
					action: 'initColumns',
					data: columns
				}
			);
		});


		db.getTheme( room, function(theme) {

			if (theme === null) theme = 'bigcards';

			client.send(
				{
					action: 'changeTheme',
					data: theme
				}
			);
		});

		db.getBoardSize( room, function(size) {

			if (size !== null) {
				client.send(
					{
						action: 'setBoardSize',
						data: size
					}
				);
			}
		});

		//Right now this only gets one object (board title) but we will extend it later
		//to handle an array of all text we want to sync
		db.getAllTexts( room , function (texts) {
			if (texts) {
				client.send(
					{
						action: 'editText',
						data: { item: "board-title", text: texts }
					}
				);
			}
		});
		//Right now this only gets one object (board Description) but we will extend it later
		//to handle an array of all text we want to sync
		db.getAllDescriptions( room , function (texts) {
			if (texts) {						
					client.send(
					{
						action: 'editDescriptionText',
						data: { item: "board-description", text: texts }
					}
				);
			}
		});
		roommates_clients = rooms.room_clients(room);
		roommates = [];

		var j = 0;
		for (var i in roommates_clients)
		{
			if (roommates_clients[i].id != client.id)
			{
				roommates[j] = {
					sid: roommates_clients[i].id,
					user_name:  sids_to_user_names[roommates_clients[i].id]
					};
				j++;
			}
		}

		//console.log('initialusers: ' + roommates);
		client.send(
			{
				action: 'initialUsers',
				data: roommates
			}
		);

	});
}


function joinRoom (client, room, successFunction)
{
	var msg = {};
	msg.action = 'join-announce';
	msg.data		= { sid: client.id, user_name: client.user_name };

	rooms.add_to_room_and_announce(client, room, msg);
	successFunction();
}

function leaveRoom (client)
{
	//console.log (client.id + ' just left');
	var msg = {};
	msg.action = 'leave-announce';
	msg.data	= { sid: client.id };
	rooms.remove_from_all_rooms_and_announce(client, msg);

	delete sids_to_user_names[client.id];
}

function broadcastToRoom ( client, message ) {
	rooms.broadcast_to_roommates(client, message);
}

//----------------CARD FUNCTIONS
function createCard( room, id, text, x, y, rot, colour, type, createdby ) {
	//console.log('Final Click', createdby);
	var card = {
		id: id,
		colour: colour,
		rot: rot,
		x: x,
		y: y,
		text: text,
		type: type,
		sticker: null,
		createdby:createdby ,
	};

	db.createCard(room, id, card);
}

function roundRand( max )
{
	return Math.floor(Math.random() * max);
}



//------------ROOM STUFF
// Get Room name for the given Session ID
function getRoom( client , callback )
{
	room = rooms.get_room( client );
	//console.log( 'client: ' + client.id + " is in " + room);
	callback(room);
}


function setUserName ( client, name )
{
	client.user_name = name;
	sids_to_user_names[client.id] = name;
	//console.log('sids to user names: ');
	console.dir(sids_to_user_names);
}

function cleanAndInitializeDemoRoom()
{
	// DUMMY DATA
	db.clearRoom('/demo', function() {
		db.createColumn( '/demo', 'Not Started' );
		db.createColumn( '/demo', 'Started' );
		db.createColumn( '/demo', 'Testing' );
		db.createColumn( '/demo', 'Review' );
		db.createColumn( '/demo', 'Complete' );


		createCard('/demo', 'card1', 'Hello this is fun', roundRand(600), roundRand(300), Math.random() * 10 - 5, 'yellow','Sushil');
		createCard('/demo', 'card2', 'Hello this is a new story.', roundRand(600), roundRand(300), Math.random() * 10 - 5, 'white','Sushil');
		createCard('/demo', 'card3', '.', roundRand(600), roundRand(300), Math.random() * 10 - 5, 'blue','Sushil');
		createCard('/demo', 'card4', '.', roundRand(600), roundRand(300), Math.random() * 10 - 5, 'green','Sushil');

		createCard('/demo', 'card5', 'Hello this is fun', roundRand(600), roundRand(300), Math.random() * 10 - 5, 'yellow','Sushil');
		createCard('/demo', 'card6', 'Hello this is a new card.', roundRand(600), roundRand(300), Math.random() * 10 - 5, 'yellow','Sushil');
		createCard('/demo', 'card7', '.', roundRand(600), roundRand(300), Math.random() * 10 - 5, 'blue','Sushil');
		createCard('/demo', 'card8', '.', roundRand(600), roundRand(300), Math.random() * 10 - 5, 'green','Sushil');
	});
}
//

/**************
 SETUP DATABASE ON FIRST RUN
**************/
// (runs only once on startup)
var db = new data(function() {
	cleanAndInitializeDemoRoom();
});
