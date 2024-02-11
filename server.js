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

router.get('/planner/:id/:sectionname', async function (req, res) {
	
	try {
		var url = req.header('host') + req.baseUrl;
        res.cookie(`scrumscrum-username`, req.query.name, 365);
        var fullUrl = req.protocol + '://' + req.get('host') + req.path;
		// Use async/await to fetch data
        const size = await new Promise((resolve, reject) => {
            db.getSectionName(req.params.id, function (result) {
                resolve(result);
            });
        });
		var getPadID = req.params.id+'_planner_tab';
        var dbTabData = await new Promise((resolve, reject) => {
            db.getTabData(getPadID, function (result) {
                resolve(result);
            });
        });
		if (!dbTabData || dbTabData.length === 0) {
			// Assign default value only if dbTabData is empty or undefined
			const defaultTabData = [
				[
					{ enable: true, label: 'Introduction', icon :'',tabindex:0 },
					{ enable: true, label: 'Key points', icon :'',tabindex:1 },
					{ enable: true, label: 'Paragraph', icon :'',tabindex:2 },
					{ enable: true, label: 'Summary', icon :'',tabindex:3 },
					{ enable: false, label: 'Findings', icon :'',tabindex:4 },
					{ enable: false, label: 'Methodology',icon :'',tabindex:5 }
				]
			];
			// Update dbTabData with the default value
			dbTabData = defaultTabData;
		}
		
		var mainDefaultArr =[
			{ tabname: 'introduction', 'active' : false , icon: `<svg xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns="http://www.w3.org/2000/svg" xmlns:xl="http://www.w3.org/1999/xlink" version="1.1" viewBox="-12 -11 22 20" width="28" height="20"><defs/><g id="Planner-red" fill-opacity="1" stroke="none" stroke-opacity="1" fill="none" stroke-dasharray="none"><title></title><g id="Planner-red_Layer_1"><title></title><g id="Group_7"><g id="Graphic_13"><path d="M 6.90625 -.153125 L 9.484375 2.390625 L -1.9625 7.85625 C -1.9625 7.85625 -3.475 8.54375 -4.196875 7.44375 C -7.015625 3.04375 6.90625 -.153125 6.90625 -.153125 Z" fill="#962c2c"/></g><g id="Graphic_12"><path d="M -2.2375 4.659375 C -2.2375 4.659375 -4.4375 5.415625 -4.025 6.89375 C -3.6125 8.40625 -1.859375 7.478125 -1.859375 7.478125 L 9.003125 2.425 C 9.003125 2.425 8.384375 .809375 9.484375 -.25625 Z" fill="#d9e3e8"/></g><g id="Graphic_11"><path d="M -.415625 -10.5 L 10 -.359375 L -2.30625 4.453125 L -10.2125 -7.853125 Z" fill="#ed4c5c"/></g><g id="Graphic_10"><path d="M -.10625 -8.196875 L 1.8875 -6.065625 L -5.571875 -3.384375 L -7.325 -6.1 Z" fill="white"/></g><g id="Graphic_9"><path d="M 8.96875 .84375 L 1.715625 3.8 L 8.865625 .534375 Z M 8.865625 1.7375 L 1.13125 4.934375 L 8.728125 1.39375 Z M 8.934375 2.21875 L -.93125 6.48125 L 8.796875 1.909375 Z" fill="#94989b"/></g><g id="Graphic_8"><path d="M -4.196875 7.44375 C -5.4 4.934375 -2.30625 4.4875 -2.30625 4.4875 L -10.2125 -7.853125 C -10.2125 -7.853125 -12 -7.8875 -12 -6.03125 C -12 -5.275 -11.65625 -4.690625 -11.65625 -4.690625 Z" fill="#c94747"/></g></g></g></g></svg>` },

			{ tabname: 'keypoints','active' : false , icon: `<svg xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns="http://www.w3.org/2000/svg" xmlns:xl="http://www.w3.org/1999/xlink" version="1.1" viewBox="-8 9 23 19" width="28" height="19"><defs/><g id="Planner-green" fill-opacity="1" stroke="none" stroke-opacity="1" fill="none" stroke-dasharray="none"><title></title><g id="Planner-green_Layer_1"><title></title><g id="Group_15"><g id="Graphic_21"><path d="M 10.90625 19.346875 L 13.484375 21.890625 L 2.0375 27.35625 C 2.0375 27.35625 .525 28.04375 -.196875 26.94375 C -3.015625 22.54375 10.90625 19.346875 10.90625 19.346875 Z" fill="#228b22"/></g><g id="Graphic_20"><path d="M 1.7625 24.159375 C 1.7625 24.159375 -.4375 24.915625 -.025 26.39375 C .3875 27.90625 2.140625 26.978125 2.140625 26.978125 L 13.003125 21.925 C 13.003125 21.925 12.384375 20.309375 13.484375 19.24375 Z" fill="#d9e3e8"/></g><g id="Graphic_19"><path d="M 3.584375 9 L 14 19.140625 L 1.69375 23.953125 L -6.2125 11.646875 Z" fill="#46b850"/></g><g id="Graphic_18"><path d="M 3.89375 11.303125 L 5.8875 13.434375 L -1.571875 16.115625 L -3.325 13.4 Z" fill="white"/></g><g id="Graphic_17"><path d="M 12.96875 20.34375 L 5.715625 23.3 L 12.865625 20.034375 Z M 12.865625 21.2375 L 5.13125 24.434375 L 12.728125 20.89375 Z M 12.934375 21.71875 L 3.06875 25.98125 L 12.796875 21.409375 Z" fill="#94989b"/></g><g id="Graphic_16"><path d="M -.196875 26.94375 C -1.4 24.434375 1.69375 23.9875 1.69375 23.9875 L -6.2125 11.646875 C -6.2125 11.646875 -8 11.6125 -8 13.46875 C -8 14.225 -7.65625 14.809375 -7.65625 14.809375 Z" fill="#228b22"/></g></g></g></g></svg>`},
			
			{ tabname: 'paragraph','active' : true, icon: `<svg xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns="http://www.w3.org/2000/svg" xmlns:xl="http://www.w3.org/1999/xlink" version="1.1" viewBox="-14 -2 23 19" width="28" height="19"><defs/><g id="Planner-blue" fill-opacity="1" stroke="none" stroke-opacity="1" fill="none" stroke-dasharray="none"><title></title><g id="Planner-blue_Layer_1"><title></title><g id="Group_9"><g id="Graphic_15"><path d="M 5.40625 8.346875 L 7.984375 10.890625 L -3.4625 16.35625 C -3.4625 16.35625 -4.975 17.04375 -5.696875 15.94375 C -8.515625 11.54375 5.40625 8.346875 5.40625 8.346875 Z" fill="#2a8fd8" fill-opacity=".97"/></g><g id="Graphic_14"><path d="M -3.7375 13.159375 C -3.7375 13.159375 -5.9375 13.915625 -5.525 15.39375 C -5.1125 16.90625 -3.359375 15.978125 -3.359375 15.978125 L 7.503125 10.925 C 7.503125 10.925 6.884375 9.309375 7.984375 8.24375 Z" fill="#d9e3e8"/></g><g id="Graphic_13"><path d="M -1.915625 -2 L 8.5 8.140625 L -3.80625 12.953125 L -11.7125 .646875 Z" fill="#55bfff"/></g><g id="Graphic_12"><path d="M -1.60625 .303125 L .3875 2.434375 L -7.071875 5.115625 L -8.825 2.4 Z" fill="white"/></g><g id="Graphic_11"><path d="M 7.46875 9.34375 L .215625 12.3 L 7.365625 9.034375 Z M 7.365625 10.2375 L -.36875 13.434375 L 7.228125 9.89375 Z M 7.434375 10.71875 L -2.43125 14.98125 L 7.296875 10.409375 Z" fill="#94989b"/></g><g id="Graphic_10"><path d="M -5.696875 15.94375 C -6.9 13.434375 -3.80625 12.9875 -3.80625 12.9875 L -11.7125 .646875 C -11.7125 .646875 -13.5 .6125 -13.5 2.46875 C -13.5 3.225 -13.15625 3.809375 -13.15625 3.809375 Z" fill="#47a2f1"/></g></g></g></g></svg>` },
			
			{ tabname: 'summary','active' : true, icon: `<svg xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns="http://www.w3.org/2000/svg" xmlns:xl="http://www.w3.org/1999/xlink" version="1.1" viewBox="-35 -1 23 19" width="28" height="19"><defs/><g id="Planner-orange" fill-opacity="1" stroke="none" stroke-opacity="1" fill="none" stroke-dasharray="none"><title></title><g id="Planner-orange_Layer_1"><title></title><g id="Group_10"><g id="Graphic_16"><path d="M -15.59375 9.346875 L -13.015625 11.890625 L -24.4625 17.35625 C -24.4625 17.35625 -25.975 18.04375 -26.696875 16.94375 C -29.515625 12.54375 -15.59375 9.346875 -15.59375 9.346875 Z" fill="#e76d23"/></g><g id="Graphic_15"><path d="M -24.7375 14.159375 C -24.7375 14.159375 -26.9375 14.915625 -26.525 16.39375 C -26.1125 17.90625 -24.359375 16.978125 -24.359375 16.978125 L -13.496875 11.925 C -13.496875 11.925 -14.115625 10.309375 -13.015625 9.24375 Z" fill="#d9e3e8"/></g><g id="Graphic_14"><path d="M -22.915625 -1 L -12.5 9.140625 L -24.80625 13.953125 L -32.7125 1.646875 Z" fill="#ffa500"/></g><g id="Graphic_13"><path d="M -22.60625 1.303125 L -20.6125 3.434375 L -28.071875 6.115625 L -29.825 3.4 Z" fill="white"/></g><g id="Graphic_12"><path d="M -13.53125 10.34375 L -20.784375 13.3 L -13.634375 10.034375 Z M -13.634375 11.2375 L -21.36875 14.434375 L -13.771875 10.89375 Z M -13.565625 11.71875 L -23.43125 15.98125 L -13.703125 11.409375 Z" fill="#94989b"/></g><g id="Graphic_11"><path d="M -26.696875 16.600044 C -27.9 14.090669 -24.80625 13.643794 -24.80625 13.643794 L -32.7125 1.3031688 C -32.7125 1.3031688 -34.5 1.2687938 -34.5 3.125044 C -34.5 3.881294 -34.15625 4.465669 -34.15625 4.465669 Z" fill="#e76d23"/></g></g></g></g></svg>` },
			
			{ tabname: 'findings','active' : true, icon: `<svg xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns="http://www.w3.org/2000/svg" xmlns:xl="http://www.w3.org/1999/xlink" version="1.1" viewBox="-57 24 22 19" width="28" height="19"><defs/><g id="Planner-purple" fill-opacity="1" stroke="none" stroke-opacity="1" fill="none" stroke-dasharray="none"><title></title><g id="Planner-purple_Layer_1"><title></title><g id="Group_11"><g id="Graphic_17"><path d="M -38.09375 34.346875 L -35.515625 36.890625 L -46.9625 42.35625 C -46.9625 42.35625 -48.475 43.04375 -49.196875 41.94375 C -52.015625 37.54375 -38.09375 34.346875 -38.09375 34.346875 Z" fill="#6730ec"/></g><g id="Graphic_16"><path d="M -47.2375 39.159375 C -47.2375 39.159375 -49.4375 39.915625 -49.025 41.39375 C -48.6125 42.90625 -46.859375 41.978125 -46.859375 41.978125 L -35.996875 36.925 C -35.996875 36.925 -36.615625 35.309375 -35.515625 34.24375 Z" fill="#d9e3e8"/></g><g id="Graphic_15"><path d="M -45.415625 24 L -35 34.140625 L -47.30625 38.953125 L -55.2125 26.646875 Z" fill="#9370db"/></g><g id="Graphic_14"><path d="M -45.10625 26.303125 L -43.1125 28.434375 L -50.571875 31.115625 L -52.325 28.4 Z" fill="white"/></g><g id="Graphic_13"><path d="M -36.03125 35.34375 L -43.284375 38.3 L -36.134375 35.034375 Z M -36.134375 36.2375 L -43.86875 39.434375 L -36.271875 35.89375 Z M -36.065625 36.71875 L -45.93125 40.98125 L -36.203125 36.409375 Z" fill="#94989b"/></g><g id="Graphic_12"><path d="M -49.196875 41.94375 C -50.4 39.434375 -47.30625 38.9875 -47.30625 38.9875 L -55.2125 26.646875 C -55.2125 26.646875 -57 26.6125 -57 28.46875 C -57 29.225 -56.65625 29.809375 -56.65625 29.809375 Z" fill="#9370db"/></g></g></g></g></svg>` },
			
			{ tabname: 'methodology','active' : true, icon: `<svg xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns="http://www.w3.org/2000/svg" xmlns:xl="http://www.w3.org/1999/xlink" version="1.1" viewBox="-15 -3 22 19" width="28" height="19"><defs/><g id="Planner-black" fill-opacity="1" stroke="none" stroke-opacity="1" fill="none" stroke-dasharray="none"><title></title><g id="Planner-black_Layer_1"><title></title><g id="Group_12"><g id="Graphic_18"><path d="M 3.90625 7.346875 L 6.484375 9.890625 L -4.9625 15.35625 C -4.9625 15.35625 -6.475 16.04375 -7.196875 14.94375 C -10.015625 10.54375 3.90625 7.346875 3.90625 7.346875 Z" fill="black"/></g><g id="Graphic_17"><path d="M -5.2375 12.159375 C -5.2375 12.159375 -7.4375 12.915625 -7.025 14.39375 C -6.6125 15.90625 -4.859375 14.978125 -4.859375 14.978125 L 6.003125 9.925 C 6.003125 9.925 5.384375 8.309375 6.484375 7.24375 Z" fill="#d9e3e8"/></g><g id="Graphic_16"><path d="M -3.415625 -3 L 7 7.140625 L -5.30625 11.953125 L -13.2125 -.353125 Z" fill="#333"/></g><g id="Graphic_15"><path d="M -3.10625 -.696875 L -1.1125 1.434375 L -8.571875 4.115625 L -10.325 1.4 Z" fill="white"/></g><g id="Graphic_14"><path d="M 5.96875 8.34375 L -1.284375 11.3 L 5.865625 8.034375 Z M 5.865625 9.2375 L -1.86875 12.434375 L 5.728125 8.89375 Z M 5.934375 9.71875 L -3.93125 13.98125 L 5.796875 9.409375 Z" fill="#94989b"/></g><g id="Graphic_13"><path d="M -7.196875 14.94375 C -8.4 12.434375 -5.30625 11.9875 -5.30625 11.9875 L -13.2125 -.353125 C -13.2125 -.353125 -15 -.3875 -15 1.46875 C -15 2.225 -14.65625 2.809375 -14.65625 2.809375 Z" fill="#333"/></g></g></g></g></svg>` },
		]
		
		res.render('planner', {
            pageTitle: ('planner - ' + size),
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
