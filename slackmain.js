const SET_SLACK_TOPIC = false ;
const OUT_TFIDF_TO_FILE = false ;


var fs = require('fs');
var NCMB = require("ncmb");

const ncmbinfo = JSON.parse(fs.readFileSync('ncmbinfo.json').toString()) ;
var ncmb = new NCMB( ncmbinfo.ak,ncmbinfo.ck );

var DB = ncmb.DataStore("JPWikipedia");
var log = console.log ;

// Omit disconnection at Starbucks
setInterval(()=>{log(Date.now());},10000) ;

var q_cache = {} ;
try {
	q_cache = JSON.parse(fs.readFileSync('q_cache.json').toString()) ;
} catch(e){} ;
//function q_cache_replacer(k,v){if( v instanceof Array ) return v.join(','); return v}
var q_cache_replacer = null ;

// vector query main.
function q(word){
	return new Promise((ac,rj)=>{
		if( q_cache[word] != undefined ){
			ac(q_cache[word]) ;
			return ;
		}
		DB.in("Key",[word,'['+word+']']).fetchAll().then(re=>{
			if( re == undefined ){
				rj('No vector found :'+word);
				return;
			}
			switch( re.length ){
			case 0 :
				rj('No vector found :'+word);
				return;
			case 1 :
				q_cache[word]=re[0].Vector;
				ac(re[0].Vector);
				fs.writeFileSync('q_cache.json',JSON.stringify(q_cache,q_cache_replacer,"\t")) ;
				return ;
			case 2 :
				var r=[] ;
				for( var xi=0;xi<re[0].Vector.length;++xi )
					r.push( 0.5 * (re[0].Vector[xi] + re[1].Vector[xi]) ) ;
				q_cache[word]=r ;
				fs.writeFileSync('q_cache.json',JSON.stringify(q_cache,q_cache_replacer,"\t")) ;
				ac( r ) ;
				return ;
			}
			rj('Too many vectors ('+re.length+') found :'+word) ;
		}).catch(()=>{rj('No vector found :'+word);}) ;

	}) ;
}

// https://github.com/eirikhm/web-emoji/blob/master/sandbox/deprecated
const emoji_ranges = [ '\ud83c[\udf00-\udfff]', '\ud83d[\udc00-\ude4f]', '\ud83d[\ude80-\udeff]', '\ud7c9[\ude00-\udeff]', '[\u2600-\u27BF]' ];
var emoji_ex = new RegExp(emoji_ranges.join('|'), 'g');
function remove_unnecessary(text){
	return text
		.replace(emoji_ex, '')
		//.replace(/\{.*?\}/g, '') // Does not work..
		;
}

/*q('ハワイロア').then(v=>{
	log(v) ;
}).catch(()=>{log('No entry found.')});
*/
function analyze_w2v_eachword( nouns ){
	return new Promise( (accept,reject)=>{
		if( nouns.length>0 ){
			Promise.all(nouns.map(w=>{
				return new Promise((ac,rj)=>{
					q(w).then(ac).catch(ac) ;
				}) ;
			})).then(accept).catch(reject) ;
		} else {
			reject('No nouns provided.') ;
		}
	}) ;
}

var MeCab = new require('mecab-async') , mecab = new MeCab() ;
function analyze_mecab(qstr){
	return new Promise((ac,rj)=>{
		mecab.parse(qstr, function(err, result) {
			if (err) rj(err);
			else ac(result);
		});
	}) ;
}


function settopic(channel_name , topic_string ){
	console.log(channel_name+' topic to => '+topic_string) ;
	return new Promise((ac,rj)=>{
		function set(ch_or_grp){
			bot.api[ch_or_grp].list({}, function(err, res){
				if( res[ch_or_grp].filter(ch=>{
					if( ch.is_archived || ch.name != channel_name ) return false;
					bot.api[ch_or_grp].setTopic({channel:ch.id,topic:topic_string}) ;
					ac() ;
					return true ;
				}).length == 0 ){
					if( ch_or_grp == 'channels' ) set('groups') ;
					else rj() ;
				}
			});
		}
		set('channels') ;
	} ) ;
};


/*
controller.hears(["Hey"],["direct_message","direct_mention","mention"],function(bot,message) {
  // キーワードに反応した処理
  bot.reply(message, '病気でーす');
});

bot.say({
    channel: 'test' ,text: 'PPXX' ,username: 'nanobot'
    //,icon_url: 'http://namakemonoyoshi.com/wp-content/uploads/2016/06/6c473ecc1-300x274.jpg'
});
*/





///////// Slack settings

var SLACK_TOKEN ;
try {
	// Add a bot https://my.slack.com/services/new/bot and put the token information into settings.json
	SLACK_TOKEN = JSON.parse(fs.readFileSync('slackinfo.json').toString()).SLACK_TOKEN ;
} catch(e){
	console.error('Create "slackinfo.json" with SLACK_TOKEN key of slack bot token value') ;
	process.exit();
}

var async = require('async');
var Botkit = require('botkit');

var controller = Botkit.slackbot();
var bot = controller.spawn({
  token: SLACK_TOKEN //process.env.token
}).startRTM(function(err,bot,payload) {
  // 初期処理
  if (err) {
    throw new Error('Could not connect to Slack');
  }

  main() ;
}) ;

var channels = {};
function main(){
	(new Promise((ac,rj)=>{
		var countdown = 0 ;
		try {
			// Add a bot https://my.slack.com/services/new/bot and put the token information into settings.json
			const SLACK_DATA_BASEPATH = 'data/slacklog20170514/' ;
			JSON.parse(fs.readFileSync(SLACK_DATA_BASEPATH+'channels.json').toString()).forEach(chinfo=>{
				if( chinfo.is_archived ) return ;

				const channel_name = chinfo.name ;
				chinfo.word_count = {} ;
				channels[channel_name] = chinfo ;
				fs.readdir(SLACK_DATA_BASEPATH+channel_name, function(err, files){
					if (err) return ; //throw err;
					files.filter(function(filename){
						return fs.statSync(`${SLACK_DATA_BASEPATH}${channel_name}/${filename}`).isFile() ; // && /.*\.csv$/.test(filename)
					}).forEach(function (filename) {
						JSON.parse(fs.readFileSync(`${SLACK_DATA_BASEPATH}${channel_name}/${filename}`)).forEach(msg=>{
							if( msg.type != 'message' ) return ;
							var msg2 = msg.text.replace(/<.+>/,'[---]') ;
							if( msg2.length == 0 ) return ;

							++countdown ;
							mecab.parse(msg2, function(err, mcb_result) {
								--countdown ;
								if (err){ if( countdown==0 ) ac() ; return ;}
								mcb_result.forEach(wordinfo=>{
									if( wordinfo[2] != '固有名詞' || wordinfo[0] == 'アツ') return ;
									// Exclude English words
									if( wordinfo[0].match(/^[a-zA-Z0-9]/)) return ;
									//console.log(JSON.stringify(wordinfo));
									if( channels[channel_name].word_count[wordinfo[0]] == undefined )
										channels[channel_name].word_count[wordinfo[0]] = 1 ;
									else
										++channels[channel_name].word_count[wordinfo[0]] ;
								}) ;
								if( countdown==0 ) ac() ; 
							});
						}) ;
					});
				});

			}) ;
		} catch(e){
			rj(e) ;
		}
	})).then(()=>{
		console.log('Calculating tfidf.') ;
		// The only input is channels[ch].word_count

		var wc_global = {} ;
		for( var ch_name in channels ){
			var ch = channels[ch_name] ;
			for( var w in ch.word_count ){
				if( wc_global[w] == undefined  )	wc_global[w] =  ch.word_count[w] ;
				else								wc_global[w] += ch.word_count[w] ;
			}
		}

		const MINIMUM_WORD_COUNT = 2 ;

		var wc_total = 0 , idf = {} ;
		for( var ch_name in channels ){
			var ch = channels[ch_name] ;
			ch.wc_total = 0 ;
			for( var w in ch.word_count ){
				// Filter out too few words
				if( wc_global[w] < MINIMUM_WORD_COUNT ){ delete wc_global[w]; continue;}

				if( idf[w] == undefined ) idf[w] = 1 ;
				else ++idf[w] ;

				wc_total += ch.word_count[w] ;
				ch.wc_total += ch.word_count[w] ;
			}
		}

		// fs.writeFileSync( 'ch_global.json',JSON.stringify(wc_global,null,"\t") ) ;

		for( var w in idf ) idf[w] = Math.log( Object.keys(channels).length / idf[w]) ;

		if( OUT_TFIDF_TO_FILE )
			fs.writeFileSync( 'idf.json',JSON.stringify(idf,null,"\t") ) ;

		for( var ch_name in channels ){
			var ch = channels[ch_name] ;
			ch.tfidf = [] ;
			for( var w in ch.word_count ){
				// Filter out too few words
				if( wc_global[w] == undefined ) continue ;

				var tf = (ch.word_count[w] / ch.wc_total) / (wc_global[w] / wc_total) ;
				ch.tfidf.push( { word : w , tfidf : tf * idf[w] , word_count : ch.word_count[w] } ) ;
			}

			ch.tfidf.sort( (p,q) => q.tfidf - p.tfidf ) ;

			if(OUT_TFIDF_TO_FILE){
				fs.writeFileSync( 'ch_'+ch_name+'.json',JSON.stringify(ch.word_count,null,"\t") ) ;
				fs.writeFileSync( 'ch_'+ch_name+'.json',JSON.stringify(ch.tfidf,null,"\t") ) ;
			}

			if(SET_SLACK_TOPIC)
				settopic( ch_name , ch.tfidf.slice(0,5).map(elem=>elem.word).join(',') ).catch(()=>{}) ;
		}

	}).catch(e=>{
		console.error('Error in reading slack channel log') ;
		console.error(JSON.stringify(e)) ;
		process.exit();

	}) ;

}