//  /corpus/				corpus list
//  /corpus/nagoya1			get corpus content
//	/mecab/?q=SENTENSE		analyze 'SETNTENSE' by mecab
//	/w2v/?q=[w1,w2,..]		calculate w2v average for word array



var fs = require('fs');
var NCMB = require("ncmb");

const ncmbinfo = JSON.parse(fs.readFileSync('ncmbinfo.json').toString()) ;
var ncmb = new NCMB( ncmbinfo.ak,ncmbinfo.ck );

var DB = ncmb.DataStore("JPWikipedia");

var log = console.log ;

var q_cache = {} ;
try {
	q_cache = JSON.parse(fs.readFileSync('q_cache.json').toString()) ;
} catch(e){} ;
function q_cache_replacer(k,v){if( v instanceof Array ) return v.join(','); return v}

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
var MeCab = new require('mecab-async') , mecab = new MeCab() ;

function analyze_w2v( nouns ){
	return new Promise( (accept,reject)=>{
		if( nouns.length>0 ){
			Promise.all(nouns.map(w=>{
				return new Promise((ac,rj)=>{
					q(w).then(ac).catch(ac) ;
				}) ;
			})).then(vecs=>{
				var v_av , avail_num = 0 ;
				vecs.forEach(vec=>{
					if( vec instanceof Array ){
						++avail_num ;
						if( v_av == undefined ) v_av = vec ;
						else {
							for( var xi=0;xi<v_av.length;++xi )
								v_av[xi] += vec[xi] ;
						}
					}
				})
				for( var xi=0;xi<v_av.length;++xi )
					v_av[xi] /= avail_num ;
				//log(nouns.join('') +'=>'+JSON.stringify(v_av) ) ;
				accept(v_av) ;
			}).catch(reject) ;
		} else {
			reject('No nouns provided.') ;
		}
	}) ;
}

function analyze_mecab(qstr){
	return new Promise((ac,rj)=>{
		mecab.parse(qstr, function(err, result) {
			if (err) rj(err);
			else ac(result);
		});
	}) ;
}

// Start server
var express = require('express')
var app = express();

var iconvLite = require('iconv-lite');

var corpus_id_to_filename_map = {} ;
for( var i=1;i<=129;++i ){
	corpus_id_to_filename_map['nagoya'+i] = 'data/nagoyacorpus/data'+(i<10?'00':(i<100?'0':''))+i+'.utf8.txt' ;
}


app.get('/corpus*',(req,res)=>{
	if( req.params.length == 0 || req.params[0].length==0 || req.params[0] == '/'){
		var ret_json = {} ;
		ret_json.corpus = [] ;
		for( var cid in corpus_id_to_filename_map ){
			ret_json.corpus.push(cid) ;
		}
		res.jsonp(ret_json) ;
	} else {
		var cmd = req.params[0].trim().substring(1) ;
		if( cmd.length == 0 ){
				res.jsonp({error:'No such cmd:'+cmd}) ;
		} else {
			var fname = corpus_id_to_filename_map[cmd] ;
			if( fname == undefined ){
				res.jsonp({error:'No such corpus cmd:'+cmd}) ;
			} else {
				var utf8str = fs.readFileSync(fname).toString() ;
				res.jsonp(utf8str.split("\n")) ;
				//res.jsonp({result:utf8str.split("\n")}) ;
			}
		}
	}
}) ;

// APIs
[['mecab',analyze_mecab],['w2v',analyze_w2v]].forEach(fun=>{
	app.get('/'+fun[0]+'*',(req,res)=>{
		if( req.query.q == undefined ){
			res.jsonp({error:'Please specify a sentence as GET parameter q!'}) ;
			return ;
		}

		var arg ;
		if( typeof req.query.q == 'string')
			arg = decodeURIComponent(req.query.q.trim())  ;
		else
			arg = req.query.q ;

		fun[1](arg).then(re=>{
			res.jsonp(re) ;
		}).catch(e=>{
			res.jsonp(e) ;
		})
	}) ;
}) ;

// Static contents
app.get('/*',(req,res)=>{
	try {
		if( req.url == '/') req.url='/index.html' ;
		res.write(fs.readFileSync('htdocs'+req.url).toString());
		res.end();
	} catch(e){
		res.write('No such file') ;
		res.end() ;
	}
});

// Start server
app.listen(8080,()=>{console.log('Web server stated at port 8080.')});

// Omit disconnection at Starbucks
setInterval(()=>{log(Date.now());},10000) ;