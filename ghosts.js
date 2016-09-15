#!/usr/bin/env node

require('dotenv').config();
var
	exec     = require('child_process').exec,
	fs       = require('fs'),
	mustache = require('mustache'),
	phonetic = require('phonetic'),
	shuffle  = require('knuth-shuffle').knuthShuffle,
	Twit     = require('twit')
	;

const INTERVAL = 180 * 60 * 1000; // once every 3 hours
const LAST_POST_FILE = '.lastpost';
const template = fs.readFileSync('./template.html', 'ascii');

function log(msg)
{
	console.log([new Date(), msg].join(' '));
}

function readOptions(which)
{
	var lines = fs.readFileSync('./' + which + '.txt', 'utf8').trim().split('\n');
	log(['---', lines.length, which, 'read'].join(' '));
	shuffle(lines);
	return lines;
}

function getMeOne(which)
{
	var use = DATA[which].pop();
	if (DATA[which].length < 1)
		DATA[which] = readOptions(which);

	return use;
}

var DATA_TYPES = ['ages', 'genders', 'temperaments', 'diets', 'images'];
var DATA = {};
DATA_TYPES.forEach(function map(t) { DATA[t] = readOptions(t); });

var config = {
	consumer_key:         process.env.TWITTER_CONSUMER_KEY,
	consumer_secret:      process.env.TWITTER_CONSUMER_SECRET,
	access_token:         process.env.TWITTER_ACCESS_TOKEN,
	access_token_secret:  process.env.TWITTER_ACCESS_TOKEN_SECRET,
	timeout_ms:           60 * 1000,  // optional HTTP request timeout to apply to all requests.
};
var T = new Twit(config);

function postTweet(toot, skip)
{
	T.post('statuses/update', toot, function handleTootResponse(err, data, res)
	{
		if (err)
			log(err);
		else
		{
			log('tweet id=' + data.id_str + '; ' + toot.status);
			if (!skip) fs.writeFileSync(LAST_POST_FILE, (new Date()).toString());
		}
	});
}

function buildSpecies()
{
	var items = {
		image:       getMeOne('images'),
		age:         getMeOne('ages'),
		gender:      getMeOne('genders'),
		temperament: getMeOne('temperaments'),
		diet:        getMeOne('diets'),
		name:        phonetic.generate({ syllables: 4, compoundSimplicity: 3}) +
					' ' +
					phonetic.generate({syllables: 3}),
	};
	var result = mustache.render(template, items);
	fs.writeFileSync('input.html', result);

	return items.name;
}

function renderIt(callback)
{
	exec('npm run render', function handleExec(err, stdout, stderr)
	{
		callback(err);
	});
}

function postImage(callback)
{
	T.postMediaChunked({ file_path: './output.png' }, function handleMediaPosted(err, data, response)
	{
		if (err)
		{
			log('error posting image file: output.png');
			log(err);
			return callback(err);
		}

		var imageID = data.media_id_string;
		log('image uploaded; id=' + imageID);
		callback(null, imageID);
	});
}

// Mentions as a stream.
var mentions = T.stream('user');
mentions.on('tweet', function handleMention(tweet)
{
	if (tweet.in_reply_to_screen_name !== 'NMS_Species')
		return;

	var name = buildSpecies();
	var status = `@${tweet.user.screen_name}: You have discovered the species ${name}!`;

	renderIt(function(err)
	{
		if (err) return;

		postImage(function(err, imageID)
		{
			if (err) return;

			var toot = {
				status: status,
				in_reply_to_status_id: tweet.id_str,
				media_ids: [ imageID ]
			};
			postTweet(toot, true);
		});
	});
});

mentions.on('error', function handleMentionsError(err)
{
	log('mentions error: ' + err);
});

function postPeriodically()
{
	var name = buildSpecies();
	renderIt(function(err)
	{
		if (err) return;

		postImage(function(err, imageID)
		{
			if (err) return;

			var toot = { status: name, media_ids: [ imageID ] };
			postTweet(toot);
		});
	});
}

log('no person\'s sky species bot online');

var postNow = false;
try
{
	var lastPost = new Date(fs.readFileSync(LAST_POST_FILE, 'ascii'));
	postNow = (Date.now() - lastPost.getTime()) >= INTERVAL / 2;
}
catch (e)
{
	postNow = true;
}

if (postNow) postPeriodically();
setInterval(postPeriodically, INTERVAL);
