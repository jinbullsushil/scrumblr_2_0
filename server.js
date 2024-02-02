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
        console.log('Data stored in database:', postData);
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
					{ enable: true, label: 'Notes','icon' :'' },
					{ enable: true, label: 'Resources','icon' :'' },
					{ enable: true, label: 'Tasks','icon' :'' }
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
			{ tabname: 'notes', 'active' : false , icon: `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xl="http://www.w3.org/1999/xlink" xmlns:dc="http://purl.org/dc/elements/1.1/" viewBox="-308 -223 30 30" width="30" height="30"><defs/><g id="Notes-Instruction" stroke="none" stroke-dasharray="none" fill="none" stroke-opacity="1" fill-opacity="1"><title>Notes-Instruction</title><rect fill="transparent" x="-308" y="-223" width="30" height="30"/><g id="Notes-Instruction_Layer_1"><title>Layer 1</title><g id="Graphic_24"><title>Assignment</title><path d="M -288.4889 -215.1 L -292.01867 -215.1 C -292.37333 -216.202 -293.30222 -217 -294.4 -217 C -295.49778 -217 -296.42667 -216.202 -296.78133 -215.1 L -300.3111 -215.1 C -301.24 -215.1 -302 -214.245 -302 -213.2 L -302 -199.9 C -302 -198.855 -301.24 -198 -300.3111 -198 L -288.4889 -198 C -287.56 -198 -286.8 -198.855 -286.8 -199.9 L -286.8 -213.2 C -286.8 -214.245 -287.56 -215.1 -288.4889 -215.1 Z M -294.4 -215.1 C -293.93556 -215.1 -293.55556 -214.6725 -293.55556 -214.15 C -293.55556 -213.6275 -293.93556 -213.2 -294.4 -213.2 C -294.86444 -213.2 -295.24444 -213.6275 -295.24444 -214.15 C -295.24444 -214.6725 -294.86444 -215.1 -294.4 -215.1 Z M -292.7111 -201.8 L -298.62222 -201.8 L -298.62222 -203.7 L -292.7111 -203.7 L -292.7111 -201.8 Z M -290.17778 -205.6 L -298.62222 -205.6 L -298.62222 -207.5 L -290.17778 -207.5 L -290.17778 -205.6 Z M -290.17778 -209.4 L -298.62222 -209.4 L -298.62222 -211.3 L -290.17778 -211.3 L -290.17778 -209.4 Z" fill="black"/></g></g></g></svg>` },
			{ tabname: 'research','active' : false , icon: `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xl="http://www.w3.org/1999/xlink" xmlns:dc="http://purl.org/dc/elements/1.1/" viewBox="-308 -223 30 30" width="30" height="30"><defs/><g id="Notes-Research" stroke="none" stroke-dasharray="none" fill="none" stroke-opacity="1" fill-opacity="1"><title>Notes-Research</title><rect fill="transparent" x="-308" y="-223" width="30" height="30"/><g id="Notes-Research_Layer_1"><title>Layer 1</title><g id="Graphic_2"><title>Turned In</title><path d="M -287.57143 -217.5 L -298.42857 -217.5 C -299.62286 -217.5 -300.58914 -216.55 -300.58914 -215.3889 L -300.6 -198.5 L -293 -201.66667 L -285.4 -198.5 L -285.4 -215.3889 C -285.4 -216.55 -286.37714 -217.5 -287.57143 -217.5 Z" fill="black"/></g></g></g></svg>`},
			{ tabname: 'tasks','active' : true, icon: `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xl="http://www.w3.org/1999/xlink" xmlns:dc="http://purl.org/dc/elements/1.1/" viewBox="-308 -223 30 30" width="30" height="30"><defs/><g id="Tasks-Done" stroke="none" stroke-dasharray="none" fill="none" stroke-opacity="1" fill-opacity="1"><title>Tasks-Done</title><rect fill="transparent" x="-308" y="-223" width="30" height="30"/><g id="Tasks-Done_Layer_1"><title>Layer 1</title><g id="Graphic_27"><title>Assignment Turned In</title><path d="M -286.66553 -215.6 L -290.1953 -215.6 C -290.54998 -216.702 -291.47886 -217.5 -292.57664 -217.5 C -293.67442 -217.5 -294.6033 -216.702 -294.95798 -215.6 L -298.48775 -215.6 C -299.41664 -215.6 -300.17664 -214.745 -300.17664 -213.7 L -300.17664 -200.4 C -300.17664 -199.355 -299.41664 -198.5 -298.48775 -198.5 L -286.66553 -198.5 C -285.73664 -198.5 -284.97664 -199.355 -284.97664 -200.4 L -284.97664 -213.7 C -284.97664 -214.745 -285.73664 -215.6 -286.66553 -215.6 Z M -292.57664 -215.6 C -292.1122 -215.6 -291.7322 -215.1725 -291.7322 -214.65 C -291.7322 -214.1275 -292.1122 -213.7 -292.57664 -213.7 C -293.0411 -213.7 -293.4211 -214.1275 -293.4211 -214.65 C -293.4211 -215.1725 -293.0411 -215.6 -292.57664 -215.6 Z M -294.26553 -202.3 L -297.6433 -206.1 L -296.45264 -207.4395 L -294.26553 -204.9885 L -288.70064 -211.249 L -287.50998 -209.9 L -294.26553 -202.3 Z" fill="black"/></g></g></g></svg>` },
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

		console.log(mainDefaultArr);
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
	console.log('uniqueIDuniqueID',uniqueID);
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
