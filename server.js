#!/usr/bin/env node

require('dotenv').config();
var
	fs       = require('fs'),
	phonetic = require('phonetic'),
	shuffle  = require('knuth-shuffle').knuthShuffle,
	Twit     = require('twit')
	;

const INTERVAL = 180 * 60 * 1000; // once every 3 hours
const LAST_POST_FILE = '.lastpost';

function log(msg)
{
	console.log([new Date(), msg].join(' '));
}

function readOptions(which)
{
	var lines = fs.readFileSync('./' + which + '.txt', 'ascii').trim().split('\n');
	log(['---', lines.length, which, 'read'].join(' '));
	return lines;
}

function getMeOne(which)
{
	shuffle(DATA[which]);
	return DATA[which][0];
}

var DATA_TYPES = ['ages', 'genders', 'temperaments', 'diets', 'images'];
var DATA = {};
DATA_TYPES.forEach(function(t) { DATA[t] = readOptions(t); });

var config = {
	consumer_key:         process.env.TWITTER_CONSUMER_KEY,
	consumer_secret:      process.env.TWITTER_CONSUMER_SECRET,
	access_token:         process.env.TWITTER_ACCESS_TOKEN,
	access_token_secret:  process.env.TWITTER_ACCESS_TOKEN_SECRET,
	timeout_ms:           60 * 1000,  // optional HTTP request timeout to apply to all requests.
};
var T = new Twit(config);

function postTweet(toot)
{
	T.post('statuses/update', toot, function handleTootResponse(err, data, res)
	{
		if (err)
			log(err);
		else
		{
			log('tweet id=' + data.id_str + '; ' + toot.status);
			fs.writeFileSync(LAST_POST_FILE, (new Date()).toString());
		}
	});
}

// Mentions as a stream.
var mentions = T.stream('user');
mentions.on('tweet', function handleMention(tweet)
{
	if (tweet.in_reply_to_screen_name !== 'NMS_Species')
		return;

	var status = `@${tweet.user.screen_name}: Your species is like this:

${buildSpecies()}`;

	var toot = {
		status: status,
		in_reply_to_status_id: tweet.id_str
	};

	postTweet(toot);
});

mentions.on('error', function handleMentionsError(err)
{
	log('mentions error: ' + err);
});

function buildSpecies()
{
	var result = phonetic.generate(4) + ' ' + phonetic.generate(3);
	result += '\nage: ' + getMeOne('ages');
	result += '\ngender: ' + getMeOne('genders');

	if (result.length < 140)
		result += '\ntemperament: ' + getMeOne('temperaments');

	if (result.length < 140)
		result += '\ndiet: ' + getMeOne('diets');

	if (result.length < 108)
		result += '\n' + getMeOne('images');

	return result;
}

function postPeriodically()
{
	postTweet({ status: buildSpecies() });
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
